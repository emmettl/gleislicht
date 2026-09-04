import { spawn } from 'node:child_process'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { parseCsvLine, transportModeForRouteType } from './ingest-gtfs.mjs'

const DEFAULT_SNAPSHOT = 'public/data/zurich-city-morning.json'
const SOURCE_URL = 'https://data.stadt-zuerich.ch/dataset/vbz_fahrplandaten_gtfs'
const SHAPED_CATEGORIES = new Set(['tram', 'bus'])
const KEY_SEPARATOR = '\u0000'

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function requiredArgument(name) {
  const value = argument(name)
  if (!value) throw new Error(`Missing --${name}. See --help`)
  return value
}

async function* rowsFromArchive(archive, fileName) {
  const child = spawn('unzip', ['-p', archive, fileName], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let standardError = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    standardError += chunk
  })
  const completed = new Promise((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise)
    child.once('close', (code) => {
      if (code === 0) resolvePromise()
      else rejectPromise(new Error(`unzip ${fileName} failed: ${standardError.trim()}`))
    })
  })

  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
  let headers
  for await (const line of lines) {
    if (!headers) {
      headers = parseCsvLine(line.replace(/^\uFEFF/, ''))
      continue
    }
    const values = parseCsvLine(line)
    const row = Object.create(null)
    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })
    yield row
  }
  await completed
}

function compactDate(value) {
  return value.replaceAll('-', '')
}

function weekdayField(date) {
  return [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ][new Date(`${date}T12:00:00Z`).getUTCDay()]
}

async function activeServices(archive, serviceDate) {
  const date = compactDate(serviceDate)
  const weekday = weekdayField(serviceDate)
  const services = new Set()
  for await (const row of rowsFromArchive(archive, 'calendar.txt')) {
    if (row.start_date <= date && row.end_date >= date && row[weekday] === '1') {
      services.add(row.service_id)
    }
  }
  for await (const row of rowsFromArchive(archive, 'calendar_dates.txt')) {
    if (row.date !== date) continue
    if (row.exception_type === '1') services.add(row.service_id)
    if (row.exception_type === '2') services.delete(row.service_id)
  }
  return services
}

function segmentKey(category, route, fromStopId, toStopId) {
  const canonicalStopId = (stopId) => stopId.split('::')[0]
  return [
    category,
    route,
    canonicalStopId(fromStopId),
    canonicalStopId(toStopId),
  ].join(KEY_SEPARATOR)
}

function targetSegments(snapshot) {
  const targets = new Set()
  let totalSegments = 0
  for (const train of snapshot.trains) {
    if (!SHAPED_CATEGORIES.has(train.category)) continue
    for (let index = 1; index < train.stops.length; index += 1) {
      const fromStopId = snapshot.stops[train.stops[index - 1][0]]?.[4]
      const toStopId = snapshot.stops[train.stops[index][0]]?.[4]
      if (!fromStopId || !toStopId) continue
      targets.add(segmentKey(train.category, train.route, fromStopId, toStopId))
      totalSegments += 1
    }
  }
  return { targets, totalSegments }
}

function reportMissingSegments(snapshot, candidates) {
  const coverage = new Map()
  const missing = new Map()
  for (const train of snapshot.trains) {
    if (!SHAPED_CATEGORIES.has(train.category)) continue
    const routeKey = `${train.category} ${train.route}`
    const record = coverage.get(routeKey) ?? { matched: 0, total: 0 }
    for (let index = 1; index < train.stops.length; index += 1) {
      const fromStop = snapshot.stops[train.stops[index - 1][0]]
      const toStop = snapshot.stops[train.stops[index][0]]
      const fromStopId = fromStop?.[4]
      const toStopId = toStop?.[4]
      const key =
        fromStopId && toStopId
          ? segmentKey(train.category, train.route, fromStopId, toStopId)
          : ''
      record.total += 1
      if (key && candidates.has(key)) record.matched += 1
      else {
        const label = `${routeKey}: ${fromStop?.[2]} (${fromStopId}) → ${toStop?.[2]} (${toStopId})`
        missing.set(label, (missing.get(label) ?? 0) + 1)
      }
    }
    coverage.set(routeKey, record)
  }
  const weakestRoutes = [...coverage]
    .map(([route, record]) => ({ route, ...record, rate: record.matched / record.total }))
    .filter(({ rate }) => rate < 0.95)
    .sort((first, second) => first.rate - second.rate || second.total - first.total)
    .slice(0, 12)
  const commonMissing = [...missing]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 12)
  console.log('Weakest route alignment:', weakestRoutes)
  console.log('Most frequent missing segments:', commonMissing)
}

async function matchingTrips(archive, services, targets) {
  const routeNames = new Map()
  for (const key of targets) {
    const [category, route] = key.split(KEY_SEPARATOR)
    routeNames.set(`${category}${KEY_SEPARATOR}${route}`, true)
  }

  const routes = new Map()
  for await (const row of rowsFromArchive(archive, 'routes.txt')) {
    const category = transportModeForRouteType(row.route_type)
    const route = row.route_short_name || row.route_long_name
    if (!SHAPED_CATEGORIES.has(category)) continue
    if (!routeNames.has(`${category}${KEY_SEPARATOR}${route}`)) continue
    routes.set(row.route_id, { category, route })
  }

  const trips = new Map()
  for await (const row of rowsFromArchive(archive, 'trips.txt')) {
    const route = routes.get(row.route_id)
    if (!route || !services.has(row.service_id) || !row.shape_id) continue
    trips.set(row.trip_id, { ...route, shapeId: row.shape_id })
  }
  return { routes, trips }
}

function addCandidate(candidates, key, candidate) {
  const options = candidates.get(key) ?? new Map()
  const signature = [candidate.shapeId, candidate.fromDistance, candidate.toDistance].join(
    KEY_SEPARATOR,
  )
  const existing = options.get(signature)
  options.set(signature, existing ? { ...existing, count: existing.count + 1 } : candidate)
  candidates.set(key, options)
}

async function segmentCandidates(archive, trips, targets) {
  const candidates = new Map()
  let currentTripId
  let currentTrip
  let previous

  for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
    if (row.trip_id !== currentTripId) {
      currentTripId = row.trip_id
      currentTrip = trips.get(currentTripId)
      previous = undefined
    }
    if (!currentTrip) continue

    const current = {
      stopId: row.stop_id,
      distance: Number(row.shape_dist_traveled),
    }
    if (previous && Number.isFinite(previous.distance) && Number.isFinite(current.distance)) {
      const key = segmentKey(
        currentTrip.category,
        currentTrip.route,
        previous.stopId,
        current.stopId,
      )
      if (targets.has(key)) {
        addCandidate(candidates, key, {
          shapeId: currentTrip.shapeId,
          fromDistance: previous.distance,
          toDistance: current.distance,
          count: 1,
        })
      }
    }
    previous = current
  }

  return new Map(
    [...candidates].map(([key, options]) => [
      key,
      [...options.values()].sort((first, second) => second.count - first.count)[0],
    ]),
  )
}

async function selectedShapes(archive, candidates) {
  const wanted = new Set([...candidates.values()].map(({ shapeId }) => shapeId))
  const shapes = new Map()
  for await (const row of rowsFromArchive(archive, 'shapes.txt')) {
    if (!wanted.has(row.shape_id)) continue
    const points = shapes.get(row.shape_id) ?? []
    points.push({
      longitude: Number(row.shape_pt_lon),
      latitude: Number(row.shape_pt_lat),
      distance: Number(row.shape_dist_traveled),
    })
    shapes.set(row.shape_id, points)
  }
  return shapes
}

function pointAtDistance(points, target) {
  if (target <= points[0].distance) return points[0]
  if (target >= points.at(-1).distance) return points.at(-1)
  let upper = 1
  while (upper < points.length && points[upper].distance < target) upper += 1
  const lower = points[upper - 1]
  const next = points[upper]
  const progress =
    next.distance === lower.distance
      ? 0
      : (target - lower.distance) / (next.distance - lower.distance)
  return {
    longitude: lower.longitude + (next.longitude - lower.longitude) * progress,
    latitude: lower.latitude + (next.latitude - lower.latitude) * progress,
    distance: target,
  }
}

function perpendicularDistance(point, start, end) {
  const latitudeScale = 111_320
  const longitudeScale = Math.cos((point.latitude * Math.PI) / 180) * latitudeScale
  const px = point.longitude * longitudeScale
  const py = point.latitude * latitudeScale
  const sx = start.longitude * longitudeScale
  const sy = start.latitude * latitudeScale
  const ex = end.longitude * longitudeScale
  const ey = end.latitude * latitudeScale
  const dx = ex - sx
  const dy = ey - sy
  if (dx === 0 && dy === 0) return Math.hypot(px - sx, py - sy)
  const progress = Math.min(1, Math.max(0, ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (sx + progress * dx), py - (sy + progress * dy))
}

function simplifyPoints(points, toleranceMetres = 1.5) {
  if (points.length <= 2) return points
  let furthestDistance = 0
  let furthestIndex = 0
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points.at(-1))
    if (distance > furthestDistance) {
      furthestDistance = distance
      furthestIndex = index
    }
  }
  if (furthestDistance <= toleranceMetres) return [points[0], points.at(-1)]
  const first = simplifyPoints(points.slice(0, furthestIndex + 1), toleranceMetres)
  const second = simplifyPoints(points.slice(furthestIndex), toleranceMetres)
  return [...first.slice(0, -1), ...second]
}

function segmentPath(candidate, shapes, fromStop, toStop) {
  const shape = shapes.get(candidate.shapeId)
  if (!shape?.length) return undefined
  const reversed = candidate.toDistance < candidate.fromDistance
  const start = Math.min(candidate.fromDistance, candidate.toDistance)
  const end = Math.max(candidate.fromDistance, candidate.toDistance)
  const points = [
    pointAtDistance(shape, start),
    ...shape.filter((point) => point.distance > start && point.distance < end),
    pointAtDistance(shape, end),
  ]
  if (reversed) points.reverse()
  points[0] = { longitude: fromStop[0], latitude: fromStop[1], distance: start }
  points[points.length - 1] = {
    longitude: toStop[0],
    latitude: toStop[1],
    distance: end,
  }
  return simplifyPoints(points).map(({ longitude, latitude }) => [
    Number(longitude.toFixed(7)),
    Number(latitude.toFixed(7)),
  ])
}

function applyGeometry(snapshot, candidates, shapes) {
  const paths = []
  const pathIndexes = new Map()
  const segmentPaths = new Map()

  function pathIndexFor(key, fromStop, toStop) {
    if (segmentPaths.has(key)) return segmentPaths.get(key)
    const candidate = candidates.get(key)
    const path = candidate && segmentPath(candidate, shapes, fromStop, toStop)
    if (!path || path.length < 2) {
      segmentPaths.set(key, null)
      return null
    }
    const signature = JSON.stringify(path)
    let pathIndex = pathIndexes.get(signature)
    if (pathIndex === undefined) {
      pathIndex = paths.length
      paths.push(path)
      pathIndexes.set(signature, pathIndex)
    }
    segmentPaths.set(key, pathIndex)
    return pathIndex
  }

  let totalSegments = 0
  let matchedSegments = 0
  const edgePathCounts = new Map()
  const trains = snapshot.trains.map((train) => {
    if (!SHAPED_CATEGORIES.has(train.category)) return train
    const pathSegments = []
    let hasGeometry = false
    for (let index = 1; index < train.stops.length; index += 1) {
      totalSegments += 1
      const fromIndex = train.stops[index - 1][0]
      const toIndex = train.stops[index][0]
      const fromStop = snapshot.stops[fromIndex]
      const toStop = snapshot.stops[toIndex]
      const fromStopId = fromStop?.[4]
      const toStopId = toStop?.[4]
      const key =
        fromStopId && toStopId
          ? segmentKey(train.category, train.route, fromStopId, toStopId)
          : ''
      const pathIndex = key ? pathIndexFor(key, fromStop, toStop) : null
      pathSegments.push(pathIndex)
      if (pathIndex === null) continue
      hasGeometry = true
      matchedSegments += 1
      const edgeKey =
        fromIndex < toIndex ? `${fromIndex}:${toIndex}` : `${toIndex}:${fromIndex}`
      const counts = edgePathCounts.get(edgeKey) ?? new Map()
      counts.set(pathIndex, (counts.get(pathIndex) ?? 0) + 1)
      edgePathCounts.set(edgeKey, counts)
    }
    return hasGeometry ? { ...train, pathSegments } : train
  })

  const edgePaths = snapshot.edges.map(([fromIndex, toIndex]) => {
    const counts = edgePathCounts.get(`${fromIndex}:${toIndex}`)
    if (!counts) return null
    return [...counts].sort((first, second) => second[1] - first[1])[0][0]
  })

  return { paths, edgePaths, trains, totalSegments, matchedSegments }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: node scripts/enrich-zurich-shapes.mjs --archive /path/2026_google_transit.zip ' +
        '[--snapshot public/data/zurich-city-morning.json] [--feed-version 2026_google_transit]. ' +
        'The snapshot may also be a chunked 24-hour manifest.',
    )
    return
  }

  const archive = resolve(requiredArgument('archive'))
  const feedVersion = argument('feed-version', basename(archive, '.zip'))
  const snapshotPath = resolve(argument('snapshot', DEFAULT_SNAPSHOT))
  const document = JSON.parse(await readFile(snapshotPath, 'utf8'))
  const isDayManifest =
    Array.isArray(document.chunks) && !Array.isArray(document.trains)
  const chunkRecords = isDayManifest
    ? await Promise.all(
        document.chunks.map(async (descriptor) => ({
          path: resolve(dirname(snapshotPath), descriptor.path),
          payload: JSON.parse(
            await readFile(resolve(dirname(snapshotPath), descriptor.path), 'utf8'),
          ),
        })),
      )
    : []
  const uniqueTrains = isDayManifest
    ? [
        ...new Map(
          chunkRecords
            .flatMap(({ payload }) => payload.trains)
            .map((train) => [train.id, train]),
        ).values(),
      ]
    : document.trains
  const snapshot = isDayManifest ? { ...document, trains: uniqueTrains } : document
  const serviceDate = snapshot.metadata.serviceDate
  const { targets, totalSegments: targetOccurrences } = targetSegments(snapshot)
  if (!targets.size) {
    throw new Error('Snapshot has no source stop IDs or shapeable tram/bus segments; regenerate it first.')
  }

  console.log(`Validating ${targets.size} unique tram/bus segments (${targetOccurrences} occurrences)…`)
  const services = await activeServices(archive, serviceDate)
  const { routes, trips } = await matchingTrips(archive, services, targets)
  console.log(`Matched ${routes.size} ZVV routes and ${trips.size} active trips. Reading stop times…`)
  const candidates = await segmentCandidates(archive, trips, targets)
  console.log(`Found shaped candidates for ${candidates.size} of ${targets.size} unique segments. Reading shapes…`)
  reportMissingSegments(snapshot, candidates)
  const shapes = await selectedShapes(archive, candidates)
  const geometry = applyGeometry(snapshot, candidates, shapes)
  const coverage = geometry.matchedSegments / geometry.totalSegments
  if (coverage < 0.8) {
    throw new Error(`Only ${(coverage * 100).toFixed(1)}% of tram/bus segments aligned; refusing a weak join.`)
  }

  const metadata = {
    ...snapshot.metadata,
    model: 'scheduled interpolation with ZVV shape-aware tram and bus paths',
    note: 'Rail uses straight stop segments; Zürich tram and bus movement follows matched official ZVV shapes.',
    geometry: {
      publisher: 'Zürcher Verkehrsverbund (ZVV)',
      feedVersion,
      sourceUrl: SOURCE_URL,
      model: 'line and directed stop-pair alignment using shared Swiss stop identifiers',
      matchedSegments: geometry.matchedSegments,
      totalSegments: geometry.totalSegments,
    },
  }
  const result = {
    ...document,
    metadata,
    paths: geometry.paths,
    edgePaths: geometry.edgePaths,
    ...(isDayManifest ? {} : { trains: geometry.trains }),
  }
  const enrichedTrains = new Map(geometry.trains.map((train) => [train.id, train]))
  const pendingWrites = chunkRecords.map(({ path, payload }) => ({
    path,
    temporaryPath: `${path}.tmp`,
    value: {
      ...payload,
      trains: payload.trains.map((train) => enrichedTrains.get(train.id) ?? train),
    },
  }))
  const manifestWrite = {
    path: snapshotPath,
    temporaryPath: `${snapshotPath}.tmp`,
    value: result,
  }
  await Promise.all(
    [...pendingWrites, manifestWrite].map(({ temporaryPath, value }) =>
      writeFile(temporaryPath, JSON.stringify(value)),
    ),
  )
  await Promise.all(
    pendingWrites.map(({ temporaryPath, path }) => rename(temporaryPath, path)),
  )
  await rename(manifestWrite.temporaryPath, manifestWrite.path)
  console.log(
    `Wrote ${geometry.paths.length} deduplicated paths with ${(coverage * 100).toFixed(1)}% segment coverage${isDayManifest ? ` across ${chunkRecords.length} chunks` : ''} → ${snapshotPath}`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
