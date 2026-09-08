import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { rowsFromArchive } from '@motionstudies/data/gtfs'

const archive = process.argv[2]
if (!archive) throw new Error('Usage: node scripts/audit-rigi-weggis.mjs /path/GTFS.zip')
const network = JSON.parse(await readFile('public/data/rigi-day.json', 'utf8'))
const hash = createHash('sha256')
for await (const bytes of createReadStream(archive)) hash.update(bytes)
const sha256 = hash.digest('hex')
if (sha256 !== network.metadata.sources.timetable.sha256) throw new Error('Archive differs from Rigi fixture')
const pierIds = [1, 2].map(p => `ch:1:sloid:8463_gen:missingSLOID_pf:${p}`)
const railIds = ['ch:1:sloid:5074', 'ch:1:sloid:5074:0:450724', 'ch:1:sloid:5074:0:715663']
const valleyId = 'ch:1:sloid:30388', mountainId = 'ch:1:sloid:30687'
const ids = new Set([...pierIds, ...railIds, valleyId, mountainId]), stops = []
for await (const row of rowsFromArchive(archive, 'stops.txt')) if (ids.has(row.stop_id)) stops.push(row)
if (stops.length !== ids.size) throw new Error('Missing source stop')
const family = new Map(stops.map(s => [s.stop_id, s.parent_station]))
for (const parent of family.values()) family.set(parent, parent)
const expected = new Map()
for (const pier of pierIds) { expected.set(`${pier}|${valleyId}`, 1200); expected.set(`${valleyId}|${pier}`, 900) }
for (const rail of railIds) { expected.set(`${mountainId}|${rail}`, 300); expected.set(`${rail}|${mountainId}`, 300) }
const relevantFamilies = new Set([...expected.keys()].map(key => key.split('|').map(id => family.get(id)).join('|')))
const records = []
for await (const row of rowsFromArchive(archive, 'transfers.txt')) {
  if (!relevantFamilies.has([family.get(row.from_stop_id), family.get(row.to_stop_id)].join('|'))) continue
  const key = `${row.from_stop_id}|${row.to_stop_id}`
  if (!expected.has(key) || row.transfer_type !== '2' || Number(row.min_transfer_time) !== expected.get(key) || ['from_route_id', 'to_route_id', 'from_trip_id', 'to_trip_id', 'service_id'].some(field => row[field]) || records.some(r => r.from_stop_id === row.from_stop_id && r.to_stop_id === row.to_stop_id)) throw new Error('Changed or more specific Weggis/Kaltbad transfer rules require review')
  records.push(row)
}
if (records.length !== expected.size) throw new Error('Missing interchange rules')
await writeFile('data/rigi-weggis-interchange-source.json', JSON.stringify({
  feedVersion: network.metadata.feedVersion, serviceDate: network.metadata.serviceDate, sha256,
  sourceFiles: ['stops.txt', 'transfers.txt'], stops, records,
  pedestrianContext: { sourceUrl: 'https://www.rigi.ch/en/inform/plan-your-trip/rigi-kulm/arrival', retrieved: '2026-09-08', weggisWalkMinutes: 15, kaltbadWalkMetres: 200, note: 'Operator context is separate from directional timetable transfer minima; no walking geometry is supplied.' },
}, null, 2) + '\n')
console.log('Retained 10 directional interchange rules: Weggis uphill 20 min, downhill 15 min; Kaltbad 5 min.')
