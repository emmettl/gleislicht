import assert from 'node:assert/strict'
import { activeServices, rowsFromArchive, parseGtfsTime, transportModeForRouteType } from '@motionstudies/data/gtfs'
import { previousServiceDate } from './civil-day.mjs'
import { readFrequencyIntervals } from './gtfs-frequencies.mjs'
import { bernArea, bernLv95, bernBoundaryGap } from './bern-spatial.mjs'

import { bernInstances } from './bern-timetable.mjs'

export async function readThurgauTimetables(archive, dates, source, { cantonName = 'Thurgau', boundaryBounds = [2550000, 1115000, 2685000, 1245000] } = {}) {
  const calendars = new Map()
  for (const date of new Set(dates.flatMap(date => [previousServiceDate(date), date]))) calendars.set(date, await activeServices(archive, date))
  const anyActive = new Set([...calendars.values()].flatMap(s => [...s]))
  const agencies = new Map(), routes = new Map(), stops = new Map(), trips = new Map(), feed = []
  for await (const row of rowsFromArchive(archive, 'feed_info.txt')) feed.push(row)
  for await (const row of rowsFromArchive(archive, 'agency.txt')) agencies.set(row.agency_id, row.agency_name)
  for await (const row of rowsFromArchive(archive, 'routes.txt')) routes.set(row.route_id, {
    id: row.route_id, agencyId: row.agency_id, agency: agencies.get(row.agency_id), name: row.route_short_name,
    longName: row.route_long_name, type: Number(row.route_type), mode: transportModeForRouteType(row.route_type) ?? 'unknown',
    allYearTripRecords: 0, inCantonStops: new Set(), districts: new Set(),
  })
  const canton = bernArea(source.canton[0].geometry)
  const districts = source.districts.map(f => [f.properties.name, bernArea(f.geometry)])
  const nearBoundary = [], inCanton = new Set()
  for await (const row of rowsFromArchive(archive, 'stops.txt')) {
    const point = [Number(row.stop_lon), Number(row.stop_lat)]
    assert(point.every(Number.isFinite), `Invalid GTFS stop ${row.stop_id}`)
    const xy = bernLv95(point), inside = canton(xy)
    const district = inside ? districts.find(([, contains]) => contains(xy))?.[0] ?? 'cantonal-water-or-boundary' : null
    stops.set(row.stop_id, { point, name: row.stop_name, platform: row.platform_code, didok: row.didok, district, inside })
    if (inside) inCanton.add(row.stop_id)
    // Flag both sides of the boundary; never silently grow the canton polygon.
    if (xy[0] > boundaryBounds[0] && xy[0] < boundaryBounds[2] && xy[1] > boundaryBounds[1] && xy[1] < boundaryBounds[3]) {
      const gap = bernBoundaryGap(xy, source.canton[0].geometry)
      if (gap < 10) nearBoundary.push({ id: row.stop_id, name: row.stop_name, point, inside, gapMetres: gap })
    }
  }
  console.log(`${cantonName} spatial census: ${inCanton.size} GTFS stop records inside the canton`)
  for await (const row of rowsFromArchive(archive, 'trips.txt')) {
    assert(!trips.has(row.trip_id), 'Duplicate GTFS trip')
    trips.set(row.trip_id, { routeId: row.route_id, serviceId: row.service_id, direction: row.direction_id,
      headsign: row.trip_headsign, shortName: row.trip_short_name, inside: false })
  }
  console.log(`Censusing all national stop times for all-year ${cantonName} membership…`)
  let stopTimeRows = 0
  for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
    stopTimeRows++
    if (!inCanton.has(row.stop_id)) continue
    const trip = trips.get(row.trip_id)
    assert(trip, 'Unknown GTFS trip in stop times')
    trip.inside = true
    const route = routes.get(trip.routeId)
    route.inCantonStops.add(row.stop_id); route.districts.add(stops.get(row.stop_id).district)
  }
  const allYearTrips = trips.size
  for (const [id, trip] of trips) {
    if (trip.inside) routes.get(trip.routeId).allYearTripRecords++
    if (!trip.inside || !anyActive.has(trip.serviceId)) trips.delete(id)
    else trip.calls = []
  }
  for (const [id, route] of routes) {
    if (!route.allYearTripRecords) routes.delete(id)
    else { route.inCantonStops = [...route.inCantonStops].sort(); route.districts = [...route.districts].sort() }
  }
  console.log(`Reading complete calls for ${trips.size} dated ${cantonName} trips, ${routes.size} all-year routes…`)
  const frequencies = await readFrequencyIntervals(archive, trips)
  for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
    const trip = trips.get(row.trip_id)
    if (trip) trip.calls.push({ id: row.stop_id, sequence: Number(row.stop_sequence),
      arrival: parseGtfsTime(row.arrival_time || row.departure_time), departure: parseGtfsTime(row.departure_time || row.arrival_time),
      pickup: Number(row.pickup_type || 0), dropOff: Number(row.drop_off_type || 0) })
  }
  for (const [id, trip] of trips) {
    trip.calls.sort((a, b) => a.sequence - b.sequence)
    assert(new Set(trip.calls.map(c => c.sequence)).size === trip.calls.length, `Duplicate stop sequence ${id}`)
    assert(trip.calls.every((c, i) => stops.has(c.id) && Number.isFinite(c.arrival) && Number.isFinite(c.departure) && c.arrival <= c.departure && (!i || c.arrival >= trip.calls[i - 1].departure)), `Invalid call chain ${id}`)
    assert(trip.calls.some(c => inCanton.has(c.id)), 'Lost geographic membership')
  }
  const snapshots = dates.map(date => {
    const platforms = [], indexes = new Map(), trains = []
    for (const [id, trip] of trips) for (const instance of bernInstances(id, trip, date, calendars, frequencies.get(id))) {
      const route = routes.get(trip.routeId), { calls, ...metadata } = instance
      trains.push({ ...metadata, routeId: route.id, agencyId: route.agencyId, route: route.name,
        category: route.mode === 'rail' ? (route.name.startsWith('S') ? 's-bahn' : 'regional') : route.mode,
        directionId: trip.direction, headsign: trip.headsign, shortName: trip.shortName,
        sourceCallCount: calls.length, reservationRequired: calls.some(c => [2, 3].includes(c.pickup) || [2, 3].includes(c.dropOff)),
        callPermissions: calls.map(c => [c.pickup, c.dropOff]),
        stops: calls.map(c => {
          if (!indexes.has(c.id)) {
            const stop = stops.get(c.id)
            indexes.set(c.id, platforms.length); platforms.push([...stop.point, stop.name, stop.platform, c.id])
          }
          return [indexes.get(c.id), c.arrival, c.departure]
        }) })
    }
    assert(new Set(trains.map(t => t.id)).size === trains.length, 'Duplicate Thurgau civil instance')
    return { metadata: { publisher: 'SBB', feedVersion: feed[0].feed_version, serviceDate: date,
      sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020',
      dayModel: 'civil day with preceding service-day spillover', sourceServiceDates: [previousServiceDate(date), date],
      windowStart: 0, windowEnd: 86400, focusTime: 27900, modes: [...new Set([...routes.values()].map(r => r.mode))] }, stops: platforms, trains }
  })
  const sourceStopInventory = [...stops.entries()].filter(([, stop]) => stop.inside).map(([id, stop]) => ({ id, ...stop }))
  return { schemaVersion: 1, routes: [...routes.values()], snapshots, sourceStopInventory,
    census: { allYearTrips, stopTimeRows, selectedAllYearRoutes: routes.size, datedSourceTrips: trips.size, frequencyTemplates: frequencies.size,
      boundaryRule: `At least one original GTFS call coordinate in the unsimplified 2026 ${cantonName} canton polygon. Full journey retained, including every call outside ${cantonName}. No operator whitelist.`,
      allYearMeaning: 'All trip records in the pinned annual archive, including records inactive on both validation dates; not a claim of operating every day.', nearBoundary } }
}

if (process.argv[1]?.endsWith('/thurgau-timetable.mjs')) {
  const { readFile, writeFile } = await import('node:fs/promises')
  const { gzipSync, gunzipSync } = await import('node:zlib')
  const { createHash } = await import('node:crypto')
  const bytes = await readFile('data/thurgau-sources/decoded.json.gz')
  const result = await readThurgauTimetables(process.argv[2], ['2026-09-04', '2026-09-06'], JSON.parse(gunzipSync(bytes)))
  result.sourceHashes = { archive: createHash('sha256').update(await readFile(process.argv[2])).digest('hex'), source: createHash('sha256').update(bytes).digest('hex') }
  await writeFile('/private/tmp/thurgau-timetable-cache.json.gz', gzipSync(JSON.stringify(result)))
  console.log(JSON.stringify({ routes: result.routes.length, census: result.census }))
}
