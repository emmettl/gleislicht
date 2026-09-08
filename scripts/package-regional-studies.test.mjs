import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { readStudyArchive } from './package-regional-studies.mjs'

const directories = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'regional-study-test-')); directories.push(root)
  await mkdir(join(root, 'day-chunks'))
  const train = { id: 'one', start: 27900, end: 28000, stops: [[0, 27900, 27900], [1, 28000, 28000]], pathSegments: [0] }
  const manifest = { metadata: { serviceDate: '2026-09-04', feedVersion: '20260902', windowStart: 0, windowEnd: 86400, sourceHashes: { fixture: 'a'.repeat(64) } }, paths: [[[8.5, 47.1], [8.51, 47.11]]], stops: [{ id: 'a' }, { id: 'b' }], tripCount: 1, chunks: [] }
  for (let i = 0; i < 12; i++) {
    const chunk = { windowStart: i * 7200, windowEnd: (i + 1) * 7200, trains: i === 3 ? [train] : [] }
    const bytes = Buffer.from(JSON.stringify(chunk)), path = `day-chunks/${String(i * 2).padStart(2, '0')}-${String((i + 1) * 2).padStart(2, '0')}.json`
    await writeFile(join(root, path), bytes)
    manifest.chunks.push({ path, windowStart: chunk.windowStart, windowEnd: chunk.windowEnd, tripCount: chunk.trains.length, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  const morning = { ...manifest, metadata: { ...manifest.metadata, windowStart: 24300, windowEnd: 31500 }, trains: [train] }
  await writeFile(join(root, 'test-morning.json'), JSON.stringify(morning))
  const save = () => writeFile(join(root, 'test-day-manifest.json'), JSON.stringify(manifest))
  await save()
  return { root, manifest, save }
}
describe('regional study packaging', () => {
  it('retains complete validated chunk bytes and source records', async () => {
    const { root } = await fixture()
    const archive = await readStudyArchive(root, 'test', '2026-09-04')
    expect(archive.files.size).toBe(12)
    expect(archive.morning.trains[0].stops[1]).toEqual([1, 28000, 28000])
  })
  it('rejects corrupted chunks before packaging', async () => {
    const { root } = await fixture()
    await writeFile(join(root, 'day-chunks/06-08.json'), '{}')
    await expect(readStudyArchive(root, 'test', '2026-09-04')).rejects.toThrow('Chunk checksum mismatch')
  })
  it('rejects missing time coverage and path traversal', async () => {
    const { root, manifest, save } = await fixture()
    manifest.chunks[1].windowStart++
    await save()
    await expect(readStudyArchive(root, 'test', '2026-09-04')).rejects.toThrow()
    manifest.chunks[1].windowStart--
    manifest.chunks[0].path = '../outside.json'
    await save()
    await expect(readStudyArchive(root, 'test', '2026-09-04')).rejects.toThrow('Unsafe chunk path')
  })
  it('rejects an unreviewed date or feed', async () => {
    const { root, manifest, save } = await fixture()
    await expect(readStudyArchive(root, 'test', '2026-09-06')).rejects.toThrow('Wrong manifest date')
    manifest.metadata.feedVersion = 'new-feed'
    await save()
    await expect(readStudyArchive(root, 'test', '2026-09-04')).rejects.toThrow('Unreviewed feed version')
  })
})
