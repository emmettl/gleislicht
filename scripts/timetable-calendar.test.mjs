import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nextDate, prepareRailDay, sha256 } from './timetable-calendar.mjs'
import { inventory, validateReferences } from './data-release.mjs'
const roots = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'timetable-test-')); roots.push(root)
  await mkdir(join(root, 'swiss-rail-day-chunks'))
  const metadata = { serviceDate: '2026-09-13', feedVersion: '20260909', windowStart: 0, windowEnd: 86400 }
  const trains = Array.from({ length: 1001 }, (_, i) => ({ id: `trip-${i}`, stops: [[0, 0, 0], [1, 100, 100]] }))
  const payload = JSON.stringify({ windowStart: 0, windowEnd: 86400, trains })
  const manifest = { metadata, stops: [[0, 0, 'A', '', 'a'], [0, 0, 'B', '', 'b']], chunks: [{ windowStart: 0, windowEnd: 86400, path: 'swiss-rail-day-chunks/00-24.json', bytes: Buffer.byteLength(payload), sha256: sha256(payload) }] }
  await writeFile(join(root, 'swiss-rail-day-chunks/00-24.json'), payload)
  await writeFile(join(root, 'swiss-rail-day-manifest.json'), JSON.stringify(manifest))
  for (const name of ['swiss-rail-morning', 'swiss-hub-day', 'swiss-cogwheel-catalogue', 'postbus-national-day-manifest']) await writeFile(join(root, name + '.json'), JSON.stringify({ metadata }))
  return { root, manifest }
}
describe('prepared service days', () => {
  it('advances the date across month/year and DST changes', () => {
    expect(nextDate('2026-12-31')).toBe('2027-01-01')
    expect(nextDate('2026-03-29')).toBe('2026-03-30')
    expect(nextDate('2026-10-25')).toBe('2026-10-26')
  })
  it('builds identities from validated source bytes and rejects an old fallback for tomorrow', async () => {
    const { root } = await fixture()
    const day = await prepareRailDay(root, '2026-09-13')
    const bytes = await readFile(join(root, 'swiss-rail-realtime-index.json'))
    expect(day.indexSha256).toBe(sha256(bytes))
    expect(JSON.parse(bytes).trips['trip-0']).toEqual(['a', 'b'])
    await expect(prepareRailDay(root, '2026-09-14')).rejects.toThrow('wrong date')
    await writeFile(join(root, 'swiss-rail-day-chunks/00-24.json'), '{}')
    await expect(prepareRailDay(root, '2026-09-13')).rejects.toThrow()
  })
  it('rejects incomplete days and source stop identity loss', async () => {
    const { root, manifest } = await fixture()
    manifest.chunks[0].windowStart = 10
    await writeFile(join(root, 'swiss-rail-day-manifest.json'), JSON.stringify(manifest))
    await expect(prepareRailDay(root, '2026-09-13')).rejects.toThrow('Gap')
    manifest.chunks[0].windowStart = 0
    manifest.stops[0].pop()
    await writeFile(join(root, 'swiss-rail-day-manifest.json'), JSON.stringify(manifest))
    await expect(prepareRailDay(root, '2026-09-13')).rejects.toThrow('Missing source stop')
  })
  it('validates nested calendar chunks against their own day, even when a top-level alias exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'calendar-release-test-')); roots.push(root)
    await mkdir(join(root, 'calendar/2026-09-14/chunks'), { recursive: true })
    await mkdir(join(root, 'chunks'))
    await writeFile(join(root, 'chunks/day.json'), '{}')
    const data = '{"tomorrow":true}'
    await writeFile(join(root, 'calendar/2026-09-14/chunks/day.json'), data)
    await writeFile(join(root, 'calendar/2026-09-14/manifest.json'), JSON.stringify({ chunks: [{ path: 'chunks/day.json', sha256: sha256(data) }] }))
    await expect(validateReferences(root, await inventory(root))).resolves.toBeUndefined()
  })
})
