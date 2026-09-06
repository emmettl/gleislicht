import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import {
  activeServices,
  parseGtfsTime,
  rowsFromArchive,
} from './ingest-gtfs.mjs'

const SOURCE_URL = 'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip'
const TERMS_URL = 'https://www.mta.info/developers/terms-and-conditions'
const CORRIDOR_STOPS = new Set(
  Array.from({ length: 20 }, (_, index) => String(621 + index)),
)
const ROUTE_IDS = new Set(['4', '5', '6'])

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function requiredArgument(name) {
  const value = argument(name)
  if (!value) throw new Error(`Missing --${name}`)
  return value
}

function canonicalStopId(stopId) {
  return stopId.replace(/[NS]$/, '')
}

function simplify(points, minimumDistance = 0.00012) {
  if (points.length <= 2) return points
  const kept = [points[0]]
  let previous = points[0]
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]
    const dx = point[0] - previous[0]
    const dy = point[1] - previous[1]
    if (dx * dx + dy * dy < minimumDistance * minimumDistance) continue
    kept.push(point)
    previous = point
  }
  kept.push(points.at(-1))
  return kept
}

function nearestPointIndex(points, stop) {
  let nearest = 0
  let distance = Number.POSITIVE_INFINITY
  points.forEach((point, index) => {
    const dx = (point[0] - stop.longitude) * Math.cos((stop.latitude * Math.PI) / 180)
    const dy = point[1] - stop.latitude
    const candidate = dx * dx + dy * dy
    if (candidate < distance) {
      distance = candidate
      nearest = index
    }
  })
  return nearest
}

const archive = resolve(requiredArgument('archive'))
const output = resolve(
  argument('output', 'fixtures/mta/local-express-lexington-morning.json'),
)
const serviceDate = argument('service-date', '2026-09-04')
const retrievedAt = requiredArgument('retrieved-at')
const windowStart = parseGtfsTime(argument('window-start', '07:00:00'))
const windowEnd = parseGtfsTime(argument('window-end', '09:00:00'))
const focusTime = parseGtfsTime(argument('focus', '08:00:00'))
const archiveBytes = await readFile(archive)
const archiveSha256 = createHash('sha256').update(archiveBytes).digest('hex')
const services = await activeServices(archive, serviceDate)

let feedInfo
for await (const row of rowsFromArchive(archive, 'feed_info.txt')) {
  feedInfo = row
  break
}
if (!feedInfo) throw new Error('MTA feed_info.txt is empty')

const routes = new Map()
for await (const row of rowsFromArchive(archive, 'routes.txt')) {
  if (!ROUTE_IDS.has(row.route_id)) continue
  routes.set(row.route_id, {
    id: row.route_id,
    shortName: row.route_short_name,
    longName: row.route_long_name,
    color: row.route_color,
    servicePattern: row.route_long_name.toLowerCase().includes('express')
      ? 'express'
      : 'local',
  })
}

const trips = new Map()
for await (const row of rowsFromArchive(archive, 'trips.txt')) {
  if (!routes.has(row.route_id) || !services.has(row.service_id)) continue
  trips.set(row.trip_id, {
    id: row.trip_id,
    routeId: row.route_id,
    headsign: row.trip_headsign,
    directionId: row.direction_id,
    shapeId: row.shape_id,
    calls: [],
  })
}

for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
  const trip = trips.get(row.trip_id)
  if (!trip || !CORRIDOR_STOPS.has(canonicalStopId(row.stop_id))) continue
  trip.calls.push({
    stopId: row.stop_id,
    arrival: parseGtfsTime(row.arrival_time),
    departure: parseGtfsTime(row.departure_time),
    sequence: Number(row.stop_sequence),
  })
}

const selectedTrips = [...trips.values()]
  .map((trip) => ({
    ...trip,
    calls: trip.calls.sort((first, second) => first.sequence - second.sequence),
  }))
  .filter(
    (trip) =>
      trip.calls.length >= 2 &&
      trip.calls[0].arrival <= windowEnd &&
      trip.calls.at(-1).departure >= windowStart,
  )

const usedStopIds = new Set(
  selectedTrips.flatMap((trip) => trip.calls.map((call) => call.stopId)),
)
const stopRecords = new Map()
for await (const row of rowsFromArchive(archive, 'stops.txt')) {
  if (!usedStopIds.has(row.stop_id)) continue
  stopRecords.set(row.stop_id, {
    id: row.stop_id,
    name: row.stop_name,
    latitude: Number(row.stop_lat),
    longitude: Number(row.stop_lon),
  })
}
if (stopRecords.size !== usedStopIds.size) {
  throw new Error(`Resolved ${stopRecords.size}/${usedStopIds.size} corridor stops`)
}

const shapeIds = new Set(selectedTrips.map((trip) => trip.shapeId))
const shapes = new Map()
for await (const row of rowsFromArchive(archive, 'shapes.txt')) {
  if (!shapeIds.has(row.shape_id)) continue
  const points = shapes.get(row.shape_id) ?? []
  points.push({
    sequence: Number(row.shape_pt_sequence),
    coordinate: [Number(row.shape_pt_lon), Number(row.shape_pt_lat)],
  })
  shapes.set(row.shape_id, points)
}
for (const [shapeId, points] of shapes) {
  shapes.set(
    shapeId,
    points
      .sort((first, second) => first.sequence - second.sequence)
      .map(({ coordinate }) => coordinate),
  )
}

const orderedStops = [...stopRecords.values()].sort((first, second) =>
  first.id.localeCompare(second.id),
)
const stopIndex = new Map(orderedStops.map((stop, index) => [stop.id, index]))
const paths = []
const edges = []
const edgePaths = []
const edgeIndexByKey = new Map()

function pathForSegment(fromStop, toStop, shapeId) {
  const shape = shapes.get(shapeId)
  if (!shape?.length) {
    return [
      [fromStop.longitude, fromStop.latitude],
      [toStop.longitude, toStop.latitude],
    ]
  }
  const fromIndex = nearestPointIndex(shape, fromStop)
  const toIndex = nearestPointIndex(shape, toStop)
  const section =
    fromIndex <= toIndex
      ? shape.slice(fromIndex, toIndex + 1)
      : shape.slice(toIndex, fromIndex + 1).reverse()
  return simplify([
    [fromStop.longitude, fromStop.latitude],
    ...section,
    [toStop.longitude, toStop.latitude],
  ])
}

const compiledTrips = selectedTrips.map((trip) => {
  const route = routes.get(trip.routeId)
  const pathSegments = []
  for (let index = 1; index < trip.calls.length; index += 1) {
    const from = trip.calls[index - 1]
    const to = trip.calls[index]
    const fromIndex = stopIndex.get(from.stopId)
    const toIndex = stopIndex.get(to.stopId)
    const key =
      fromIndex < toIndex ? `${fromIndex}:${toIndex}` : `${toIndex}:${fromIndex}`
    let edgeIndex = edgeIndexByKey.get(key)
    if (edgeIndex === undefined) {
      const fromStop = stopRecords.get(from.stopId)
      const toStop = stopRecords.get(to.stopId)
      const pathIndex = paths.length
      paths.push(pathForSegment(fromStop, toStop, trip.shapeId))
      edgeIndex = edges.length
      edges.push([fromIndex, toIndex])
      edgePaths.push(pathIndex)
      edgeIndexByKey.set(key, edgeIndex)
    }
    pathSegments.push(edgePaths[edgeIndex])
  }
  return {
    id: trip.id,
    route: route.longName,
    headsign: trip.headsign,
    shortName: route.shortName,
    category: 'metro',
    mode: 'subway',
    servicePattern: route.servicePattern,
    start: trip.calls[0].arrival,
    end: trip.calls.at(-1).departure,
    stops: trip.calls.map((call) => [
      stopIndex.get(call.stopId),
      call.arrival,
      call.departure,
    ]),
    pathSegments,
  }
})

const passEvents = []
const localTrips = compiledTrips.filter((trip) => trip.servicePattern === 'local')
const expressTrips = compiledTrips.filter(
  (trip) => trip.servicePattern === 'express',
)
for (const express of expressTrips) {
  for (const local of localTrips) {
    const localCalls = new Map(
      local.stops.map((call) => [orderedStops[call[0]].id, call]),
    )
    const shared = express.stops.flatMap((call) => {
      const sourceStopId = orderedStops[call[0]].id
      const localCall = localCalls.get(sourceStopId)
      return localCall
        ? [{ sourceStopId, express: call, local: localCall }]
        : []
    })
    for (let index = 1; index < shared.length; index += 1) {
      const from = shared[index - 1]
      const to = shared[index]
      const startDeltaSeconds = from.express[1] - from.local[1]
      const endDeltaSeconds = to.express[1] - to.local[1]
      if (startDeltaSeconds < 0 || endDeltaSeconds >= 0) continue
      const progress =
        startDeltaSeconds / Math.max(1, startDeltaSeconds - endDeltaSeconds)
      passEvents.push({
        id: `${express.id}:${local.id}:${from.sourceStopId}:${to.sourceStopId}`,
        localTrainId: local.id,
        expressTrainId: express.id,
        fromStopId: from.sourceStopId,
        toStopId: to.sourceStopId,
        time: Math.round(
          from.express[1] + (to.express[1] - from.express[1]) * progress,
        ),
        startDeltaSeconds,
        endDeltaSeconds,
      })
    }
  }
}
passEvents.sort((first, second) => first.time - second.time || first.id.localeCompare(second.id))

const longitudes = orderedStops.map((stop) => stop.longitude)
const latitudes = orderedStops.map((stop) => stop.latitude)
const result = {
  metadata: {
    publisher: 'MTA New York City Transit',
    feedVersion: feedInfo.feed_version,
    serviceDate,
    windowStart,
    windowEnd,
    focusTime,
    sourceUrl: SOURCE_URL,
    sourceSha256: archiveSha256,
    retrievedAt,
    license: 'MTA data feed terms and conditions',
    licenseUrl: TERMS_URL,
    model: 'Scheduled GTFS shape interpolation / local-express corridor proof / not realtime',
    note: 'Routes 4 and 5 express and route 6 local between Brooklyn Bridge-City Hall and 125 St. Service-pattern identity comes from MTA route metadata; this artifact does not claim a physical track assignment or an observed overtake.',
    modes: ['subway'],
    localRouteIds: [...ROUTE_IDS],
    servicePatternStudy: {
      model: 'Scheduled order reversal between a route 6 local and a route 4/5 express at consecutive shared stops; operational track and observed passing moment are not claimed.',
      localTrips: localTrips.length,
      expressTrips: expressTrips.length,
      passEvents,
    },
    geometry: {
      publisher: 'MTA New York City Transit',
      feedVersion: feedInfo.feed_version,
      sourceUrl: SOURCE_URL,
      sourceSha256: archiveSha256,
      model: 'Trip shape sections snapped to scheduled directional stops',
      matchedSegments: edgePaths.length,
      totalSegments: edgePaths.length,
    },
  },
  bounds: {
    minLongitude: Math.min(...longitudes) - 0.01,
    minLatitude: Math.min(...latitudes) - 0.01,
    maxLongitude: Math.max(...longitudes) + 0.01,
    maxLatitude: Math.max(...latitudes) + 0.01,
  },
  stops: orderedStops.map((stop) => [
    stop.longitude,
    stop.latitude,
    stop.name,
    stop.id.endsWith('N') ? 'N' : 'S',
    stop.id,
    CORRIDOR_STOPS.has(stop.id.replace(/[NS]$/, '')) ? 1 : 2,
  ]),
  edges,
  paths,
  edgePaths,
  trains: compiledTrips,
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(result))
console.log(
  `Wrote ${basename(output)}: ${localTrips.length} local + ${expressTrips.length} express trips, ` +
    `${passEvents.length} scheduled pass events, ${orderedStops.length} directional stops and ` +
    `${paths.length} shaped segments.`,
)
