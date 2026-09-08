import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readBernTimetables } from './bern-timetable.mjs'

export const VALAIS_DATES = ['2026-09-04', '2026-09-06']
export const GTFS_SHA256 = 'd325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e'
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}

export async function valaisTimetable(archive, cache) {
  const sourceBytes = await readFile('data/valais-sources/decoded.json.gz')
  const archiveHash = await hashFile(archive)
  assert.equal(archiveHash, GTFS_SHA256, 'Unreviewed national timetable release')
  const source = JSON.parse(gunzipSync(sourceBytes))
  assert.equal(source.canton[0].properties.kantonsnummer, 23)
  assert.equal(source.districts.length, 13)
  const timetable = await readBernTimetables(archive, VALAIS_DATES, source, {
    cantonName: 'Valais', boundaryBounds: [2490000, 1070000, 2690000, 1170000],
  })
  timetable.sourceHashes = { archive: archiveHash, source: sha256(sourceBytes) }
  await writeFile(cache, gzipSync(JSON.stringify(timetable), { mtime: 0 }))
  console.log(JSON.stringify({ routes: timetable.routes.length, agencies: new Set(timetable.routes.map(r => r.agencyId)).size,
    days: timetable.snapshots.map(s => ({ date: s.metadata.serviceDate, trips: s.trains.length })) }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv[2] && process.argv[3], 'Usage: node --max-old-space-size=8192 scripts/valais-timetable.mjs ARCHIVE CACHE')
  await valaisTimetable(process.argv[2], process.argv[3])
}
