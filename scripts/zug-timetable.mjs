import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { activeServices, rowsFromArchive, parseGtfsTime } from '@motionstudies/data/gtfs'
import { previousServiceDate, civilTripInstance } from './civil-day.mjs'
import { readFrequencyIntervals, expandFrequencyTrip } from './gtfs-frequencies.mjs'
import { sha256 } from './download-luzern-sources.mjs'

export function inRing([x, y], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i], [c, d] = ring[j]
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) inside = !inside
  }
  return inside
}
export function inCanton(point, geometry) {
  assert.equal(geometry.type, 'MultiPolygon')
  return geometry.coordinates.some(([outer, ...holes]) => inRing(point, outer) && !holes.some(hole => inRing(point, hole)))
}
export function zugMode(type) {
  if (type === 3 || (type >= 200 && type < 300) || (type >= 700 && type < 900)) return 'bus'
  if ([0, 900].includes(type)) return 'tram'
  if (type === 116) return 'mountain'
  if (type === 2 || (type >= 100 && type < 200)) return 'rail'
  if ([4, 1000, 1200].includes(type)) return 'boat'
  if ([5, 6, 7].includes(type) || (type >= 1300 && type < 1500)) return 'mountain'
  return 'other'
}

export function civilInstances(id, trip, intervals, offsets, date) {
  const result = []
  for (const offset of offsets) {
    const instances = intervals ? expandFrequencyTrip(id, trip.calls, intervals, -offset, 86400 - offset) : [{ id, stops: trip.calls }]
    for (const instance of instances) {
      const civil = civilTripInstance(instance.id, instance.stops, instance.frequency ? { frequency: instance.frequency } : {}, offset, date)
      if (civil.stops.length < 2 || civil.stops[0].departure >= 86400 || civil.stops.at(-1).arrival < 0) continue
      result.push(civil)
    }
  }
  return result
}

// Two streamed passes avoid loading the national stop_times table. First census
// EVERY timetable record calling in the polygon, then keep complete fixture trips.
export async function readZugTimetable(archive, boundaryPath, dates) {
  const boundaryBytes = await readFile(boundaryPath), boundary = JSON.parse(boundaryBytes).feature
  assert.equal(boundary.properties.ak, 'ZG')
  const calendars = new Map()
  for (const date of new Set(dates.flatMap(date => [previousServiceDate(date), date]))) calendars.set(date, await activeServices(archive, date))
  const active = new Set([...calendars.values()].flatMap(set => [...set]))
  const stops = new Map(), routes = new Map(), agencies = new Map(), cantonStops = new Set(), scopedIds = new Set(), selected = new Map()
  let feed
  for await (const row of rowsFromArchive(archive, 'feed_info.txt')) feed = row
  for await (const row of rowsFromArchive(archive, 'agency.txt')) agencies.set(row.agency_id, row)
  for await (const row of rowsFromArchive(archive, 'routes.txt')) routes.set(row.route_id, row)
  for await (const row of rowsFromArchive(archive, 'stops.txt')) {
    stops.set(row.stop_id, row)
    const point = [Number(row.stop_lon), Number(row.stop_lat)], box = boundary.bbox
    if (point[0] >= box[0] && point[0] <= box[2] && point[1] >= box[1] && point[1] <= box[3] && inCanton(point, boundary.geometry)) cantonStops.add(row.stop_id)
  }
  console.log(`Census: ${cantonStops.size} GTFS stop records in the Zug polygon; scanning all annual stop times…`)
  const calledStops = new Set(), scopedCalls = new Map(), routeCantonStops = new Map()
  let annualStopTimeRows = 0
  for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
    annualStopTimeRows++
    if (cantonStops.has(row.stop_id)) {
      scopedIds.add(row.trip_id); calledStops.add(row.stop_id)
      if (!scopedCalls.has(row.trip_id)) scopedCalls.set(row.trip_id, new Set())
      scopedCalls.get(row.trip_id).add(row.stop_id)
    }
  }
  const inventory = new Map()
  for await (const row of rowsFromArchive(archive, 'trips.txt')) {
    if (!scopedIds.has(row.trip_id)) continue
    const route = routes.get(row.route_id); assert(route)
    if (!routeCantonStops.has(row.route_id)) routeCantonStops.set(row.route_id, new Set())
    for (const stop of scopedCalls.get(row.trip_id)) routeCantonStops.get(row.route_id).add(stop)
    const item = inventory.get(row.route_id) ?? { routeId: row.route_id, agencyId: route.agency_id, agency: agencies.get(route.agency_id).agency_name,
      line: route.route_short_name, longName: route.route_long_name, routeType: Number(route.route_type), mode: zugMode(Number(route.route_type)), annualTripRecords: 0,
      activeSourceTripRecords: Object.fromEntries(dates.map(date => [date, 0])) }
    item.annualTripRecords++
    for (const date of dates) if (calendars.get(date).has(row.service_id)) item.activeSourceTripRecords[date]++
    inventory.set(row.route_id, item)
    if (active.has(row.service_id)) selected.set(row.trip_id, { routeId: row.route_id, serviceId: row.service_id, directionId: row.direction_id, headsign: row.trip_headsign, shortName: row.trip_short_name, calls: [] })
  }
  const frequency = await readFrequencyIntervals(archive, selected)
  console.log(`Census found ${inventory.size} routes and ${scopedIds.size} annual trip records; reading ${selected.size} complete fixture trips…`)
  for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
    const trip = selected.get(row.trip_id)
    if (trip) trip.calls.push({ id: row.stop_id, sequence: Number(row.stop_sequence), arrival: parseGtfsTime(row.arrival_time || row.departure_time), departure: parseGtfsTime(row.departure_time || row.arrival_time), pickupType: row.pickup_type || '0', dropOffType: row.drop_off_type || '0' })
  }
  for (const trip of selected.values()) {
    trip.calls.sort((a, b) => a.sequence - b.sequence)
    assert(trip.calls.length >= 2 && new Set(trip.calls.map(c => c.sequence)).size === trip.calls.length, 'Missing or duplicate calls')
    assert(trip.calls.every((c, i) => Number.isFinite(c.arrival) && Number.isFinite(c.departure) && c.arrival <= c.departure && (!i || c.arrival >= trip.calls[i - 1].departure)), 'Invalid call times')
  }
  const usedStops = new Set([...selected.values()].flatMap(trip => trip.calls.map(c => c.id)))
  const snapshots = dates.map(date => {
    const trains = []
    for (const [id, trip] of selected) {
      const offsets = [0, -86400].filter(offset => calendars.get(offset ? previousServiceDate(date) : date).has(trip.serviceId))
      for (const instance of civilInstances(id, trip, frequency.get(id), offsets, date)) trains.push({ id: instance.id, ...instance.metadata, routeId: trip.routeId, directionId: trip.directionId,
        headsign: trip.headsign, shortName: trip.shortName, calls: instance.stops })
    }
    assert.equal(new Set(trains.map(t => t.id)).size, trains.length)
    return { date, trains }
  })
  return { schemaVersion: 1, feed, dates, sourceHashes: { archive: sha256(await readFile(archive)), boundary: sha256(boundaryBytes) },
    scope: { description: 'Every annual GTFS trip with at least one source stop inside the complete official Zug polygon, across every agency and mode. Fixture trips retain every source call, including cross-canton termini. No straight-line crossing test for nonstopping through traffic.',
      annualStopTimeRows, annualScopedTripRecords: scopedIds.size, cantonStopRecords: cantonStops.size, calledCantonStopRecords: calledStops.size },
    inventory: [...inventory.values()].map(r => ({ ...r, annualCantonStopIds: [...routeCantonStops.get(r.routeId)].sort() })).sort((a, b) => a.routeId.localeCompare(b.routeId)),
    cantonStops: [...cantonStops].map(id => stops.get(id)),
    stops: [...usedStops].map(id => stops.get(id)), snapshots }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [archive, boundary, output, dateList = '2026-09-04,2026-09-06'] = process.argv.slice(2)
  assert(archive && boundary && output, 'Usage: node scripts/zug-timetable.mjs ARCHIVE BOUNDARY OUTPUT [DATES]')
  const result = await readZugTimetable(archive, boundary, dateList.split(','))
  await writeFile(output, output.endsWith('.gz') ? gzipSync(JSON.stringify(result)) : JSON.stringify(result))
  console.log(JSON.stringify({ scope: result.scope, inventory: result.inventory, days: result.snapshots.map(s => ({ date: s.date, trips: s.trains.length })) }, null, 2))
}
