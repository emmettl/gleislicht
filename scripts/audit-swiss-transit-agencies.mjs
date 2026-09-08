// Complete agency census of a pinned archive; does not assign canton membership.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { activeServices, rowsFromArchive } from '@motionstudies/data/gtfs'

const [archive, dateList, output] = process.argv.slice(2)
assert(archive && dateList && output,
  'Usage: node scripts/audit-swiss-transit-agencies.mjs ARCHIVE YYYY-MM-DD,YYYY-MM-DD OUTPUT.json')
const dates = dateList.split(',')
assert(dates.length && dates.every(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))
assert.equal(new Set(dates).size, dates.length)
const files = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n')
const feed = []
for await (const row of rowsFromArchive(archive, 'feed_info.txt')) feed.push(row)
assert.equal(feed.length, 1)
for (const date of dates) {
  const value = date.replaceAll('-', '')
  assert(value >= feed[0].feed_start_date && value <= feed[0].feed_end_date)
}
const services = await Promise.all(dates.map(date => activeServices(archive, date)))
const agencies = new Map()
for await (const row of rowsFromArchive(archive, 'agency.txt')) {
  assert(!agencies.has(row.agency_id))
  agencies.set(row.agency_id, { id: row.agency_id, name: row.agency_name,
    sourceUrl: row.agency_url, sourceTimezone: row.agency_timezone,
    routeRecords: 0, routeTypes: new Set(),
    days: dates.map(date => ({ date, routes: new Set(), tripRecords: 0, frequencyTemplates: new Set(), frequencyIntervals: 0 })) })
}
const routes = new Map()
for await (const row of rowsFromArchive(archive, 'routes.txt')) {
  assert(!routes.has(row.route_id))
  assert(agencies.has(row.agency_id), `Unknown agency ${row.agency_id}`)
  routes.set(row.route_id, row.agency_id)
  const agency = agencies.get(row.agency_id)
  agency.routeRecords++
  agency.routeTypes.add(Number(row.route_type))
}
const trips = new Map()
let tripRecords = 0
for await (const row of rowsFromArchive(archive, 'trips.txt')) {
  assert(!trips.has(row.trip_id))
  assert(routes.has(row.route_id), `Unknown route ${row.route_id}`)
  const agency = agencies.get(routes.get(row.route_id))
  const active = services.map(service => service.has(row.service_id))
  trips.set(row.trip_id, { agency, active })
  tripRecords++
  active.forEach((yes, index) => {
    if (!yes) return
    agency.days[index].tripRecords++
    agency.days[index].routes.add(row.route_id)
  })
}
if (files.includes('frequencies.txt')) {
  for await (const row of rowsFromArchive(archive, 'frequencies.txt')) {
    const trip = trips.get(row.trip_id)
    assert(trip, `Unknown frequency trip ${row.trip_id}`)
    trip.active.forEach((yes, index) => {
      if (!yes) return
      trip.agency.days[index].frequencyIntervals++
      trip.agency.days[index].frequencyTemplates.add(row.trip_id)
    })
  }
}
const hash = createHash('sha256')
for await (const bytes of createReadStream(archive)) hash.update(bytes)
const records = [...agencies.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })).map(agency => ({
  ...agency, routeTypes: [...agency.routeTypes].sort((a, b) => a - b),
  days: agency.days.map(({ date, routes: activeRoutes, tripRecords: activeTrips, frequencyTemplates, frequencyIntervals }) => ({
    date, activeRouteRecords: activeRoutes.size, activeTripRecords: activeTrips,
    activeNonFrequencyTripRecords: activeTrips - frequencyTemplates.size,
    activeFrequencyTemplates: frequencyTemplates.size, activeFrequencyIntervals: frequencyIntervals,
  })),
}))
const report = { schemaVersion: 1, feed: feed[0], sourceSha256: hash.digest('hex'),
  sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020',
  method: 'Every agency and route in the archive; calendar plus exceptions on each date. Includes foreign and publication-only records. No stop_times, civil-day clipping, geography, geometry join or headway expansion.',
  limits: 'Agency IDs are feed identities, not a verified list of legal operators or regional membership. URLs and names are preserved verbatim and may be generic or unexpected. Zero active trips means inactive on these dates, not absent year-round.',
  files, totals: { agencies: records.length, routeRecords: routes.size, tripRecords,
    days: dates.map((date, index) => ({ date,
      activeAgencies: records.filter(a => a.days[index].activeTripRecords > 0).length,
      activeRouteRecords: records.reduce((sum, a) => sum + a.days[index].activeRouteRecords, 0),
      activeTripRecords: records.reduce((sum, a) => sum + a.days[index].activeTripRecords, 0),
      activeFrequencyTemplates: records.reduce((sum, a) => sum + a.days[index].activeFrequencyTemplates, 0),
    })) }, agencies: records }
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report.totals, null, 2))
