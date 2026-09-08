import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { activeServices, rowsFromArchive, parseGtfsTime, transportModeForRouteType } from '@motionstudies/data/gtfs'
import { readFrequencyIntervals, expandFrequencyTrip } from './gtfs-frequencies.mjs'
import { pointInCanton } from './aargau-line-geometry.mjs'
import { previousServiceDate } from './civil-day.mjs'

export async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}

export async function inventoryAargau({ archive, sources, dates, output, cantonName = 'Aargau' }) {
  await mkdir(output, { recursive: true })
  const catalogue = JSON.parse(await readFile(join(sources, 'sources.json'), 'utf8'))
  for (const [name, file] of Object.entries(catalogue.files)) assert.equal(await hashFile(join(sources, name)), file.sha256, `Changed source: ${name}`)
  const boundary = JSON.parse(await readFile(join(sources, 'boundary.json'), 'utf8'))
  const stops = new Map(), inside = new Set()
  const points = boundary.coordinates.flat(2)
  const bbox = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]
  for await (const row of rowsFromArchive(archive, 'stops.txt')) {
    const point = [Number(row.stop_lon), Number(row.stop_lat)]
    stops.set(row.stop_id, [...point, row.stop_name, row.platform_code || '', row.stop_id])
    if (point[0] >= bbox[0] && point[0] <= bbox[2] && point[1] >= bbox[1] && point[1] <= bbox[3] && pointInCanton(point, boundary)) inside.add(row.stop_id)
  }
  const agencies = new Map(), routes = [], routeIndices = new Map(), feeds = []
  for await (const row of rowsFromArchive(archive, 'feed_info.txt')) feeds.push(row)
  assert.equal(feeds.length, 1)
  for (const date of dates) assert(date.replaceAll('-', '') >= feeds[0].feed_start_date && date.replaceAll('-', '') <= feeds[0].feed_end_date)
  for await (const row of rowsFromArchive(archive, 'agency.txt')) agencies.set(row.agency_id, row)
  for await (const row of rowsFromArchive(archive, 'routes.txt')) {
    routeIndices.set(row.route_id, routes.length)
    routes.push({ routeId: row.route_id, agencyId: row.agency_id, operator: agencies.get(row.agency_id).agency_name, line: row.route_short_name, longName: row.route_long_name, routeType: Number(row.route_type), mode: transportModeForRouteType(row.route_type) ?? 'unsupported', totalSourceTrips: 0, cantonSourceTrips: 0, cantonStopIds: new Set(), days: dates.map(date => ({ date, trips: 0, afterMidnightStarts: 0, invalidTrips: [] })) })
  }
  const sourceDays = dates.flatMap((date, dayIndex) => [{ date: previousServiceDate(date), dayIndex, offset: -86400 }, { date, dayIndex, offset: 0 }])
  const services = await Promise.all(sourceDays.map(day => activeServices(archive, day.date)))
  const trips = new Map(), activeMetadata = new Map()
  console.log('Reading every national trip identity…')
  for await (const row of rowsFromArchive(archive, 'trips.txt')) {
    const routeIndex = routeIndices.get(row.route_id)
    assert(routeIndex !== undefined && !trips.has(row.trip_id))
    routes[routeIndex].totalSourceTrips++
    trips.set(row.trip_id, routeIndex)
    const active = services.map(s => s.has(row.service_id))
    if (active.some(Boolean)) activeMetadata.set(row.trip_id, { routeIndex, active, directionId: row.direction_id, headsign: row.trip_headsign, shortName: row.trip_short_name })
  }
  const frequencies = await readFrequencyIntervals(archive, activeMetadata)
  const days = dates.map(() => []), finished = new Set()
  let current, calls = [], cantonIds = new Set(), read = 0
  const flush = () => {
    if (!current) return
    assert(!finished.has(current), 'Non-contiguous stop_times trip: cannot stream safely')
    finished.add(current)
    const route = routes[trips.get(current)]
    assert(route, `Unknown trip ${current}`)
    if (!cantonIds.size) return
    route.cantonSourceTrips++
    for (const id of cantonIds) route.cantonStopIds.add(id)
    const meta = activeMetadata.get(current)
    if (!meta) return
    calls.sort((a, b) => a.sequence - b.sequence)
    const invalid = calls.length < 2 || calls.some((c, i) => !Number.isFinite(c.arrival + c.departure) || c.departure < c.arrival || (i && (c.sequence <= calls[i - 1].sequence || c.arrival < calls[i - 1].departure)))
    if (invalid) {
      meta.active.forEach((active, i) => { if (active) route.days[sourceDays[i].dayIndex].invalidTrips.push(current) })
      return
    }
    const intervals = frequencies.get(current)
    meta.active.forEach((active, sourceIndex) => {
      if (!active) return
      const { dayIndex: i, offset, date: sourceDate } = sourceDays[sourceIndex]
      const instances = intervals ? [...expandFrequencyTrip(current, calls, intervals, -offset, 86400-offset)] : [{ id: current, stops: calls }]
      for (const instance of instances) {
      if (instance.stops[0].departure + offset >= 86400 || instance.stops.at(-1).arrival + offset <= 0) continue
      route.days[i].trips++
      if (instance.stops[0].departure >= 86400) route.days[i].afterMidnightStarts++
      days[i].push({ id: `${sourceDate}:${instance.id}`, sourceTripId: current, sourceServiceDate: sourceDate, serviceOffset: offset, routeId: route.routeId, agencyId: route.agencyId, route: route.line || route.longName || route.mode, category: route.mode, directionId: meta.directionId, headsign: meta.headsign, shortName: meta.shortName, ...(instance.frequency ? { frequency: instance.frequency } : {}), start: instance.stops[0].departure + offset, end: instance.stops.at(-1).arrival + offset, calls: instance.stops.map(c => [c.stopId, c.arrival + offset, c.departure + offset, c.pickup, c.dropoff]) })
      }
    })
  }
  console.log(`Streaming all national stop times; ${inside.size} source stop records inside ${cantonName}…`)
  for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
    if (row.trip_id !== current) { flush(); current = row.trip_id; calls = []; cantonIds = new Set() }
    if (inside.has(row.stop_id)) cantonIds.add(row.stop_id)
    if (activeMetadata.has(current)) calls.push({ stopId: row.stop_id, sequence: Number(row.stop_sequence), arrival: row.arrival_time || row.departure_time ? parseGtfsTime(row.arrival_time || row.departure_time) : NaN, departure: row.departure_time || row.arrival_time ? parseGtfsTime(row.departure_time || row.arrival_time) : NaN, pickup: row.pickup_type || '0', dropoff: row.drop_off_type || '0' })
    if (++read % 10000000 === 0) console.log(`${read} stop-time rows scanned`)
  }
  flush()
  const sourceHash = await hashFile(archive)
  const metadata = { feed: feeds[0], archiveSha256: sourceHash, sourceCatalogueSha256: await hashFile(join(sources, 'sources.json')), archiveUrl: 'https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip', dates, sourceServiceDates: [...new Set(sourceDays.map(d => d.date))], dayModel: 'civil day [00:00,24:00): current and preceding service calendars; entire intersecting journeys retained, including calls before/after midnight', sourceRows: { routes: routes.length, trips: trips.size, stopTimes: read, tripsWithStopTimes: finished.size }, boundary: catalogue.boundary }
  const inventory = { schemaVersion: 1, metadata, scope: `All national GTFS route records. Canton membership requires at least one scheduled call inside the complete ${cantonName} polygon on any archived trip, independent of operator or selected dates. Each daily feed retains only trips that themselves call in ${cantonName}, with their entire stop chain. Non-stopping through traffic and services absent from this GTFS are outside the timetable denominator.`, cantonStopIds: [...inside].sort(), agencies: [...agencies.values()], routes: routes.map(r => ({ ...r, cantonStopIds: [...r.cantonStopIds].sort(), admission: !r.cantonSourceTrips ? 'excluded-no-canton-call' : r.mode === 'unsupported' ? 'excluded-unsupported-mode' : r.days.some(d => d.trips) ? 'admitted' : 'inventoried-inactive-on-selected-dates' })) }
  await writeFile(join(output, 'inventory.json'), JSON.stringify(inventory, null, 2)+'\n')
  for (let i = 0; i < dates.length; i++) {
    const used = new Set(days[i].flatMap(t => t.calls.map(c => c[0])))
    const payload = { metadata: { ...metadata, serviceDate: dates[i] }, stops: [...used].sort().map(id => { assert(stops.has(id), `Unknown stop ${id}`); return stops.get(id) }), trains: days[i].filter(t => routes[routeIndices.get(t.routeId)].mode !== 'unsupported') }
    await writeFile(join(output, `${dates[i]}-timetable.json.gz`), gzipSync(JSON.stringify(payload), { level: 9 }))
  }
  console.log(JSON.stringify({ cantonRoutes: routes.filter(r => r.cantonSourceTrips).length, dates: dates.map((date, i) => ({ date, trips: days[i].length })) }))
  return inventory
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => process.argv[process.argv.indexOf(`--${name}`) + 1]
  for (const name of ['archive', 'sources', 'output']) assert(process.argv.includes(`--${name}`), `Missing --${name}`)
  await inventoryAargau({ archive: arg('archive'), sources: arg('sources'), output: arg('output'), dates: (process.argv.includes('--dates') ? arg('dates') : '2026-09-04,2026-09-06').split(',') })
}
