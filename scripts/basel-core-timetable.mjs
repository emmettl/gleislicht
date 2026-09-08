import assert from 'node:assert/strict'
import { activeServices, rowsFromArchive, parseGtfsTime } from '@motionstudies/data/gtfs'
import { previousServiceDate, civilTripInstance } from './civil-day.mjs'
import { compactBaselSnapshot } from './audit-basel-study.mjs'
import { BASEL_AGENCIES } from './basel-line-geometry.mjs'

export function coreRoute(row, policy) {
  const route = { agencyId: row.agency_id, name: row.route_short_name, type: Number(row.route_type) }
  if (BASEL_AGENCIES[route.agencyId] && [700, 702, 705, 900].includes(route.type)) return { ...route, mode: route.type === 900 ? 'tram' : 'bus' }
  if (policy.railServices.some(service => service.agencyId === route.agencyId && service.line === route.name && service.type === route.type)) return { ...route, mode: 'rail' }
}

// Clip only at the edges of a contiguous run. Never bridge an excluded source
// call merely because later calls re-enter the region.
export function coreCallRuns(calls, included) {
  const runs = []
  let start
  for (let i = 0; i <= calls.length; i++) {
    if (i < calls.length && included(calls[i])) { start ??= i; continue }
    if (start !== undefined && i - start >= 2) runs.push({ start, end: i, calls: calls.slice(start, i) })
    start = undefined
  }
  return runs
}

export function coreCivilTrains(id, source, route, stops, policy, date, offsets) {
  const station = call => {
    const stop = stops.get(call.id)
    assert(stop, `Missing source stop ${call.id}`)
    const number = policy.stationAliases[stop.didok] ?? stop.didok
    if (!policy.railStations[number]) return false
    assert.equal(stop.stop_name, policy.railStations[number], `Changed station identity ${number}`)
    return true
  }
  const runs = route.mode === 'rail' ? coreCallRuns(source.calls, station) : [{ start: 0, end: source.calls.length, calls: source.calls }]
  const trains = []
  for (const offset of offsets) for (const run of runs) {
    if (run.calls.length < 2) continue
    const instance = civilTripInstance(id, run.calls, {}, offset, date)
    const start = instance.stops[0].departure, end = instance.stops.at(-1).arrival
    if (start >= 86400 || end < 0) continue
    const clipped = run.start !== 0 || run.end !== source.calls.length
    trains.push({ id: runs.length > 1 ? `${instance.id}:run:${run.start}` : instance.id,
      ...instance.metadata, routeId: source.routeId, route: route.name,
      category: route.mode === 'rail' ? (route.name.startsWith('S') ? 's-bahn' : 'regional') : route.mode,
      headsign: source.headsign, shortName: source.shortName, start, end, calls: instance.stops,
      ...(route.mode === 'rail' ? { sourceCallRange: [run.start, run.end], sourceCallCount: source.calls.length, clippedToCore: clipped } : {}),
    })
  }
  return trains
}

export async function readBaselCoreTimetables(archive, dates, policy) {
  assert.equal(policy.schemaVersion, 1)
  assert(dates.length && new Set(dates).size === dates.length)
  for (const date of dates) assert(policy.serviceDates.includes(date), `Unreviewed Basel core date ${date}`)
  const calendars = new Map()
  for (const date of new Set(dates.flatMap(date => [previousServiceDate(date), date]))) calendars.set(date, await activeServices(archive, date))
  const allActive = new Set([...calendars.values()].flatMap(set => [...set]))
  const routes = new Map(), stops = new Map(), sourceTrips = new Map(), feed = []
  for await (const row of rowsFromArchive(archive, 'feed_info.txt')) feed.push(row)
  for await (const row of rowsFromArchive(archive, 'routes.txt')) { const route = coreRoute(row, policy); if (route) routes.set(row.route_id, route) }
  for await (const row of rowsFromArchive(archive, 'stops.txt')) stops.set(row.stop_id, row)
  for await (const row of rowsFromArchive(archive, 'trips.txt')) if (routes.has(row.route_id) && allActive.has(row.service_id)) {
    assert(!sourceTrips.has(row.trip_id), 'Duplicate GTFS trip identity')
    sourceTrips.set(row.trip_id, { routeId: row.route_id, serviceId: row.service_id, headsign: row.trip_headsign, shortName: row.trip_short_name, calls: [] })
  }
  for await (const row of rowsFromArchive(archive, 'frequencies.txt')) assert(!sourceTrips.has(row.trip_id), 'Active Basel frequency template requires a source-instance audit')
  console.log('Reading complete source calls for all Basel core fixture calendars…')
  for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
    const trip = sourceTrips.get(row.trip_id)
    if (trip) trip.calls.push({ id: row.stop_id, sequence: Number(row.stop_sequence), arrival: parseGtfsTime(row.arrival_time || row.departure_time), departure: parseGtfsTime(row.departure_time || row.arrival_time) })
  }
  for (const trip of sourceTrips.values()) {
    trip.calls.sort((a, b) => a.sequence - b.sequence)
    assert(new Set(trip.calls.map(call => call.sequence)).size === trip.calls.length, 'Duplicate source stop sequence')
    assert(trip.calls.every((call, i) => Number.isFinite(call.arrival) && Number.isFinite(call.departure) && call.arrival <= call.departure && (!i || call.arrival >= trip.calls[i - 1].departure)), 'Invalid source stop times')
  }
  return { routes, snapshots: dates.map(date => {
    const platforms = [], indices = new Map(), trains = []
    for (const [id, source] of sourceTrips) {
      const offsets = [0, -86400].filter(offset => calendars.get(offset ? previousServiceDate(date) : date).has(source.serviceId))
      for (const train of coreCivilTrains(id, source, routes.get(source.routeId), stops, policy, date, offsets)) {
        const { calls, ...metadata } = train
        trains.push({ ...metadata, stops: calls.map(call => {
          if (!indices.has(call.id)) {
            const stop = stops.get(call.id)
            assert(stop && Number.isFinite(Number(stop.stop_lon)) && Number.isFinite(Number(stop.stop_lat)), 'Invalid source platform')
            indices.set(call.id, platforms.length)
            platforms.push([Number(stop.stop_lon), Number(stop.stop_lat), stop.stop_name, stop.platform_code, call.id])
          }
          return [indices.get(call.id), call.arrival, call.departure]
        }) })
      }
    }
    assert(new Set(trains.map(train => train.id)).size === trains.length, 'Duplicate Basel civil instance')
    assert(trains.length, 'Empty Basel core timetable')
    return compactBaselSnapshot({ metadata: { publisher: 'SBB', feedVersion: feed[0].feed_version, serviceDate: date,
      dayModel: 'civil day with preceding service-day spillover', sourceServiceDates: [previousServiceDate(date), date],
      windowStart: 0, windowEnd: 86400, focusTime: 27900, modes: ['tram', 'bus', 'rail'], localAgencyIds: ['823', '37'],
      sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020',
    }, stops: platforms, trains })
  }) }
}
