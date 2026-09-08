import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverOrbitalSources, readOrbitalSource } from './orbital-sources.mjs'

const roots = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), 'orbital-sources-')); roots.push(root)
  for (const [file, date] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true })
    await writeFile(join(root, file), JSON.stringify({ metadata: { serviceDate: date, windowStart: 0, windowEnd: 86400 }, stops: [], edges: [], trains: [] }))
  }
  return root
}
describe('orbital public feed coverage', () => {
  it('includes a newly published feed without a hand-maintained orbital entry', async () => {
    const root = await fixture({ 'national-day.json': '2026-09-04', 'new-region/2026-09-08/new-region-day-manifest.json': '2026-09-08' })
    const { selected } = await discoverOrbitalSources(root, [{ id: 'rail', file: 'national-day.json' }])
    expect(selected.map(s => s.id)).toEqual(['rail', 'new-region'])
    expect(selected.every(s => /^[a-f0-9]{64}$/.test(s.sha256))).toBe(true)
  })
  it('uses one newest weekday per feed and prefers its release alias', async () => {
    const root = await fixture({ 'region-day-manifest.json': '2026-09-08', 'region/2026-09-08/region-day-manifest.json': '2026-09-08', 'region/2026-09-04/region-day-manifest.json': '2026-09-04', 'region/2026-09-13/region-day-manifest.json': '2026-09-13' })
    const { selected, excluded } = await discoverOrbitalSources(root)
    expect(selected.map(s => s.file)).toEqual(['region-day-manifest.json'])
    expect(excluded).toHaveLength(3)
  })
  it('does not follow local archives or include aircraft, morning extracts and weekend-only feeds', async () => {
    const archive = await fixture({ 'private-day.json': '2026-09-08' })
    const root = await fixture({ 'public-day.json': '2026-09-08', 'weekend-day.json': '2026-09-06', 'region-morning.json': '2026-09-08' })
    await symlink(archive, join(root, 'archive'))
    await writeFile(join(root, 'air-day-manifest.json'), JSON.stringify({ tracks: [], metadata: { serviceDate: '2026-09-08' } }))
    expect((await discoverOrbitalSources(root)).selected.map(s => s.id)).toEqual(['public'])
  })
  it('fails if an established source is missing or has an incomplete day', async () => {
    const root = await fixture({ 'region-day.json': '2026-09-08' })
    await expect(discoverOrbitalSources(root, [{ id: 'missing', file: 'missing-day.json' }])).rejects.toThrow('Missing public weekday')
    await writeFile(join(root, 'region-day.json'), JSON.stringify({ metadata: { serviceDate: '2026-09-08', windowStart: 24300, windowEnd: 31500 }, stops: [], edges: [], trains: [] }))
    await expect(discoverOrbitalSources(root)).rejects.toThrow('Incomplete orbital source day')
  })
  it('verifies chunk contents and rejects a source changed after discovery', async () => {
    const root = await fixture({})
    const chunk = JSON.stringify({ windowStart: 0, windowEnd: 86400, trains: [{ id: 'new-bus' }] })
    await writeFile(join(root, 'chunk.json'), chunk)
    await writeFile(join(root, 'region-day-manifest.json'), JSON.stringify({ metadata: { serviceDate: '2026-09-08', windowStart: 0, windowEnd: 86400 }, stops: [], edges: [], tripCount: 1, chunks: [{ path: 'chunk.json', windowStart: 0, windowEnd: 86400, tripCount: 1, bytes: Buffer.byteLength(chunk), sha256: createHash('sha256').update(chunk).digest('hex') }] }))
    const [source] = (await discoverOrbitalSources(root)).selected
    const loaded = await readOrbitalSource(root, source)
    expect([...loaded.trains.keys()]).toEqual(['new-bus'])
    expect(loaded.inputSha256).toMatch(/^[a-f0-9]{64}$/)
    await writeFile(join(root, 'chunk.json'), chunk.replace('new-bus', 'old-bus'))
    await expect(readOrbitalSource(root, source)).rejects.toThrow('integrity mismatch')
    await writeFile(join(root, source.file), '{}')
    await expect(readOrbitalSource(root, source)).rejects.toThrow('changed during build')
  })
})
