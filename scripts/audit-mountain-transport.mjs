import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { activeServices, parseGtfsTime, rowsFromArchive, transportModeForRouteType } from '@motionstudies/data/gtfs'

const SOURCE_URL = 'https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/'

export function auditedMode(routeType) {
  if (Number(routeType) === 116) return 'cogwheel'
  const mode = transportModeForRouteType(routeType)
  return ['ferry', 'cableway', 'funicular'].includes(mode) ? mode : undefined
}

/** Chunk overlaps describe one service, not additional departures. */
export function uniqueDayTrains(chunks) {
  const trains = new Map()
  for (const chunk of chunks) for (const train of chunk.trains) {
    if (trains.has(train.id)) assert.deepEqual(trains.get(train.id), train, `Conflicting trip ${train.id}`)
    trains.set(train.id, train)
  }
  return trains
}

export function summarizeRoute(route, sourceTrips, frequencies, nationalTrains) {
  const scheduled = sourceTrips.filter(trip => !frequencies.has(trip.id) && trip.calls >= 2 && trip.start < 86400 && trip.end >= 0)
  const templates = sourceTrips.filter(trip => frequencies.has(trip.id))
  const matched = scheduled.flatMap(trip => nationalTrains.has(trip.id) ? [nationalTrains.get(trip.id)] : [])
  const segmentCount = matched.reduce((count, trip) => count + trip.stops.length - 1, 0)
  const matchedSegmentCount = matched.reduce((count, trip) => count + (trip.pathSegments ?? []).filter(index => Number.isInteger(index) && index >= 0).length, 0)
  return {
    ...route,
    activeTripRecords: sourceTrips.length,
    scheduledTrips: scheduled.length,
    frequencyTemplates: templates.length,
    frequencyIntervals: templates.reduce((count, trip) => count + frequencies.get(trip.id).length, 0),
    operatingStart: scheduled.length ? Math.min(...scheduled.map(trip => trip.start)) : null,
    operatingEnd: scheduled.length ? Math.max(...scheduled.map(trip => trip.end)) : null,
    nationalRailTrips: matched.length,
    missingNationalRailTrips: route.mode === 'cogwheel' ? scheduled.filter(trip => !nationalTrains.has(trip.id)).map(trip => trip.id) : null,
    nationalGeometry: { matchedSegments: matchedSegmentCount, totalSegments: segmentCount },
    categories: [...new Set(matched.map(trip => trip.category))].sort(),
  }
}

export async function auditMountainTransport({ archive, manifestPath }) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const feedRows = []
  for await (const row of rowsFromArchive(archive, 'feed_info.txt')) feedRows.push(row)
  assert.equal(feedRows[0]?.feed_version, manifest.metadata.feedVersion, 'Source archive and national timetable feed versions differ')
  assert.equal(manifest.metadata.windowStart, 0)
  assert.equal(manifest.metadata.windowEnd, 86400)
  const chunks = []
  let nextStart = 0
  for (const descriptor of manifest.chunks) {
    assert.equal(descriptor.windowStart, nextStart, 'National day has a gap')
    const bytes = await readFile(resolve(dirname(manifestPath), descriptor.path))
    // The committed pre-integrity manifest omits both fields. New builds supply them.
    if (descriptor.bytes !== undefined || descriptor.sha256 !== undefined) {
      assert.equal(bytes.length, descriptor.bytes)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), descriptor.sha256)
    }
    const chunk = JSON.parse(bytes)
    assert.equal(chunk.windowStart, descriptor.windowStart)
    assert.equal(chunk.windowEnd, descriptor.windowEnd)
    assert.equal(chunk.trains.length, descriptor.tripCount)
    chunks.push(chunk)
    nextStart = descriptor.windowEnd
  }
  assert.equal(nextStart, 86400)
  const nationalTrains = uniqueDayTrains(chunks)
  assert.equal(nationalTrains.size, manifest.tripCount)
  for (const train of nationalTrains.values()) {
    assert(train.stops.every(([index]) => Number.isInteger(index) && manifest.stops[index]), `Missing stop in ${train.id}`)
    if (train.pathSegments) {
      assert.equal(train.pathSegments.length, train.stops.length - 1)
      assert(train.pathSegments.every(index => index === null || (Number.isInteger(index) && index >= 0 && manifest.paths?.[index])), `Missing path in ${train.id}`)
    }
  }
  const agencies = new Map()
  for await (const row of rowsFromArchive(archive, 'agency.txt')) agencies.set(row.agency_id, row.agency_name)
  const routes = new Map()
  for await (const row of rowsFromArchive(archive, 'routes.txt')) {
    const mode = auditedMode(row.route_type)
    if (mode) routes.set(row.route_id, {
      id: row.route_id, name: row.route_short_name || row.route_long_name,
      agencyId: row.agency_id, operator: agencies.get(row.agency_id) ?? row.agency_id,
      routeType: Number(row.route_type), routeDescription: row.route_desc, mode,
    })
  }
  const services = await activeServices(archive, manifest.metadata.serviceDate)
  const trips = new Map()
  for await (const row of rowsFromArchive(archive, 'trips.txt')) {
    if (routes.has(row.route_id) && services.has(row.service_id)) trips.set(row.trip_id, {
      id: row.trip_id, routeId: row.route_id, calls: 0, start: Infinity, end: -Infinity,
    })
  }
  const frequencies = new Map()
  for await (const row of rowsFromArchive(archive, 'frequencies.txt')) {
    if (!trips.has(row.trip_id)) continue
    const intervals = frequencies.get(row.trip_id) ?? []
    intervals.push({ start: row.start_time, end: row.end_time, headwaySeconds: Number(row.headway_secs), exactTimes: Number(row.exact_times || 0) })
    frequencies.set(row.trip_id, intervals)
  }
  for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
    const trip = trips.get(row.trip_id)
    if (!trip) continue
    const arrival = parseGtfsTime(row.arrival_time || row.departure_time)
    const departure = parseGtfsTime(row.departure_time || row.arrival_time)
    if (!Number.isFinite(arrival) || !Number.isFinite(departure)) continue
    trip.calls++
    trip.start = Math.min(trip.start, departure)
    trip.end = Math.max(trip.end, arrival)
  }
  const byRoute = new Map()
  for (const trip of trips.values()) {
    const list = byRoute.get(trip.routeId) ?? []
    list.push(trip)
    byRoute.set(trip.routeId, list)
  }
  const summaries = [...routes.values()].map(route => summarizeRoute(route, byRoute.get(route.id) ?? [], frequencies, nationalTrains))
  const metadata = {
    feedVersion: manifest.metadata.feedVersion, serviceDate: manifest.metadata.serviceDate,
    publisher: feedRows[0].feed_publisher_name, sourceUrl: SOURCE_URL,
    classification: 'Swiss GTFS route_type 116; excludes other Alpine railways, cableways and funiculars',
  }
  const archiveHash = createHash('sha256')
  for await (const bytes of createReadStream(archive)) archiveHash.update(bytes)
  metadata.sourceSha256 = archiveHash.digest('hex')
  const catalogue = { metadata, routes: Object.fromEntries([...routes].filter(([, route]) => route.mode === 'cogwheel')), trips: {} }
  for (const trip of trips.values()) {
    if (catalogue.routes[trip.routeId] && nationalTrains.has(trip.id) && !frequencies.has(trip.id)) catalogue.trips[trip.id] = trip.routeId
  }
  const report = {
    metadata,
    nationalManifestSha256: createHash('sha256').update(await readFile(manifestPath)).digest('hex'),
    scope: 'Source routes for cogwheel, cableway, funicular and ferry; active service records on this date compared only with the national rail day. Non-rail absence is expected, not a claim about regional coverage. Frequency templates are not counted as scheduled departures. Geometry counts reflect existing inferred FOT matches, not a validation of the physical alignments. Other Alpine railways are outside this source-type audit.',
    routes: summaries,
  }
  return { catalogue, report }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name, fallback) => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : fallback
  if (process.argv.includes('--help')) console.log('Usage: npm run data:mountains -- --archive /path/feed.zip [--manifest public/data/swiss-rail-day-manifest.json] [--output public/data/swiss-cogwheel-catalogue.json] [--report data/mountain-transport-audit.json]')
  else {
    assert(arg('archive'), 'Provide --archive with the matching official Swiss GTFS archive')
    const { catalogue, report } = await auditMountainTransport({ archive: resolve(arg('archive')), manifestPath: resolve(arg('manifest', 'public/data/swiss-rail-day-manifest.json')) })
    await writeFile(arg('output', 'public/data/swiss-cogwheel-catalogue.json'), JSON.stringify(catalogue) + '\n')
    await writeFile(arg('report', 'data/mountain-transport-audit.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(`Audited ${report.routes.length} source routes; indexed ${Object.keys(catalogue.trips).length} national cogwheel services for ${catalogue.metadata.serviceDate}.`)
  }
}
