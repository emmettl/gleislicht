// Source-presence survey only: operator samples are not regional boundaries.
// Counts are calendar-active GTFS records, not validated civil-day movements.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { activeServices, rowsFromArchive } from '@motionstudies/data/gtfs'

const [archive, date, output] = process.argv.slice(2)
assert(archive && /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') && output,
  'Usage: node scripts/audit-regional-network-survey.mjs ARCHIVE YYYY-MM-DD OUTPUT.json')

const samples = [
  ['basel', ['823', '37']],
  ['bern', ['827', '88', '850']],
  ['luzern', ['820', '86']],
  ['st-gallen', ['885', '22', '744', '65']],
  ['ticino', ['955', '3955', '47', '49', '817', '858']],
  ['graubuenden', ['72', '766', '815']],
  ['fribourg', ['53', '834', '3004']],
  ['neuchatel', ['44', '73', '153', '792', '166', '15300']],
]
const wanted = new Set(samples.flatMap(([, ids]) => ids))
const agencies = new Map()
for await (const row of rowsFromArchive(archive, 'agency.txt')) {
  if (wanted.has(row.agency_id)) agencies.set(row.agency_id, {
    id: row.agency_id, name: row.agency_name, routeRecords: 0,
    activeTripRecords: 0, activeFrequencyTemplates: 0, activeFrequencyIntervals: 0,
    routeTypes: new Set(), activeRoutes: new Set(),
  })
}
for (const id of wanted) assert(agencies.has(id), `Missing sample agency ${id}; review the survey selection`)
const routes = new Map()
for await (const row of rowsFromArchive(archive, 'routes.txt')) {
  const agency = agencies.get(row.agency_id)
  if (!agency) continue
  assert(!routes.has(row.route_id), `Duplicate route ${row.route_id}`)
  routes.set(row.route_id, row.agency_id)
  agency.routeRecords++
  agency.routeTypes.add(Number(row.route_type))
}
const services = await activeServices(archive, date)
const trips = new Map()
for await (const row of rowsFromArchive(archive, 'trips.txt')) {
  if (!routes.has(row.route_id) || !services.has(row.service_id)) continue
  assert(!trips.has(row.trip_id), `Duplicate trip ${row.trip_id}`)
  const agencyId = routes.get(row.route_id)
  trips.set(row.trip_id, agencyId)
  agencies.get(agencyId).activeTripRecords++
  agencies.get(agencyId).activeRoutes.add(row.route_id)
}
const templates = new Set()
// The surveyed 20260902 archive supplies frequencies.txt. Missing input fails.
for await (const row of rowsFromArchive(archive, 'frequencies.txt')) {
  const agency = agencies.get(trips.get(row.trip_id))
  if (!agency) continue
  agency.activeFrequencyIntervals++
  if (!templates.has(row.trip_id)) agency.activeFrequencyTemplates++
  templates.add(row.trip_id)
}
const feed = []
for await (const row of rowsFromArchive(archive, 'feed_info.txt')) feed.push(row)
assert.equal(feed.length, 1)
const compactDate = date.replaceAll('-', '')
assert(compactDate >= feed[0].feed_start_date && compactDate <= feed[0].feed_end_date,
  'Survey date is outside the declared feed validity')
const hash = createHash('sha256')
for await (const bytes of createReadStream(archive)) hash.update(bytes)
const report = {
  serviceDate: date, feedVersion: feed[0].feed_version, sourceSha256: hash.digest('hex'),
  sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020',
  method: 'Selected agency IDs; calendar.txt plus calendar_dates.txt; distinct route_id and trip_id. Frequency templates remain separate from non-frequency records. No stop_times, spatial clipping, geometry join or frequency expansion.',
  limits: 'Operator samples, not complete networks or study-size estimates. Includes calendar-active records after 24:00. Excludes SBB, BLS, PostAuto and other operators outside the listed samples. Route types describe all sample route records, including inactive routes.',
  samples: samples.map(([region, ids]) => ({
    region,
    agencies: ids.map(id => {
      const { activeRoutes, routeTypes, ...agency } = agencies.get(id)
      return { ...agency, routeTypes: [...routeTypes].sort((a, b) => a - b),
        activeRouteRecords: activeRoutes.size,
        activeNonFrequencyTripRecords: agency.activeTripRecords - agency.activeFrequencyTemplates }
    }),
  })),
}
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
for (const sample of report.samples) console.log(sample.region,
  sample.agencies.reduce((sum, agency) => sum + agency.activeRouteRecords, 0), 'active routes;',
  sample.agencies.reduce((sum, agency) => sum + agency.activeTripRecords, 0), 'active trip records;',
  sample.agencies.reduce((sum, agency) => sum + agency.activeFrequencyTemplates, 0), 'frequency templates')
