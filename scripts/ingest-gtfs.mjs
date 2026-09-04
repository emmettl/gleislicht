import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
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

function isRailRouteType(value) {
  const routeType = Number(value)
  return routeType === 2 || (routeType >= 100 && routeType < 200)
}

function serviceCategory(routeName) {
  const name = routeName.toUpperCase().replaceAll(' ', '')
  if (/^(EC|ICE|TGV|RJX|RJ|NJ|EN)/.test(name)) return 'international'
  if (/^IC/.test(name)) return 'intercity'
  if (/^IR/.test(name)) return 'interregio'
  if (/^RE/.test(name)) return 'regional-express'
  if (/^(S\d|SN\d)/.test(name)) return 's-bahn'
  if (/^(R\d|RB|TER|C\d)/.test(name)) return 'regional'
  return 'other'
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

async function railRoutes(archive) {
  const routes = new Map()
  for await (const row of rowsFromArchive(archive, 'routes.txt')) {
    if (!isRailRouteType(row.route_type)) continue
    routes.set(row.route_id, {
      name: row.route_short_name || row.route_long_name || 'Rail',
      type: Number(row.route_type),
      category: serviceCategory(row.route_short_name || row.route_long_name || ''),
    })
  }
  return routes
}

async function activeRailTrips(archive, routes, services) {
  const trips = new Map()
  for await (const row of rowsFromArchive(archive, 'trips.txt')) {
    const route = routes.get(row.route_id)
    if (!route || !services.has(row.service_id)) continue
    trips.set(row.trip_id, {
      route: route.name,
      headsign: row.trip_headsign,
      shortName: row.trip_short_name,
      category: route.category,
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
    })
  }
  return stops
}

function createSnapshotBuilder({
  trips,
  sourceStops,
  windowStart,
  windowEnd,
  focusTime,
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
      stop.longitude < DISPLAY_BOUNDS.minLongitude ||
      stop.longitude > DISPLAY_BOUNDS.maxLongitude ||
      stop.latitude < DISPLAY_BOUNDS.minLatitude ||
      stop.latitude > DISPLAY_BOUNDS.maxLatitude
    ) {
      return undefined
    }
    const index = stops.length
    stopIndexes.set(stopId, index)
    stops.push([stop.longitude, stop.latitude, stop.name])
    bounds.minLongitude = Math.min(bounds.minLongitude, stop.longitude)
    bounds.minLatitude = Math.min(bounds.minLatitude, stop.latitude)
    bounds.maxLongitude = Math.max(bounds.maxLongitude, stop.longitude)
    bounds.maxLatitude = Math.max(bounds.maxLatitude, stop.latitude)
    return index
  }

  function addTrip(tripId, tripStops) {
    const metadata = trips.get(tripId)
    if (!metadata || tripStops.length < 2) return

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
    return [source.longitude, source.latitude, source.name]
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

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true })
  await new Promise((resolvePromise, rejectPromise) => {
    const output = createWriteStream(filePath)
    output.once('error', rejectPromise)
    output.once('finish', resolvePromise)
    output.end(JSON.stringify(value))
  })
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: npm run data:gtfs -- --archive /path/feed.zip --date YYYY-MM-DD ' +
        '[--window-start 06:45] [--window-end 08:45] [--focus 07:45] ' +
        '[--output morning.json] [--hub-output day.json]',
    )
    return
  }

  const archive = resolve(requiredArgument('archive'))
  const serviceDate = argument('date', '2026-09-04')
  const windowStartLabel = argument('window-start', '06:45')
  const windowEndLabel = argument('window-end', '08:45')
  const focusLabel = argument('focus', '07:45')
  const output = resolve(argument('output', DEFAULT_OUTPUT))
  const hubOutput = resolve(argument('hub-output', DEFAULT_HUB_OUTPUT))
  const windowStart = parseClock(windowStartLabel)
  const windowEnd = parseClock(windowEndLabel)
  const focusTime = parseClock(focusLabel)

  console.log('Reading feed metadata and service calendar…')
  const [feed, services, routes, sourceStops] = await Promise.all([
    readFeedInfo(archive),
    activeServices(archive, serviceDate),
    railRoutes(archive),
    stopsById(archive),
  ])
  console.log(`Selected ${services.size} active services and ${routes.size} rail routes.`)

  const trips = await activeRailTrips(archive, routes, services)
  console.log(`Selected ${trips.size} active rail trips. Reading stop times…`)
  const builder = createSnapshotBuilder({
    trips,
    sourceStops,
    windowStart,
    windowEnd,
    focusTime,
  })
  const hubBuilder = createHubDayBuilder({ trips, sourceStops })
  const rowsRead = await readStopTimes(archive, trips, [builder, hubBuilder])
  const snapshot = builder.finish()
  const hubs = hubBuilder.finish()

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
    },
    bounds: snapshot.bounds,
    stops: snapshot.stops,
    edges: snapshot.edges,
    trains: snapshot.trains,
  }

  const hubResult = {
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
  }

  await Promise.all([writeJson(output, result), writeJson(hubOutput, hubResult)])
  console.log(
    `Wrote ${snapshot.trains.length} morning trips, ${snapshot.edges.length} rail edges, ` +
      `${snapshot.stops.length} stops and ${snapshot.trainsAtFocus} trains moving at ${focusLabel}.`,
  )
  console.log(`Read ${rowsRead.toLocaleString('en')} stop-time rows → ${output}`)
  console.log(
    `Wrote ${Object.values(hubs).reduce((total, calls) => total + calls.length, 0)} ` +
      `full-day hub calls → ${hubOutput}`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
