import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'

const DEFAULT_OUTPUT = 'public/data/swiss-rail-morning.json'
const DEFAULT_HUB_OUTPUT = 'public/data/swiss-hub-day.json'
const DATASET_URL =
  'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020'
const DISPLAY_BOUNDS = {
  minLongitude: 5.7,
  minLatitude: 45.7,
  maxLongitude: 10.7,
  maxLatitude: 48,
}
const HUB_NAMES = new Map([
  ['Zürich HB', 'zurich'],
  ['Bern', 'bern'],
  ['Basel SBB', 'basel'],
  ['Genève', 'geneva'],
])

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function requiredArgument(name) {
  const value = argument(name)
  if (!value) {
    throw new Error(`Missing --${name}. See npm run data:gtfs -- --help`)
  }
  return value
}

export function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      values.push(value)
      value = ''
    } else {
      value += character
    }
  }

  values.push(value)
  return values
}

export function parseGtfsTime(value) {
  const [hours, minutes, seconds] = value.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds
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

export function transportModeForRouteType(value) {
  const routeType = Number(value)
  if (routeType === 0 || (routeType >= 900 && routeType < 1000)) return 'tram'
  if (routeType === 1 || (routeType >= 400 && routeType < 500)) return 'metro'
  if (routeType === 2 || (routeType >= 100 && routeType < 200)) return 'rail'
  if (
    routeType === 3 ||
    routeType === 11 ||
    (routeType >= 200 && routeType < 300) ||
    (routeType >= 700 && routeType < 800)
  ) return 'bus'
  if (routeType === 4 || (routeType >= 1000 && routeType < 1100)) return 'ferry'
  if (routeType === 6 || (routeType >= 1300 && routeType < 1400)) {
    return 'cableway'
  }
  if (routeType === 7 || (routeType >= 1400 && routeType < 1500)) {
    return 'funicular'
  }
  return undefined
}

function railServiceCategory(routeName) {
  const name = routeName.toUpperCase().replaceAll(' ', '')
  if (/^(EC|ICE|TGV|RJX|RJ|NJ|EN)/.test(name)) return 'international'
  if (/^IC/.test(name)) return 'intercity'
  if (/^IR/.test(name)) return 'interregio'
  if (/^RE/.test(name)) return 'regional-express'
  if (/^(S\d|SN\d)/.test(name)) return 's-bahn'
  if (/^(R\d|RB|TER|C\d)/.test(name)) return 'regional'
  return 'other'
}

function routeCategory(routeName, mode) {
  return mode === 'rail' ? railServiceCategory(routeName) : mode
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
    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]] = values[index] ?? ''
    }
    yield row
  }
  await completed
}

async function readFeedInfo(archive) {
  for await (const row of rowsFromArchive(archive, 'feed_info.txt')) return row
  throw new Error('feed_info.txt contains no data')
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

async function routesForModes(archive, modes) {
  const routes = new Map()
  for await (const row of rowsFromArchive(archive, 'routes.txt')) {
    const mode = transportModeForRouteType(row.route_type)
    if (!mode || !modes.has(mode)) continue
    const name = row.route_short_name || row.route_long_name || mode
    routes.set(row.route_id, {
      agencyId: row.agency_id,
      name,
      type: Number(row.route_type),
      mode,
      category: routeCategory(name, mode),
    })
  }
  return routes
}

async function activeTrips(archive, routes, services) {
  const trips = new Map()
  for await (const row of rowsFromArchive(archive, 'trips.txt')) {
    const route = routes.get(row.route_id)
    if (!route || !services.has(row.service_id)) continue
    trips.set(row.trip_id, {
      agencyId: route.agencyId,
      route: route.name,
      headsign: row.trip_headsign,
      shortName: row.trip_short_name,
      category: route.category,
      mode: route.mode,
    })
  }
  return trips
}

async function stopsById(archive) {
  const stops = new Map()
  for await (const row of rowsFromArchive(archive, 'stops.txt')) {
    const latitude = Number(row.stop_lat)
    const longitude = Number(row.stop_lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    stops.set(row.stop_id, {
      name: row.stop_name,
      latitude,
      longitude,
      platformCode: row.platform_code,
    })
  }
  return stops
}

function canonicalStopId(stopId) {
  return stopId.split('::')[0]
}

async function localStopIds(archive) {
  const stopIds = new Set()
  for await (const row of rowsFromArchive(archive, 'stops.txt')) {
    stopIds.add(canonicalStopId(row.stop_id))
  }
  return stopIds
}

function createSnapshotBuilder({
  trips,
  sourceStops,
  windowStart,
  windowEnd,
  focusTime,
  displayBounds,
  allowedLocalStopIds,
  allowedLocalAgencyIds,
}) {
  const stops = []
  const stopIndexes = new Map()
  const edges = new Set()
  const trains = []
  const bounds = {
    minLongitude: Infinity,
    minLatitude: Infinity,
    maxLongitude: -Infinity,
    maxLatitude: -Infinity,
  }

  function stopIndex(stopId) {
    const existing = stopIndexes.get(stopId)
    if (existing !== undefined) return existing
    const stop = sourceStops.get(stopId)
    if (!stop) return undefined
    if (
      stop.longitude < displayBounds.minLongitude ||
      stop.longitude > displayBounds.maxLongitude ||
      stop.latitude < displayBounds.minLatitude ||
      stop.latitude > displayBounds.maxLatitude
    ) {
      return undefined
    }
    const index = stops.length
    stopIndexes.set(stopId, index)
    stops.push([
      stop.longitude,
      stop.latitude,
      stop.name,
      stop.platformCode || '',
      stopId,
    ])
    bounds.minLongitude = Math.min(bounds.minLongitude, stop.longitude)
    bounds.minLatitude = Math.min(bounds.minLatitude, stop.latitude)
    bounds.maxLongitude = Math.max(bounds.maxLongitude, stop.longitude)
    bounds.maxLatitude = Math.max(bounds.maxLatitude, stop.latitude)
    return index
  }

  function addTrip(tripId, tripStops) {
    const metadata = trips.get(tripId)
    if (!metadata || tripStops.length < 2) return

    if (metadata.mode === 'tram' || metadata.mode === 'bus') {
      if (
        allowedLocalAgencyIds &&
        !allowedLocalAgencyIds.has(metadata.agencyId)
      ) {
        return
      }
      if (allowedLocalStopIds) {
        const localStopsInBounds = tripStops.filter((tripStop) => {
          const stop = sourceStops.get(tripStop.stopId)
          return (
            stop &&
            stop.longitude >= displayBounds.minLongitude &&
            stop.longitude <= displayBounds.maxLongitude &&
            stop.latitude >= displayBounds.minLatitude &&
            stop.latitude <= displayBounds.maxLatitude
          )
        })
        const allowedCount = localStopsInBounds.filter((tripStop) =>
          allowedLocalStopIds.has(canonicalStopId(tripStop.stopId)),
        ).length
        if (
          localStopsInBounds.length < 2 ||
          allowedCount / localStopsInBounds.length < 0.8
        ) {
          return
        }
      }
    }

    const indexedStops = tripStops
      .map((stop) => {
        const index = stopIndex(stop.stopId)
        return index === undefined
          ? undefined
          : [index, stop.arrival, stop.departure]
      })
      .filter(Boolean)

    if (indexedStops.length < 2) return
    for (let index = 1; index < indexedStops.length; index += 1) {
      const first = indexedStops[index - 1][0]
      const second = indexedStops[index][0]
      edges.add(first < second ? `${first}:${second}` : `${second}:${first}`)
    }

    const start = indexedStops[0][2]
    const end = indexedStops.at(-1)[1]
    if (start > windowEnd || end < windowStart) return

    trains.push({
      id: tripId,
      route: metadata.route,
      headsign: metadata.headsign,
      shortName: metadata.shortName,
      category: metadata.category,
      start,
      end,
      stops: indexedStops,
    })
  }

  function finish() {
    const edgePairs = [...edges].map((edge) => edge.split(':').map(Number))
    const trainsAtFocus = trains.filter(
      (train) => train.start <= focusTime && train.end >= focusTime,
    ).length
    return { stops, edges: edgePairs, trains, bounds, trainsAtFocus }
  }

  return { addTrip, finish }
}

function createHubDayBuilder({ trips, sourceStops }) {
  const hubs = Object.fromEntries([...HUB_NAMES.values()].map((id) => [id, []]))

  function compactStop(stop) {
    if (!stop) return undefined
    const source = sourceStops.get(stop.stopId)
    if (!source) return undefined
    return [source.longitude, source.latitude, source.name, source.platformCode]
  }

  function addTrip(tripId, tripStops) {
    const train = trips.get(tripId)
    if (!train) return
    tripStops.forEach((stop, index) => {
      const source = sourceStops.get(stop.stopId)
      const hubId = source ? HUB_NAMES.get(source.name) : undefined
      if (!hubId || stop.arrival > 86400 || stop.departure < 0) return
      hubs[hubId].push({
        id: `${tripId}:${stop.stopId}`,
        train: { id: tripId, ...train },
        arrival: stop.arrival,
        departure: stop.departure,
        hubStop: compactStop(stop),
        previousStop: compactStop(tripStops[index - 1]),
        nextStop: compactStop(tripStops[index + 1]),
      })
    })
  }

  function finish() {
    for (const calls of Object.values(hubs)) {
      calls.sort((first, second) => first.arrival - second.arrival)
    }
    return hubs
  }

  return { addTrip, finish }
}

async function readStopTimes(archive, trips, builders) {
  let currentTripId
  let currentStops = []
  let rowsRead = 0

  for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
    rowsRead += 1
    if (row.trip_id !== currentTripId) {
      if (currentTripId) {
        for (const builder of builders) builder.addTrip(currentTripId, currentStops)
      }
      currentTripId = row.trip_id
      currentStops = []
    }
    if (trips.has(row.trip_id)) {
      currentStops.push({
        stopId: row.stop_id,
        arrival: parseGtfsTime(row.arrival_time),
        departure: parseGtfsTime(row.departure_time),
      })
    }
  }
  if (currentTripId) {
    for (const builder of builders) builder.addTrip(currentTripId, currentStops)
  }
  return rowsRead
}

function parseClock(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error(`Invalid time: ${value}`)
  return parseGtfsTime(`${value}:00`)
}

export function parseBounds(value) {
  if (!value) return DISPLAY_BOUNDS
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = value
    .split(',')
    .map(Number)
  if (
    ![minLongitude, minLatitude, maxLongitude, maxLatitude].every(Number.isFinite) ||
    minLongitude >= maxLongitude ||
    minLatitude >= maxLatitude
  ) {
    throw new Error(`Invalid bounds: ${value}`)
  }
  return { minLongitude, minLatitude, maxLongitude, maxLatitude }
}

export function parseModes(value) {
  const supported = new Set([
    'rail',
    'tram',
    'metro',
    'bus',
    'ferry',
    'cableway',
    'funicular',
  ])
  if (value === 'all') return supported
  const modes = new Set(value.split(',').filter(Boolean))
  for (const mode of modes) {
    if (!supported.has(mode)) throw new Error(`Unsupported transport mode: ${mode}`)
  }
  if (!modes.size) throw new Error('At least one transport mode is required')
  return modes
}

export function parseAgencyIds(value) {
  if (!value) return undefined
  const agencyIds = new Set(value.split(',').map((id) => id.trim()).filter(Boolean))
  if (!agencyIds.size) throw new Error('At least one local agency ID is required')
  return agencyIds
}

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true })
  await new Promise((resolvePromise, rejectPromise) => {
    const output = createWriteStream(filePath)
    output.once('error', rejectPromise)
    output.once('finish', resolvePromise)
    output.end(JSON.stringify(value))
  })
}

export function chunkNetworkSnapshot(snapshot, chunkSeconds, chunkDirectoryName) {
  if (!Number.isFinite(chunkSeconds) || chunkSeconds <= 0) {
    throw new Error('Chunk duration must be a positive number of seconds')
  }
  const chunks = []
  for (
    let windowStart = snapshot.metadata.windowStart;
    windowStart < snapshot.metadata.windowEnd;
    windowStart += chunkSeconds
  ) {
    const windowEnd = Math.min(
      snapshot.metadata.windowEnd,
      windowStart + chunkSeconds,
    )
    const startHour = String(Math.floor(windowStart / 3600)).padStart(2, '0')
    const endHour = String(Math.ceil(windowEnd / 3600)).padStart(2, '0')
    const id = `${startHour}-${endHour}`
    const trains = snapshot.trains.filter(
      (train) => train.start <= windowEnd && train.end >= windowStart,
    )
    chunks.push({
      descriptor: {
        id,
        windowStart,
        windowEnd,
        path: `${chunkDirectoryName}/${id}.json`,
        tripCount: trains.length,
      },
      payload: { windowStart, windowEnd, trains },
    })
  }

  return {
    manifest: {
      metadata: snapshot.metadata,
      bounds: snapshot.bounds,
      stops: snapshot.stops,
      edges: snapshot.edges,
      tripCount: snapshot.trains.length,
      chunks: chunks.map(({ descriptor }) => descriptor),
    },
    chunks,
  }
}

async function writeChunkedNetworkSnapshot(output, snapshot, chunkHours) {
  const outputDirectory = dirname(output)
  const outputStem = basename(output, extname(output)).replace(/-manifest$/, '')
  const chunkDirectoryName = `${outputStem}-chunks`
  const chunkDirectory = join(outputDirectory, chunkDirectoryName)
  const { manifest, chunks } = chunkNetworkSnapshot(
    snapshot,
    chunkHours * 3600,
    chunkDirectoryName,
  )
  await Promise.all([
    writeJson(output, manifest),
    ...chunks.map(({ descriptor, payload }) =>
      writeJson(join(outputDirectory, descriptor.path), payload),
    ),
  ])
  return { chunkDirectory, chunkCount: chunks.length }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: npm run data:gtfs -- --archive /path/feed.zip --date YYYY-MM-DD ' +
        '[--window-start 06:45] [--window-end 08:45] [--focus 07:45] ' +
        '[--modes rail|all|rail,tram,bus] [--bounds minLon,minLat,maxLon,maxLat] ' +
        '[--local-stop-archive /path/regional.zip] [--output morning.json] ' +
        '[--local-agencies 881,199] ' +
        '[--hub-output day.json|none] [--chunk-hours 3]',
    )
    return
  }

  const archive = resolve(requiredArgument('archive'))
  const serviceDate = argument('date', '2026-09-04')
  const windowStartLabel = argument('window-start', '06:45')
  const windowEndLabel = argument('window-end', '08:45')
  const focusLabel = argument('focus', '07:45')
  const output = resolve(argument('output', DEFAULT_OUTPUT))
  const hubOutputArgument = argument('hub-output', DEFAULT_HUB_OUTPUT)
  const hubOutput = hubOutputArgument === 'none' ? undefined : resolve(hubOutputArgument)
  const chunkHoursArgument = argument('chunk-hours')
  const chunkHours = chunkHoursArgument ? Number(chunkHoursArgument) : undefined
  if (chunkHours !== undefined && (!Number.isFinite(chunkHours) || chunkHours <= 0)) {
    throw new Error('--chunk-hours must be a positive number')
  }
  const modes = parseModes(argument('modes', 'rail'))
  const localStopArchiveArgument = argument('local-stop-archive')
  const localStopArchive = localStopArchiveArgument
    ? resolve(localStopArchiveArgument)
    : undefined
  const allowedLocalAgencyIds = parseAgencyIds(argument('local-agencies'))
  const displayBounds = parseBounds(argument('bounds'))
  const windowStart = parseClock(windowStartLabel)
  const windowEnd = parseClock(windowEndLabel)
  const focusTime = parseClock(focusLabel)

  console.log('Reading feed metadata and service calendar…')
  const [feed, services, routes, sourceStops, allowedLocalStopIds] = await Promise.all([
    readFeedInfo(archive),
    activeServices(archive, serviceDate),
    routesForModes(archive, modes),
    stopsById(archive),
    localStopArchive ? localStopIds(localStopArchive) : undefined,
  ])
  console.log(
    `Selected ${services.size} active services and ${routes.size} routes for ${[...modes].join(', ')}.`,
  )

  const trips = await activeTrips(archive, routes, services)
  console.log(`Selected ${trips.size} active trips. Reading stop times…`)
  const builder = createSnapshotBuilder({
    trips,
    sourceStops,
    windowStart,
    windowEnd,
    focusTime,
    displayBounds,
    allowedLocalStopIds,
    allowedLocalAgencyIds,
  })
  const hubBuilder = hubOutput ? createHubDayBuilder({ trips, sourceStops }) : undefined
  const rowsRead = await readStopTimes(
    archive,
    trips,
    hubBuilder ? [builder, hubBuilder] : [builder],
  )
  const snapshot = builder.finish()
  const hubs = hubBuilder?.finish()

  const result = {
    metadata: {
      publisher: feed.feed_publisher_name,
      feedVersion: feed.feed_version,
      serviceDate,
      windowStart,
      windowEnd,
      focusTime,
      sourceUrl: DATASET_URL,
      model: 'scheduled station-to-station interpolation',
      note: 'The Swiss GTFS feed contains no shapes.txt; positions follow straight stop segments.',
      modes: [...modes],
      ...(allowedLocalAgencyIds
        ? { localAgencyIds: [...allowedLocalAgencyIds] }
        : {}),
    },
    bounds: snapshot.bounds,
    stops: snapshot.stops,
    edges: snapshot.edges,
    trains: snapshot.trains,
  }

  const hubResult = hubs ? {
    metadata: {
      publisher: feed.feed_publisher_name,
      feedVersion: feed.feed_version,
      serviceDate,
      windowStart: 0,
      windowEnd: 86400,
      focusTime,
      sourceUrl: DATASET_URL,
      model: 'scheduled station calls',
      note: 'A full civil-day view of calls at four major Swiss railway hubs.',
    },
    hubs,
  } : undefined

  const writes = [
    chunkHours
      ? writeChunkedNetworkSnapshot(output, result, chunkHours)
      : writeJson(output, result),
  ]
  if (hubOutput && hubResult) writes.push(writeJson(hubOutput, hubResult))
  await Promise.all(writes)
  console.log(
    `Wrote ${snapshot.trains.length} trips, ${snapshot.edges.length} network edges, ` +
      `${snapshot.stops.length} stops and ${snapshot.trainsAtFocus} trains moving at ${focusLabel}.`,
  )
  console.log(`Read ${rowsRead.toLocaleString('en')} stop-time rows → ${output}`)
  if (hubOutput && hubs) {
    console.log(
      `Wrote ${Object.values(hubs).reduce((total, calls) => total + calls.length, 0)} ` +
        `full-day hub calls → ${hubOutput}`,
    )
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
