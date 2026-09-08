import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { rowsFromArchive, parseGtfsTime, activeServices } from '@motionstudies/data/gtfs'
const arg = name => { const index = process.argv.indexOf(`--${name}`); return index < 0 ? undefined : process.argv[index+1] }
const archive = arg('archive')
if (!archive || archive.startsWith('--')) throw new Error('Use --archive dated-Swiss-GTFS.zip')
const network = JSON.parse(await readFile('public/data/jungfrau-day.json', 'utf8'))
const hash = createHash('sha256'); for await (const chunk of createReadStream(archive)) hash.update(chunk)
const sha256 = hash.digest('hex')
if (sha256 !== network.metadata.sources.timetable.sha256) throw new Error('Archive does not match Jungfrau delivery')
const root = id => id?.match(/^ch:1:sloid:\d+/)?.[0]
const routes = { '91-62-j26-1': ['7492', '7384'], '93-63-j26-1': ['7384', '7374'], '93-65-j26-1': ['7374', '7364'] }
const trips = Object.fromEntries(network.trains.filter(t => {
  const ends = routes[t.routeId]
  return ends && root(network.stops[t.stops[0][0]][4]) === `ch:1:sloid:${ends[0]}` && root(network.stops[t.stops.at(-1)[0]][4]) === `ch:1:sloid:${ends[1]}`
}).map(t => [t.id, { routeId: t.routeId, agencyId: t.agencyId, routeType: t.routeType, calls: [] }]))
const active = await activeServices(archive, network.metadata.serviceDate), found = new Set()
const sourceRoutes = new Map()
for await (const row of rowsFromArchive(archive, 'routes.txt')) sourceRoutes.set(row.route_id, row)
for await (const row of rowsFromArchive(archive, 'trips.txt')) {
  const trip = trips[row.trip_id]
  if (!trip) continue
  const route = sourceRoutes.get(row.route_id)
  if (!active.has(row.service_id) || row.route_id !== trip.routeId || route?.agency_id !== trip.agencyId || Number(route?.route_type) !== trip.routeType) throw new Error(`Source identity differs for ${row.trip_id}`)
  found.add(row.trip_id)
}
if (found.size !== Object.keys(trips).length) throw new Error('Source trips missing')
for await (const r of rowsFromArchive(archive, 'stop_times.txt')) {
  if (trips[r.trip_id]) trips[r.trip_id].calls.push({ sequence: Number(r.stop_sequence), stopId: r.stop_id, arrival: parseGtfsTime(r.arrival_time), departure: parseGtfsTime(r.departure_time), pickup: r.pickup_type || '0', dropOff: r.drop_off_type || '0' })
}
for (const [id, trip] of Object.entries(trips)) {
  trip.calls.sort((a,b) => a.sequence-b.sequence)
  const delivered = network.trains.find(t => t.id === id)
  if (delivered.stops.length !== trip.calls.length || delivered.stops.some((s,i) => network.stops[s[0]][4] !== trip.calls[i].stopId || s[1] !== trip.calls[i].arrival || s[2] !== trip.calls[i].departure)) throw new Error(`Source calls differ for ${id}`)
}
const transfers = []
for await (const row of rowsFromArchive(archive, 'transfers.txt')) {
  if (['ch:1:sloid:7384','ch:1:sloid:7374'].some(id => root(row.from_stop_id) === id && root(row.to_stop_id) === id)) transfers.push(row)
}
const result = { serviceDate: network.metadata.serviceDate, feedVersion: network.metadata.feedVersion, sha256, sourceUrl: network.metadata.sourceUrl, operator: { url: 'https://www.jungfrau.ch/en-gb/arriving/', checked: '2026-09-08', boardingLeadSeconds: 600, note: 'Kleine Scheidegg: operator asks passengers to pass the turnstiles at least ten minutes before departure. Allow this in addition to the GTFS transfer minimum. Reservation and availability are not validated by this composition.' }, editorial: { lauterbrunnenMinimumSeconds: 600, maximumWaitSeconds: 3600, note: 'No internal Lauterbrunnen transfer row in this archive. Ten minutes is an editorial allowance, not a published transfer rule; waits over one hour are excluded.' }, transfers, trips }
await writeFile('data/jungfrau-ascent-source.json', JSON.stringify(result, null, 2)+'\n')
console.log(`${Object.keys(trips).length} upward trips reconciled; ${transfers.length} internal transfer records retained.`)
