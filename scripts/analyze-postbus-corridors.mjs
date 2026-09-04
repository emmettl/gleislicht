import { resolve } from 'node:path'
import {
  activeServices,
  parseGtfsTime,
  rowsFromArchive,
  stopsById,
} from './ingest-gtfs.mjs'

const POSTBUS_AGENCY_ID = '801'

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function requiredArgument(name) {
  const value = argument(name)
  if (!value) throw new Error(`Missing --${name}. See --help`)
  return value
}

export function distanceKilometres(first, second) {
  const latitude = ((first.latitude + second.latitude) / 2) * (Math.PI / 180)
  const x = (first.longitude - second.longitude) * Math.cos(latitude) * 111.32
  const y = (first.latitude - second.latitude) * 111.32
  return Math.hypot(x, y)
}

function median(values) {
  if (!values.length) return undefined
  const ordered = [...values].sort((first, second) => first - second)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2
}

function finishTrip(trip, tripStops, routes, sourceStops, summaries) {
  if (!trip || tripStops.length < 2) return
  const route = routes.get(trip.routeId)
  if (!route) return
  const resolvedStops = tripStops
    .map((call) => ({ ...call, stop: sourceStops.get(call.stopId) }))
    .filter((call) => call.stop)
  if (resolvedStops.length < 2) return
  const distance = resolvedStops
    .slice(1)
    .reduce(
      (total, call, index) =>
        total + distanceKilometres(resolvedStops[index].stop, call.stop),
      0,
    )
  const first = resolvedStops[0]
  const last = resolvedStops.at(-1)
  const summary = summaries.get(route.id) ?? {
    routeId: route.id,
    route: route.name,
    trips: 0,
    stopIds: new Set(),
    departures: [],
    earliest: Infinity,
    latest: -Infinity,
    maxRunKm: 0,
    maxRunMinutes: 0,
    representative: undefined,
    bounds: {
      minLongitude: Infinity,
      minLatitude: Infinity,
      maxLongitude: -Infinity,
      maxLatitude: -Infinity,
    },
  }
  summary.trips += 1
  summary.departures.push(first.departure)
  summary.earliest = Math.min(summary.earliest, first.departure)
  summary.latest = Math.max(summary.latest, last.arrival)
  for (const call of resolvedStops) {
    summary.stopIds.add(call.stopId)
    summary.bounds.minLongitude = Math.min(summary.bounds.minLongitude, call.stop.longitude)
    summary.bounds.minLatitude = Math.min(summary.bounds.minLatitude, call.stop.latitude)
    summary.bounds.maxLongitude = Math.max(summary.bounds.maxLongitude, call.stop.longitude)
    summary.bounds.maxLatitude = Math.max(summary.bounds.maxLatitude, call.stop.latitude)
  }
  if (distance > summary.maxRunKm) {
    summary.maxRunKm = distance
    summary.maxRunMinutes = (last.arrival - first.departure) / 60
    summary.representative = {
      origin: first.stop.name,
      destination: last.stop.name,
      headsign: trip.headsign,
      stopCount: resolvedStops.length,
      stopIds: resolvedStops.map((call) => call.stopId),
    }
  }
  summaries.set(route.id, summary)
}

function publicSummary(summary) {
  const departures = [...summary.departures].sort((first, second) => first - second)
  const headways = departures
    .slice(1)
    .map((departure, index) => (departure - departures[index]) / 60)
    .filter((minutes) => minutes >= 5 && minutes <= 360)
  return {
    routeId: summary.routeId,
    route: summary.route,
    trips: summary.trips,
    uniqueStops: summary.stopIds.size,
    maxRunKm: Number(summary.maxRunKm.toFixed(1)),
    maxRunMinutes: Math.round(summary.maxRunMinutes),
    medianCombinedHeadwayMinutes: Math.round(median(headways) ?? 0),
    serviceStart: summary.earliest,
    serviceEnd: summary.latest,
    representative: summary.representative,
    bounds: summary.bounds,
  }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: node scripts/analyze-postbus-corridors.mjs --archive /path/feed.zip ' +
        '[--date YYYY-MM-DD] [--route-ids 96-930-j26-1,...] [--min-km 12] ' +
        '[--min-trips 4] [--limit 40]',
    )
    return
  }
  const archive = resolve(requiredArgument('archive'))
  const serviceDate = argument('date', '2026-09-04')
  const requestedRouteIds = argument('route-ids')
  const routeFilter = requestedRouteIds
    ? new Set(requestedRouteIds.split(',').map((value) => value.trim()))
    : undefined
  const limit = Number(argument('limit', '40'))
  const minimumDistance = Number(argument('min-km', '12'))
  const minimumTrips = Number(argument('min-trips', '4'))
  const [services, sourceStops] = await Promise.all([
    activeServices(archive, serviceDate),
    stopsById(archive),
  ])
  const routes = new Map()
  for await (const row of rowsFromArchive(archive, 'routes.txt')) {
    if (row.agency_id !== POSTBUS_AGENCY_ID || (routeFilter && !routeFilter.has(row.route_id))) {
      continue
    }
    routes.set(row.route_id, {
      id: row.route_id,
      name: row.route_short_name || row.route_long_name,
    })
  }
  const trips = new Map()
  for await (const row of rowsFromArchive(archive, 'trips.txt')) {
    if (!routes.has(row.route_id) || !services.has(row.service_id)) continue
    trips.set(row.trip_id, { routeId: row.route_id, headsign: row.trip_headsign })
  }
  const summaries = new Map()
  let currentTripId
  let currentTrip
  let currentStops = []
  for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
    if (row.trip_id !== currentTripId) {
      finishTrip(currentTrip, currentStops, routes, sourceStops, summaries)
      currentTripId = row.trip_id
      currentTrip = trips.get(row.trip_id)
      currentStops = []
    }
    if (!currentTrip) continue
    currentStops.push({
      stopId: row.stop_id,
      arrival: parseGtfsTime(row.arrival_time),
      departure: parseGtfsTime(row.departure_time),
    })
  }
  finishTrip(currentTrip, currentStops, routes, sourceStops, summaries)
  const ranked = [...summaries.values()]
    .map(publicSummary)
    .filter(
      (summary) =>
        summary.trips >= minimumTrips && summary.maxRunKm >= minimumDistance,
    )
    .sort(
      (first, second) =>
        second.maxRunKm - first.maxRunKm || first.trips - second.trips,
    )
    .slice(0, limit)
  console.log(JSON.stringify({ serviceDate, agencyId: POSTBUS_AGENCY_ID, corridors: ranked }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
