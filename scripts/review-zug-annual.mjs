import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { parseCsvLine, parseGtfsTime } from '@motionstudies/data/gtfs'
import { inCanton, civilInstances } from './zug-timetable.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { frequencyIntervals } from './gtfs-frequencies.mjs'
import { previousServiceDate } from './civil-day.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const isoDate = s => {
  assert(/^\d{8}$/.test(s), `Invalid GTFS date ${s}`)
  const d = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`
  assert.equal(new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10), d)
  return d
}
const dateRange = (start, end) => {
  const dates = []
  assert(start <= end)
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86400000) dates.push(new Date(t).toISOString().slice(0, 10))
  return dates
}
const dayType = date => weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()]

export function parentStationPatternKey(train, stops) {
  return directedPatternKey({ ...train, calls: train.calls.map(call => {
    let id = call.id
    const seen = new Set()
    while (true) {
      assert(!seen.has(id) && stops.has(id), 'Missing or cyclic parent station')
      seen.add(id)
      const parent = stops.get(id).parent_station
      if (!parent) break
      id = parent
    }
    return { ...call, id }
  }) })
}

// Exceptions override weekly flags, including additions for services absent
// from calendar.txt. Dates outside feed_info validity are never counted.
export function annualServiceDates(calendar, exceptions, start, end, serviceIds) {
  const dates = dateRange(start, end), result = new Map([...serviceIds].map(id => [id, new Set()])), seen = new Set()
  for (const row of calendar) {
    assert(result.has(row.service_id) && !seen.has(row.service_id), 'Unknown or duplicate service calendar')
    seen.add(row.service_id)
    const from = isoDate(row.start_date), to = isoDate(row.end_date)
    assert(from <= to && weekdays.every(day => ['0', '1'].includes(row[day])), 'Invalid weekly calendar')
    for (const date of dates) if (date >= from && date <= to && row[dayType(date)] === '1') result.get(row.service_id).add(date)
  }
  const changes = new Set()
  for (const row of exceptions) {
    const date = isoDate(row.date), key = `${row.service_id}:${date}`
    assert(result.has(row.service_id) && !changes.has(key), 'Unknown or duplicate calendar exception')
    assert(['1', '2'].includes(row.exception_type), 'Invalid exception type')
    changes.add(key)
    if (date < start || date > end) continue
    if (row.exception_type === '1') result.get(row.service_id).add(date)
    else result.get(row.service_id).delete(date)
  }
  return new Map([...result].map(([id, days]) => [id, [...days].sort()]))
}

// Deterministic greedy coverage, not a claim of the smallest possible date set.
// Keep Saturday-only patterns visible instead of forcing a weekday/Sunday date.
export function selectAnnualDates(patterns) {
  const remaining = new Set(patterns.filter(p => !p.fixtureDates.length && p.activeDates.length).map(p => p.id)), candidates = new Map(), selected = []
  for (const p of patterns) if (remaining.has(p.id)) for (const date of p.activeDates) {
    const ids = candidates.get(date) ?? new Set(); ids.add(p.id); candidates.set(date, ids)
  }
  while (remaining.size) {
    const options = [...candidates].map(([date, ids]) => ({ date, newPatternIds: [...ids].filter(id => remaining.has(id)).sort() }))
      .sort((a, b) => b.newPatternIds.length - a.newPatternIds.length || a.date.localeCompare(b.date))
    const best = options[0]; assert(best?.newPatternIds.length, 'Uncovered active pattern')
    selected.push({ ...best, weekday: dayType(best.date) })
    for (const id of best.newPatternIds) remaining.delete(id)
  }
  return selected
}

function csv(bytes) {
  const lines = bytes.toString().trimEnd().split(/\r?\n/), header = parseCsvLine(lines.shift().replace(/^\uFEFF/, ''))
  assert.equal(new Set(header).size, header.length)
  return lines.map(line => {
    const values = parseCsvLine(line); assert.equal(values.length, header.length, 'Malformed retained CSV row')
    return Object.fromEntries(header.map((key, i) => [key, values[i]]))
  })
}

export async function reviewZugAnnual(sourceDirectory = 'data/zug-annual-sources') {
  const catalogueBytes = await readFile(join(sourceDirectory, 'sources.json')), source = JSON.parse(catalogueBytes)
  const fixtureBytes = await readFile('data/zug-timetable.json.gz'), fixture = JSON.parse(gunzipSync(fixtureBytes))
  const boundaryBytes = await readFile('data/zug-sources/boundary.json'), boundary = JSON.parse(boundaryBytes).feature
  const auditBytes = await readFile('data/zug-study-audit.json'), audit = JSON.parse(auditBytes)
  assert.equal(sha256(fixtureBytes), source.fixtureSha256)
  assert.equal(sha256(boundaryBytes), source.boundarySha256)
  assert.equal(source.archiveSha256, fixture.sourceHashes.archive)
  assert.equal(audit.sourceHashes.timetable, source.fixtureSha256)
  assert.deepEqual(source.scope, fixture.scope)
  const tables = new Map()
  for (const f of source.files) {
    const bytes = await readFile(join(sourceDirectory, f.file)); assert.equal(sha256(bytes), f.sha256, `Changed annual source ${f.file}`)
    const rows = csv(gunzipSync(bytes)); assert.equal(rows.length, f.rows)
    tables.set(f.archiveEntry, rows)
  }
  assert.deepEqual(tables.get('feed_info.txt'), [source.feed])
  const stops = new Map(tables.get('stops.txt').map(s => [s.stop_id, s]))
  assert.equal(stops.size, tables.get('stops.txt').length)
  const cantonStops = new Set([...stops.values()].filter(s => {
    const x = +s.stop_lon, y = +s.stop_lat, [a, b, c, d] = boundary.bbox
    return x >= a && x <= c && y >= b && y <= d && inCanton([x, y], boundary.geometry)
  }).map(s => s.stop_id))
  assert.deepEqual([...cantonStops].sort(), fixture.cantonStops.map(s => s.stop_id).sort())
  const routes = new Map(tables.get('routes.txt').map(r => [r.route_id, r]))
  const agencies = new Map(tables.get('agency.txt').map(r => [r.agency_id, r]))
  const trips = new Map(tables.get('trips.txt').map(t => [t.trip_id, { routeId: t.route_id, serviceId: t.service_id,
    directionId: t.direction_id, headsign: t.trip_headsign, shortName: t.trip_short_name, calls: [] }]))
  assert.equal(trips.size, tables.get('trips.txt').length)
  assert.equal(trips.size, fixture.scope.annualScopedTripRecords)
  for (const c of tables.get('stop_times.txt')) {
    assert(trips.has(c.trip_id) && stops.has(c.stop_id), 'Missing annual call identity')
    trips.get(c.trip_id).calls.push({ id: c.stop_id, sequence: +c.stop_sequence,
      arrival: parseGtfsTime(c.arrival_time || c.departure_time), departure: parseGtfsTime(c.departure_time || c.arrival_time),
      pickupType: c.pickup_type || '0', dropOffType: c.drop_off_type || '0' })
  }
  const serviceDates = annualServiceDates(tables.get('calendar.txt'), tables.get('calendar_dates.txt'),
    isoDate(source.feed.feed_start_date), isoDate(source.feed.feed_end_date), new Set([...trips.values()].map(t => t.serviceId)))
  const frequency = frequencyIntervals(tables.get('frequencies.txt'), trips)
  const fixturePatterns = new Map(), fixtureStationPatterns = new Map()
  for (const day of audit.days) for (const p of day.directedPatterns) {
    const train = { ...p, calls: p.stopIds.map((id, i) => ({ id, pickupType: p.callRules[i][0], dropOffType: p.callRules[i][1] })) }
    const key = directedPatternKey(train)
    const stationKey = parentStationPatternKey(train, stops), stationDates = fixtureStationPatterns.get(stationKey) ?? new Set()
    stationDates.add(day.date); fixtureStationPatterns.set(stationKey, stationDates)
    const list = fixturePatterns.get(key) ?? []; list.push({ date: day.date, admitted: p.admitted, trips: p.trips }); fixturePatterns.set(key, list)
  }
  const patterns = new Map(), routeTrips = new Map(), calledCantonStops = new Set()
  for (const [id, t] of trips) {
    t.calls.sort((a, b) => a.sequence - b.sequence)
    assert(t.calls.length >= 2 && t.calls.every(c => Number.isSafeInteger(c.sequence) && c.sequence >= 0) && new Set(t.calls.map(c => c.sequence)).size === t.calls.length, 'Incomplete annual trip')
    assert(t.calls.every((c, i) => Number.isFinite(c.arrival) && Number.isFinite(c.departure) && c.arrival <= c.departure && (!i || c.arrival >= t.calls[i - 1].departure)), 'Invalid annual call times')
    const inScope = t.calls.filter(c => cantonStops.has(c.id)); assert(inScope.length, 'Annual trip has no canton call')
    for (const c of inScope) calledCantonStops.add(c.id)
    const r = routeTrips.get(t.routeId) ?? { trips: [], cantonStops: new Set() }
    r.trips.push(id); inScope.forEach(c => r.cantonStops.add(c.id)); routeTrips.set(t.routeId, r)
    const key = directedPatternKey(t), stationKey = parentStationPatternKey(t, stops)
    const p = patterns.get(key) ?? { id: sha256(key), key, stationKey, parentStationPatternSeenOnFixtures: fixtureStationPatterns.has(stationKey), routeId: t.routeId, directionId: t.directionId,
      stopCalls: t.calls.map(c => ({ id: c.id, pickupType: c.pickupType, dropOffType: c.dropOffType })),
      sourceTrips: [], dates: new Map(), fixtureDates: fixturePatterns.get(key) ?? [] }
    const activeDates = serviceDates.get(t.serviceId)
    p.sourceTrips.push({ tripId: id, serviceId: t.serviceId, activeServiceDays: activeDates.length, frequencyTemplate: frequency.has(id) })
    for (const date of activeDates) p.dates.set(date, (p.dates.get(date) ?? 0) + 1)
    patterns.set(key, p)
  }
  assert.equal(calledCantonStops.size, fixture.scope.calledCantonStopRecords)
  assert.equal(routeTrips.size, fixture.inventory.length)
  for (const r of fixture.inventory) {
    const annual = routeTrips.get(r.routeId), original = routes.get(r.routeId)
    assert.equal(annual.trips.length, r.annualTripRecords)
    assert.deepEqual([...annual.cantonStops].sort(), r.annualCantonStopIds)
    assert.equal(original.agency_id, r.agencyId); assert.equal(original.route_short_name, r.line)
    assert.equal(agencies.get(original.agency_id).agency_name, r.agency)
  }
  // Reconstruct both complete civil windows from these independently extracted
  // annual calls, with calendar exceptions, frequency templates and carry-in.
  for (const day of fixture.snapshots) {
    const rebuilt = []
    for (const [id, t] of trips) {
      const offsets = [0, -86400].filter(offset => serviceDates.get(t.serviceId).includes(offset ? previousServiceDate(day.date) : day.date))
      for (const instance of civilInstances(id, t, frequency.get(id), offsets, day.date)) rebuilt.push({ id: instance.id, ...instance.metadata,
        routeId: t.routeId, directionId: t.directionId, headsign: t.headsign, shortName: t.shortName, calls: instance.stops })
    }
    assert.deepEqual(rebuilt, day.trains, 'Annual source does not reproduce complete fixture calls')
  }
  const reviewedPatterns = [...patterns.values()].map(({ dates, ...p }) => ({ ...p, sourceTrips: p.sourceTrips.sort((a, b) => a.tripId.localeCompare(b.tripId)),
    activeDates: [...dates.keys()].sort(), serviceTripRecordsByDate: Object.fromEntries([...dates].sort(([a], [b]) => a.localeCompare(b))),
    weekdayCounts: Object.fromEntries(weekdays.map(day => [day, [...dates.keys()].filter(date => dayType(date) === day).length])),
    status: p.fixtureDates.length ? 'represented-on-fixtures' : dates.size ? 'active-pattern-not-on-fixtures' : 'no-service-in-feed-validity' }))
    .sort((a, b) => a.id.localeCompare(b.id))
  assert([...fixturePatterns.keys()].every(key => patterns.has(key)), 'Fixture pattern absent from annual inventory')
  const annualRoutes = fixture.inventory.map(r => {
    const rows = reviewedPatterns.filter(p => p.routeId === r.routeId)
    return { routeId: r.routeId, agency: r.agency, line: r.line, mode: r.mode, sourceTripRecords: r.annualTripRecords,
      patterns: rows.length, representedOnFixtures: rows.filter(p => p.fixtureDates.length).length,
      additionalActivePatterns: rows.filter(p => p.status === 'active-pattern-not-on-fixtures').length,
      additionalParentStationPatterns: new Set(rows.filter(p => p.activeDates.length && !p.parentStationPatternSeenOnFixtures).map(p => p.stationKey)).size,
      inactivePatterns: rows.filter(p => !p.activeDates.length).length }
  })
  const missing = reviewedPatterns.filter(p => p.status === 'active-pattern-not-on-fixtures')
  const stationGroups = new Map()
  for (const p of reviewedPatterns) {
    const group = stationGroups.get(p.stationKey) ?? { id: sha256(p.stationKey), key: p.stationKey, fixtureDates: [...(fixtureStationPatterns.get(p.stationKey) ?? [])].sort(), dates: new Set(), exactPatternIds: [] }
    p.activeDates.forEach(date => group.dates.add(date)); group.exactPatternIds.push(p.id); stationGroups.set(p.stationKey, group)
  }
  const parentStationPatterns = [...stationGroups.values()].map(({ dates, ...group }) => ({ ...group, activeDates: [...dates].sort() })).sort((a, b) => a.id.localeCompare(b.id))
  return { schemaVersion: 1, sourceSha256: sha256(catalogueBytes), fixtureAuditSha256: sha256(auditBytes), source,
    summary: { annualRoutes: annualRoutes.length, annualTripRecords: trips.size, annualDirectedPatterns: reviewedPatterns.length,
      representedOnFixtures: reviewedPatterns.filter(p => p.fixtureDates.length).length,
      additionalActivePatterns: reviewedPatterns.filter(p => p.status === 'active-pattern-not-on-fixtures').length,
      inactivePatterns: reviewedPatterns.filter(p => !p.activeDates.length).length,
      annualParentStationPatterns: parentStationPatterns.length,
      additionalParentStationPatterns: parentStationPatterns.filter(p => !p.fixtureDates.length && p.activeDates.length).length,
      additionalPatternsWithKnownParentSequence: missing.filter(p => p.parentStationPatternSeenOnFixtures).length,
      singleServiceDatePatterns: missing.filter(p => p.activeDates.length === 1).length,
      forcedSingleServiceDates: new Set(missing.filter(p => p.activeDates.length === 1).map(p => p.activeDates[0])).size,
      saturdayOnlyAdditionalPatterns: missing.filter(p => p.activeDates.every(date => dayType(date) === 'saturday')).length,
      sundayOnlyAdditionalPatterns: missing.filter(p => p.activeDates.every(date => dayType(date) === 'sunday')).length,
      frequencyTemplates: frequency.size, serviceIds: serviceDates.size, fixturesReproduced: fixture.dates },
    routes: annualRoutes, patterns: reviewedPatterns, proposedServiceDates: selectAnnualDates(reviewedPatterns),
    parentStationPatterns, proposedParentStationServiceDates: selectAnnualDates(parentStationPatterns),
    serviceDates: Object.fromEntries([...serviceDates].sort(([a], [b]) => a.localeCompare(b))),
    limitation: 'Calendar and complete stop-pattern inventory only. Represented means the same route, direction and ordered stop/call-rule pattern appeared on a fixture; timings, geometry validity and construction conditions on other dates are not validated. Parent-station comparisons follow only explicit GTFS parent_station references, retaining direction, repeated calls and call rules; they do not permit platform substitution or geometry admission. Proposed dates cover additional active patterns by source service day using a greedy selection, not a minimal civil-day feed plan. Service-trip-record counts count frequency templates once per active date, not their expanded departures. Inactive records remain explicit. No new geometry or feed admissions.' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await reviewZugAnnual(), output = 'data/zug-annual-audit.json.gz'
  if (process.argv.includes('--check')) assert.deepEqual(JSON.parse(gunzipSync(await readFile(output))), result)
  else await writeFile(output, gzipSync(JSON.stringify(result)))
  console.log(JSON.stringify({ ...result.summary, proposedServiceDateCount: result.proposedServiceDates.length,
    proposedParentStationServiceDates: result.proposedParentStationServiceDates.map(d => ({ date: d.date, weekday: d.weekday, additionalPatterns: d.newPatternIds.length })) }, null, 2))
}
