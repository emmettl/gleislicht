import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import {
  activeServices,
  parseGtfsTime,
  rowsFromArchive,
} from './ingest-gtfs.mjs'

const SOURCE_URL = 'https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip'
const DATASET_URL =
  'https://prim.iledefrance-mobilites.fr/fr/jeux-de-donnees/offre-horaires-tc-gtfs-idfm'
const LICENSE_URL =
  'https://www.iledefrance-mobilites.fr/medias/portail-idfm/4dc136f7-df23-449b-9670-24bc5254a706_RAA138.pdf'
const STUDIES = {
  opening: {
    output: 'fixtures/idfm/correspondances-morning.json',
    label: 'Métro 1 / RER A scale proof',
    routes: [
      ['IDFM:C01371', { name: 'Métro 1', category: 'metro', mode: 'subway' }],
      ['IDFM:C01742', { name: 'RER A', category: 'regional-express', mode: 'rail' }],
    ],
  },
  'central-cross': {
    output: 'fixtures/idfm/correspondances-central-cross-morning.json',
    label: 'Métro 4 / Métro 14 / RER B central-cross layer',
    routes: [
      ['IDFM:C01374', { name: 'Métro 4', category: 'metro', mode: 'subway' }],
      ['IDFM:C01384', { name: 'Métro 14', category: 'metro', mode: 'subway' }],
      ['IDFM:C01743', { name: 'RER B', category: 'regional-express', mode: 'rail' }],
    ],
  },
}

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function requiredArgument(name) {
  const value = argument(name)
  if (!value) throw new Error(`Missing --${name}`)
  return value
}

function simplify(points, minimumDistance = 0.00018) {
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
    const dx =
      (point[0] - stop.longitude) * Math.cos((stop.latitude * Math.PI) / 180)
    const dy = point[1] - stop.latitude
    const candidate = dx * dx + dy * dy
    if (candidate < distance) {
      distance = candidate
      nearest = index
    }
  })
  return nearest
}

function labelRank(name) {
  if (/Châtelet|La Défense|Nation|Gare de Lyon|Charles de Gaulle|Gare du Nord|Saint-Lazare|Montparnasse/i.test(name)) {
    return 1
  }
  if (/Vincennes|Saint-Germain|Marne-la-Vallée|Boissy|Cergy|Poissy|Bagneux|Clignancourt|Aéroport|Saint-Rémy|Robinson|Orly|Saint-Denis Pleyel/i.test(name)) {
    return 2
  }
  return 3
}

const archive = resolve(requiredArgument('archive'))
const studyId = argument('study', 'opening')
const study = STUDIES[studyId]
if (!study) {
  throw new Error(`Unknown --study ${studyId}; expected ${Object.keys(STUDIES).join(' or ')}`)
}
const ROUTES = new Map(study.routes)
const output = resolve(
  argument('output', study.output),
)
const serviceDate = argument('service-date', '2026-09-04')
const retrievedAt = requiredArgument('retrieved-at')
const windowStart = parseGtfsTime(argument('window-start', '07:00:00'))
const windowEnd = parseGtfsTime(argument('window-end', '09:00:00'))
const focusTime = parseGtfsTime(argument('focus', '08:00:00'))
const archiveBytes = await readFile(archive)
const archiveSha256 = createHash('sha256').update(archiveBytes).digest('hex')
const services = await activeServices(archive, serviceDate)

const routeRecords = new Map()
for await (const row of rowsFromArchive(archive, 'routes.txt')) {
  const authored = ROUTES.get(row.route_id)
  if (!authored) continue
  routeRecords.set(row.route_id, {
    ...authored,
    id: row.route_id,
    shortName: row.route_short_name,
    sourceColor: row.route_color,
  })
}
if (routeRecords.size !== ROUTES.size) {
  throw new Error(`Resolved ${routeRecords.size}/${ROUTES.size} study routes`)
}

const trips = new Map()
for await (const row of rowsFromArchive(archive, 'trips.txt')) {
  if (!routeRecords.has(row.route_id) || !services.has(row.service_id)) continue
  trips.set(row.trip_id, {
    id: row.trip_id,
    routeId: row.route_id,
    headsign: row.trip_headsign,
    shortName: row.trip_short_name,
    directionId: row.direction_id,
    shapeId: row.shape_id,
    calls: [],
  })
}

for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
  const trip = trips.get(row.trip_id)
  if (!trip) continue
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
  throw new Error(`Resolved ${stopRecords.size}/${usedStopIds.size} study stops`)
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
  const route = routeRecords.get(trip.routeId)
  const destination = stopRecords.get(trip.calls.at(-1).stopId)?.name
  const pathSegments = []
  for (let index = 1; index < trip.calls.length; index += 1) {
    const from = trip.calls[index - 1]
    const to = trip.calls[index]
    const fromIndex = stopIndex.get(from.stopId)
    const toIndex = stopIndex.get(to.stopId)
    const key = `${trip.routeId}:${Math.min(fromIndex, toIndex)}:${Math.max(fromIndex, toIndex)}`
    let edgeIndex = edgeIndexByKey.get(key)
    if (edgeIndex === undefined) {
      const pathIndex = paths.length
      paths.push(
        pathForSegment(
          stopRecords.get(from.stopId),
          stopRecords.get(to.stopId),
          trip.shapeId,
        ),
      )
      edgeIndex = edges.length
      edges.push([fromIndex, toIndex])
      edgePaths.push(pathIndex)
      edgeIndexByKey.set(key, edgeIndex)
    }
    pathSegments.push(edgePaths[edgeIndex])
  }
  return {
    id: trip.id,
    route: route.name,
    headsign: destination || trip.headsign,
    shortName:
      route.category === 'regional-express'
        ? trip.shortName || trip.headsign || route.shortName
        : route.shortName,
    category: route.category,
    mode: route.mode,
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

const routeNamesByStopId = new Map()
for (const trip of compiledTrips) {
  for (const call of trip.stops) {
    const stopId = orderedStops[call[0]].id
    const names = routeNamesByStopId.get(stopId) ?? new Set()
    names.add(trip.route)
    routeNamesByStopId.set(stopId, names)
  }
}
const interchangeGroups = new Map()
const interchangeName = (fromName, toName) => {
  if (/Châtelet/.test(fromName) && /Châtelet/.test(toName)) {
    return 'Châtelet–Les Halles'
  }
  if (fromName !== toName) return undefined
  return new Set([
    'La Défense',
    'Charles de Gaulle - Étoile',
    'Gare de Lyon',
    'Nation',
  ]).has(fromName)
    ? fromName
    : undefined
}
for await (const row of rowsFromArchive(archive, 'transfers.txt')) {
  const fromStop = stopRecords.get(row.from_stop_id)
  const toStop = stopRecords.get(row.to_stop_id)
  if (!fromStop || !toStop || row.transfer_type !== '2') continue
  const fromRoutes = routeNamesByStopId.get(fromStop.id)
  const toRoutes = routeNamesByStopId.get(toStop.id)
  if (
    !fromRoutes ||
    !toRoutes ||
    [...fromRoutes].some((route) => toRoutes.has(route))
  ) continue
  const name = interchangeName(fromStop.name, toStop.name)
  if (!name) continue
  const group = interchangeGroups.get(name) ?? { name, stopIds: new Set(), links: [] }
  group.stopIds.add(fromStop.id)
  group.stopIds.add(toStop.id)
  group.links.push({
    fromStopId: fromStop.id,
    toStopId: toStop.id,
    minimumTransferSeconds: Number(row.min_transfer_time),
  })
  interchangeGroups.set(name, group)
}
const interchangeComplexes = [...interchangeGroups.values()]
  .map((group) => {
    const stops = [...group.stopIds].map((stopId) => stopRecords.get(stopId))
    return {
      id: group.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
      name: group.name,
      longitude:
        stops.reduce((sum, stop) => sum + stop.longitude, 0) / stops.length,
      latitude: stops.reduce((sum, stop) => sum + stop.latitude, 0) / stops.length,
      stopIds: [...group.stopIds].sort(),
      links: group.links.sort((first, second) =>
        first.fromStopId.localeCompare(second.fromStopId) ||
        first.toStopId.localeCompare(second.toStopId),
      ),
    }
  })
  .sort((first, second) => first.longitude - second.longitude)

const longitudes = orderedStops.map((stop) => stop.longitude)
const latitudes = orderedStops.map((stop) => stop.latitude)
const routeCounts = Object.fromEntries(
  [...routeRecords.values()].map((route) => [
    route.name,
    compiledTrips.filter((trip) => trip.route === route.name).length,
  ]),
)
const result = {
  metadata: {
    publisher: 'Île-de-France Mobilités',
    feedVersion: `sha256:${archiveSha256.slice(0, 12)}`,
    serviceDate,
    windowStart,
    windowEnd,
    focusTime,
    sourceUrl: SOURCE_URL,
    sourceSha256: archiveSha256,
    retrievedAt,
    license: 'Licence Mobilité (February 2021)',
    licenseUrl: LICENSE_URL,
    model: `Scheduled GTFS shape interpolation / ${study.label} / not realtime`,
    note: `A bounded ${ROUTES.size}-line layer using the full published patterns active in the study window. Route colours in the source feed are ${[...routeRecords.values()].map((route) => `${route.name} #${route.sourceColor}`).join(', ')}; the visual treatment remains locally authored. Dataset record: ${DATASET_URL}`,
    modes: ['subway', 'rail'],
    localRouteIds: [...ROUTES.keys()],
    interchangeStudy: {
      model: `Published GTFS transfer links within the ${study.label}. Minimum transfer time describes scheduled opportunity, not observed passenger movement.`,
      complexes: interchangeComplexes,
    },
    geometry: {
      publisher: 'Île-de-France Mobilités',
      feedVersion: `sha256:${archiveSha256.slice(0, 12)}`,
      sourceUrl: SOURCE_URL,
      sourceSha256: archiveSha256,
      productUrl: DATASET_URL,
      model: 'Trip shape sections snapped to scheduled stops',
      matchedSegments: edgePaths.length,
      totalSegments: edgePaths.length,
      resolvedStops: orderedStops.length,
      totalStops: usedStopIds.size,
      simplificationToleranceMetres: 15,
    },
  },
  bounds: {
    minLongitude: Math.min(...longitudes) - 0.025,
    minLatitude: Math.min(...latitudes) - 0.018,
    maxLongitude: Math.max(...longitudes) + 0.025,
    maxLatitude: Math.max(...latitudes) + 0.018,
  },
  stops: orderedStops.map((stop) => [
    stop.longitude,
    stop.latitude,
    stop.name,
    '',
    stop.id,
    labelRank(stop.name),
  ]),
  edges,
  paths,
  edgePaths,
  trains: compiledTrips,
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(result))
console.log(
  `Wrote ${basename(output)}: ${Object.entries(routeCounts).map(([name, count]) => `${count} ${name}`).join(' + ')} trips, ` +
    `${orderedStops.length} stops and ${paths.length} shaped segments.`,
)
