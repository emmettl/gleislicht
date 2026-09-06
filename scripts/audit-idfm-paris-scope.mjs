import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  activeServices,
  parseGtfsTime,
  rowsFromArchive,
} from './ingest-gtfs.mjs'

const SOURCE_URL = 'https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip'
const DATASET_URL =
  'https://prim.iledefrance-mobilites.fr/fr/jeux-de-donnees/offre-horaires-tc-gtfs-idfm'
const RER_LINES = new Set(['A', 'B', 'C', 'D', 'E'])

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function requiredArgument(name) {
  const value = argument(name)
  if (!value) throw new Error(`Missing --${name}`)
  return value
}

function routeDisplayName(route) {
  return route.mode === 'metro'
    ? `Métro ${route.shortName}`
    : `RER ${route.shortName}`
}

function summarizeRoutes(routeIds, routeRecords, routeMetrics) {
  const metrics = routeIds.flatMap((routeId) => {
    const route = routeRecords.get(routeId)
    const metric = routeMetrics.get(routeId)
    return route && metric ? [{ route, metric }] : []
  })
  return {
    routeCount: metrics.length,
    tripCount: metrics.reduce((sum, { metric }) => sum + metric.tripCount, 0),
    callCount: metrics.reduce((sum, { metric }) => sum + metric.callCount, 0),
    uniqueStopCount: new Set(
      metrics.flatMap(({ metric }) => [...metric.stopIds]),
    ).size,
  }
}

const archive = resolve(requiredArgument('archive'))
const output = resolve(
  argument('output', 'fixtures/idfm/correspondances-scope-audit.json'),
)
const serviceDate = requiredArgument('service-date')
const retrievedAt = requiredArgument('retrieved-at')
const windowStart = parseGtfsTime(argument('window-start', '07:00:00'))
const windowEnd = parseGtfsTime(argument('window-end', '09:00:00'))
const archiveBytes = await readFile(archive)
const archiveSha256 = createHash('sha256').update(archiveBytes).digest('hex')
const services = await activeServices(archive, serviceDate)

const routeRecords = new Map()
for await (const row of rowsFromArchive(archive, 'routes.txt')) {
  const routeType = Number(row.route_type)
  const mode = routeType === 1
    ? 'metro'
    : routeType === 2 && RER_LINES.has(row.route_short_name)
      ? 'rer'
      : undefined
  if (!mode) continue
  routeRecords.set(row.route_id, {
    id: row.route_id,
    shortName: row.route_short_name,
    mode,
    sourceColor: row.route_color,
  })
}

const trips = new Map()
for await (const row of rowsFromArchive(archive, 'trips.txt')) {
  if (!routeRecords.has(row.route_id) || !services.has(row.service_id)) continue
  trips.set(row.trip_id, {
    routeId: row.route_id,
    firstTime: Number.POSITIVE_INFINITY,
    lastTime: Number.NEGATIVE_INFINITY,
    callCount: 0,
    stopIds: new Set(),
  })
}

for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
  const trip = trips.get(row.trip_id)
  if (!trip) continue
  const arrival = parseGtfsTime(row.arrival_time)
  const departure = parseGtfsTime(row.departure_time)
  if (!Number.isFinite(arrival) || !Number.isFinite(departure)) continue
  trip.firstTime = Math.min(trip.firstTime, arrival)
  trip.lastTime = Math.max(trip.lastTime, departure)
  trip.callCount += 1
  trip.stopIds.add(row.stop_id)
}

const routeMetrics = new Map(
  [...routeRecords.keys()].map((routeId) => [
    routeId,
    { tripCount: 0, callCount: 0, stopIds: new Set() },
  ]),
)
for (const trip of trips.values()) {
  if (
    trip.callCount < 2 ||
    trip.firstTime > windowEnd ||
    trip.lastTime < windowStart
  ) continue
  const metric = routeMetrics.get(trip.routeId)
  metric.tripCount += 1
  metric.callCount += trip.callCount
  trip.stopIds.forEach((stopId) => metric.stopIds.add(stopId))
}

const routes = [...routeRecords.values()]
  .map((route) => {
    const metric = routeMetrics.get(route.id)
    return {
      id: route.id,
      name: routeDisplayName(route),
      mode: route.mode,
      sourceColor: route.sourceColor,
      tripCount: metric.tripCount,
      callCount: metric.callCount,
      uniqueStopCount: metric.stopIds.size,
    }
  })
  .sort(
    (first, second) =>
      first.mode.localeCompare(second.mode) ||
      first.name.localeCompare(second.name, 'fr', { numeric: true }),
  )

const idsByName = new Map(routes.map((route) => [route.name, route.id]))
const layer = (...names) => names.map((name) => idsByName.get(name)).filter(Boolean)
const layers = {
  opening: layer('Métro 1', 'RER A'),
  centralCross: layer('Métro 4', 'Métro 14', 'RER B'),
  metroRemainder: routes
    .filter((route) => route.mode === 'metro')
    .map((route) => route.id)
    .filter((id) => !layer('Métro 1', 'Métro 4', 'Métro 14').includes(id)),
  regionalRemainder: layer('RER C', 'RER D', 'RER E'),
}

const result = {
  metadata: {
    publisher: 'Île-de-France Mobilités',
    datasetUrl: DATASET_URL,
    sourceUrl: SOURCE_URL,
    sourceSha256: archiveSha256,
    retrievedAt,
    serviceDate,
    windowStart,
    windowEnd,
    method:
      'Active GTFS journeys intersecting the study window; counts only, no published runtime artifact.',
  },
  totals: summarizeRoutes([...routeRecords.keys()], routeRecords, routeMetrics),
  routes,
  candidateLayers: Object.fromEntries(
    Object.entries(layers).map(([name, routeIds]) => [
      name,
      {
        routeIds,
        ...summarizeRoutes(routeIds, routeRecords, routeMetrics),
      },
    ]),
  ),
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`)
console.log(
  `Audited ${result.totals.routeCount} Métro/RER lines: ${result.totals.tripCount} trips, ` +
    `${result.totals.uniqueStopCount} unique stops in the study window.`,
)
for (const [name, summary] of Object.entries(result.candidateLayers)) {
  console.log(
    `${name}: ${summary.routeCount} lines, ${summary.tripCount} trips, ` +
      `${summary.uniqueStopCount} stops, ${summary.callCount} calls.`,
  )
}
