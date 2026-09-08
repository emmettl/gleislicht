import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { rowsFromArchive, parseGtfsTime } from '@motionstudies/data/gtfs'
import { readFrequencyIntervals } from './gtfs-frequencies.mjs'
import { previousServiceDate } from './civil-day.mjs'
import { readJson, saveJson } from './build-graubuenden-region.mjs'
import { GR_SEASONAL_DATES, seasonalCounts, seasonalStatus } from './graubuenden-seasonal.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const archive = process.argv[2] ?? '/private/tmp/GTFS_FP2026_20260902.zip'
const raw = await readJson('data/graubuenden-audit/seasonal-timetable.json.gz'), summary = await readJson('data/graubuenden-audit/seasonal-summary.json'), reports = await readJson('data/graubuenden-audit/seasonal-patterns.json.gz')
assert.equal(sha256(await readFile(archive)), raw.sourceHashes.archive)
assert.equal(summary.timetableSha256, sha256(await readFile('data/graubuenden-audit/seasonal-timetable.json.gz')))
assert.deepEqual(raw.dates, GR_SEASONAL_DATES)
const baseline = new Map()
for (const [file, hash] of Object.entries(summary.baselineFiles)) {
 const bytes = await readFile(file); assert.equal(sha256(bytes), hash)
 for (const p of JSON.parse(bytes).patterns) baseline.set(p.id, p)
}
const sourceDates = [...new Set(raw.dates.flatMap(d => [d, previousServiceDate(d)]))], active = new Map(sourceDates.map(d => [d, new Set()]))
const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
for await (const r of rowsFromArchive(archive, 'calendar.txt')) for (const d of sourceDates) {
 const compact = d.replaceAll('-', '')
 if (r.start_date <= compact && r.end_date >= compact && r[weekdays[new Date(d+'T12:00:00Z').getUTCDay()]] === '1') active.get(d).add(r.service_id)
}
for await (const r of rowsFromArchive(archive, 'calendar_dates.txt')) {
 const d = `${r.date.slice(0,4)}-${r.date.slice(4,6)}-${r.date.slice(6,8)}`
 if (active.has(d)) { if (r.exception_type === '1') active.get(d).add(r.service_id); else if (r.exception_type === '2') active.get(d).delete(r.service_id) }
}
const ids = new Set(raw.snapshots.flatMap(d => d.trains.map(t => t.sourceTripId))), source = new Map()
for await (const r of rowsFromArchive(archive, 'trips.txt')) if (ids.has(r.trip_id)) source.set(r.trip_id, { routeId: r.route_id, directionId: r.direction_id, serviceId: r.service_id, calls: [] })
assert.equal(source.size, ids.size)
let rows = 0
for await (const r of rowsFromArchive(archive, 'stop_times.txt')) {
 rows++
 const t = source.get(r.trip_id)
 if (t) t.calls.push({ id: r.stop_id, sequence: Number(r.stop_sequence), arrival: parseGtfsTime(r.arrival_time || r.departure_time), departure: parseGtfsTime(r.departure_time || r.arrival_time), pickupType: r.pickup_type || '0', dropOffType: r.drop_off_type || '0' })
}
assert.equal(rows, raw.scope.annualStopTimeRows)
for (const t of source.values()) t.calls.sort((a,b) => a.sequence-b.sequence)
const frequencies = await readFrequencyIntervals(archive, source), checked = []
for (const day of raw.snapshots) {
 const report = reports.find(d => d.date === day.date), patterns = new Map(report.patterns.map(p => [p.id, p])), counts = new Map()
 assert.equal(new Set(day.trains.map(t => t.id)).size, day.trains.length)
 for (const t of day.trains) {
  const original = source.get(t.sourceTripId); assert(active.get(t.sourceServiceDate)?.has(original.serviceId), 'Inactive service entered sample')
  assert.equal(t.routeId, original.routeId); assert.equal(t.directionId, original.directionId)
  assert([day.date, previousServiceDate(day.date)].includes(t.sourceServiceDate))
  const offset = t.sourceServiceDate === day.date ? 0 : -86400
  let delta = offset
  if (t.frequency) {
   const interval = frequencies.get(t.sourceTripId)?.find(f => f.startTime + offset === t.frequency.startTime && f.endTime + offset === t.frequency.endTime && f.headwaySeconds === t.frequency.headwaySeconds && f.exactTimes === t.frequency.exactTimes)
   assert(interval, 'Changed frequency interval')
   const departure = t.calls[0].departure - offset
   assert(departure >= interval.startTime && departure < interval.endTime)
   assert.equal((departure - interval.startTime) % interval.headwaySeconds, 0, 'Shifted headway grid')
   delta = t.calls[0].departure - original.calls[0].departure
  } else assert(!frequencies.has(t.sourceTripId), 'Lost headway semantics')
  assert.deepEqual(t.calls, original.calls.map(c => ({ ...c, arrival: c.arrival + delta, departure: c.departure + delta })), 'Cropped or changed source calls')
  assert(t.calls[0].departure < 86400 && t.calls.at(-1).arrival >= 0)
  const id = sha256(directedPatternKey(t)).slice(0,20), p = patterns.get(id); assert(p)
  assert.equal(p.status, seasonalStatus(t, baseline)); assert.deepEqual(p.stopIds,t.calls.map(c => c.id)); assert.deepEqual(p.callRules,t.calls.map(c=>[c.pickupType,c.dropOffType]))
  const v=counts.get(id)??{trips:0,headwayTrips:0,carryInTrips:0};v.trips++;v.headwayTrips+=Number(t.frequency?.exactTimes===0);v.carryInTrips+=Number(offset!==0);counts.set(id,v)
 }
 assert.equal(counts.size,patterns.size)
 for(const p of patterns.values()) for(const [k,v]of Object.entries(counts.get(p.id)))assert.equal(p[k],v)
 for(const [k,v]of Object.entries(seasonalCounts(report.patterns))) {assert.deepEqual(report[k],v);assert.deepEqual(summary.days.find(d=>d.date===day.date)[k],v)}
 for(const r of summary.routes)assert.deepEqual(r.days.find(d=>d.date===day.date),{date:day.date,...seasonalCounts(report.patterns.filter(p=>p.routeId===r.routeId))})
 checked.push({date:day.date,journeys:day.trains.length,completeOriginalCallsAndTimes:true,calendarExceptions:true,sourceHeadwayGrid:true})
}
const index=await readJson('public/data/graubuenden-region/index.json');assert.deepEqual(index.dates.map(d=>d.date),['2026-09-04','2026-09-06'],'Unreviewed seasonal date was released')
await saveJson('data/graubuenden-audit/seasonal-validation.json',{passed:true,timetableSha256:summary.timetableSha256,summarySha256:sha256(await readFile('data/graubuenden-audit/seasonal-summary.json')),patternsSha256:sha256(await readFile('data/graubuenden-audit/seasonal-patterns.json.gz')),sourceArchiveSha256:raw.sourceHashes.archive,sourceTripRecords:source.size,annualStopTimeRows:rows,days:checked,seasonalGeometryCertified:false,dstRepeatedHourDisambiguated:false})
console.log(JSON.stringify({sourceTrips:source.size,checkedJourneys:checked.reduce((n,d)=>n+d.journeys,0),dates:checked.length,seasonalDatesReleased:false}))
