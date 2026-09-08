import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { rowsFromArchive } from '@motionstudies/data/gtfs'

// Retain every rule for this source location, including parent-level rules.
// A future specific rule requires review rather than silently falling back.
const archive = process.argv[2]
if (!archive) throw new Error('Usage: node scripts/audit-rigi-interchange.mjs /path/GTFS.zip')
const network = JSON.parse(await readFile('public/data/rigi-day.json', 'utf8'))
const hash = createHash('sha256')
for await (const bytes of createReadStream(archive)) hash.update(bytes)
const sha256 = hash.digest('hex')
if (sha256 !== network.metadata.sources.timetable.sha256) throw new Error('Archive differs from Rigi fixture')
const stopId = 'ch:1:sloid:8464', ids = new Set([stopId, `Parent${stopId}`]), records = []
for await (const row of rowsFromArchive(archive, 'transfers.txt')) {
  if (ids.has(row.from_stop_id) && ids.has(row.to_stop_id)) records.push(row)
}
if (records.length !== 1 || records[0].from_stop_id !== stopId || records[0].to_stop_id !== stopId || records[0].transfer_type !== '2' || records[0].min_transfer_time !== '60' || ['from_route_id', 'to_route_id', 'from_trip_id', 'to_trip_id', 'service_id'].some(key => records[0][key])) throw new Error('Changed Vitznau transfer rules require review')
await writeFile('data/rigi-interchange-source.json', JSON.stringify({
  feedVersion: network.metadata.feedVersion, serviceDate: network.metadata.serviceDate, sha256,
  sourceFile: 'transfers.txt', records,
  pedestrianContext: { sourceUrl: 'https://www.rigi.ch/en/inform/arrival/arrival-parking-vitznau', retrieved: '2026-09-08', walkMetres: 50 },
}, null, 2) + '\n')
console.log('Retained the source Vitznau transfer rule: 60 seconds minimum.')
