import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readBernTimetables } from './bern-timetable.mjs'

export const SO_DATES = ['2026-09-04', '2026-09-06']
export const SO_SEASONAL_DATES = ['2026-01-16', '2026-01-18', '2026-04-03', '2026-04-05', '2026-07-17', '2026-07-19', '2026-08-01', ...SO_DATES, '2026-10-23', '2026-10-25', '2026-12-11']
export const SO_GTFS_SHA = 'd325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e'
export async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}
export async function solothurnTimetable(archive, cache = 'data/solothurn-audit/timetable-cache.json.gz', dates = SO_DATES) {
  const archiveSha256 = await hashFile(archive)
  assert.equal(archiveSha256, SO_GTFS_SHA, 'Unreviewed national timetable')
  const sourceSha256 = await hashFile('data/solothurn-sources/decoded.json.gz')
  const source = JSON.parse(gunzipSync(await readFile('data/solothurn-sources/decoded.json.gz')))
  const timetable = await readBernTimetables(archive, dates, source,
    { cantonName: 'Solothurn', boundaryBounds: [2585000, 1205000, 2660000, 1275000] })
  timetable.sourceHashes = { archive: archiveSha256, source: sourceSha256 }
  await mkdir('data/solothurn-audit', { recursive: true })
  await writeFile(cache, gzipSync(JSON.stringify(timetable), { mtime: 0 }))
  return timetable
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv[2], 'Usage: node scripts/solothurn-timetable.mjs GTFS_ARCHIVE')
  const seasonal = process.argv.includes('--seasonal')
  const result = await solothurnTimetable(process.argv[2], seasonal ? 'data/solothurn-audit/seasonal-timetable-cache.json.gz' : undefined, seasonal ? SO_SEASONAL_DATES : SO_DATES)
  console.log(JSON.stringify({ census: result.census, days: result.snapshots.map(s => ({ date: s.metadata.serviceDate, trips: s.trains.length })) }))
}
