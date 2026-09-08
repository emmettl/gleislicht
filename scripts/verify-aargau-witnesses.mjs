// Independent Node/GTFS replay of the Python annual calendar and complete-chain census.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { rowsFromArchive, parseGtfsTime } from '@motionstudies/data/gtfs'
import { hashFile } from './inventory-aargau.mjs'
const archive = process.argv[2], root = 'data/aargau-witnesses'
assert(archive, 'Supply the pinned annual GTFS archive')
const read = async file => JSON.parse(await readFile(file, 'utf8'))
const report = await read(`${root}/inventory.json`)
assert.equal(await hashFile(archive), report.archiveSha256)
for (const [file, hash] of Object.entries(report.inputHashes)) assert.equal(await hashFile(file), hash)
assert.equal(await hashFile(`${root}/${report.sourcePatternsFile}`), report.sourcePatternsSha256)
const source = JSON.parse(gunzipSync(await readFile(`${root}/${report.sourcePatternsFile}`)))
const inventory = await read('data/aargau-seasonal/input/inventory.json')
const inside = new Set(inventory.cantonStopIds), targets = new Set(report.routes.map(r => r.routeId))
const trains = new Map(source.trains.map(t => [t.sourceTripId, t])); assert.equal(trains.size, source.trains.length)
const meta = new Map(), platforms = new Map(), services = new Set(), routeRows = new Map()
for await (const row of rowsFromArchive(archive, 'routes.txt')) if (targets.has(row.route_id)) routeRows.set(row.route_id, row)
for await (const row of rowsFromArchive(archive, 'trips.txt')) if (targets.has(row.route_id)) { meta.set(row.trip_id, row); services.add(row.service_id) }
for await (const row of rowsFromArchive(archive, 'stops.txt')) platforms.set(row.stop_id, [Number(row.stop_lon), Number(row.stop_lat), row.stop_name, row.platform_code || '', row.stop_id])
for (const s of source.stops) assert.deepEqual(s, platforms.get(s[4]))
const calendars = [], exceptions = []
for await (const row of rowsFromArchive(archive, 'calendar.txt')) if (services.has(row.service_id)) calendars.push({ ...row })
for await (const row of rowsFromArchive(archive, 'calendar_dates.txt')) if (services.has(row.service_id)) exceptions.push({ ...row })
assert.deepEqual(calendars.sort((a,b) => a.service_id.localeCompare(b.service_id)), [...source.calendars].sort((a,b) => a.service_id.localeCompare(b.service_id)))
assert.deepEqual(exceptions.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), [...source.exceptions].sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
const dateMs = compact => Date.parse(`${compact.slice(0,4)}-${compact.slice(4,6)}-${compact.slice(6,8)}T00:00:00Z`)
const first = dateMs(report.feed.feed_start_date), last = dateMs(report.feed.feed_end_date)
const calendarMap = new Map(calendars.map(c => [c.service_id, c])), exceptionMap = new Map()
for (const e of exceptions) { const key = `${e.service_id}:${e.date}`; assert(!exceptionMap.has(key)); exceptionMap.set(key, e.exception_type) }
const active = new Map([...services].map(s => [s, []]))
for (let day = first; day <= last; day += 86400000) {
  const iso = new Date(day).toISOString().slice(0,10), compact = iso.replaceAll('-',''), weekday = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(day).getUTCDay()]
  for (const sid of services) {
    const c = calendarMap.get(sid), e = exceptionMap.get(`${sid}:${compact}`)
    if (e === '1' || (e !== '2' && c && c.start_date <= compact && compact <= c.end_date && c[weekday] === '1')) active.get(sid).push(iso)
  }
}
const seen = new Set(), routeDays = new Map([...targets].map(id => [id, new Map()]))
let current, calls = [], scanned = 0, verifiedCalls = 0
function flush() {
  if (!meta.has(current) || !calls.some(c => inside.has(c[0]))) return
  assert(!seen.has(current)); seen.add(current)
  const t = trains.get(current), m = meta.get(current); assert(t, `Missing canton trip: ${current}`)
  calls.sort((a,b) => a[5]-b[5])
  assert.deepEqual(t.calls, calls.map(c => c.slice(0,5)))
  verifiedCalls += calls.length
  for (const [field, key] of Object.entries({ routeId:'route_id', serviceId:'service_id', directionId:'direction_id', headsign:'trip_headsign', shortName:'trip_short_name' })) assert.equal(t[field], m[key] || '')
  assert.deepEqual(t.activeServiceDates, active.get(t.serviceId))
  assert.equal(t.start, calls[0][2]); assert.equal(t.end, calls.at(-1)[1])
  assert.equal(t.agencyId, routeRows.get(t.routeId).agency_id)
  const counts = routeDays.get(t.routeId)
  for (const iso of active.get(t.serviceId)) {
    const serviceDay = Date.parse(iso+'T00:00:00Z')
    for (const delta of [0, 1]) {
      const day = serviceDay + delta*86400000
      if (day > last || t.start - delta*86400 >= 86400 || t.end - delta*86400 <= 0) continue
      const key = new Date(day).toISOString().slice(0,10)
      counts.set(key, (counts.get(key) ?? 0)+1)
    }
  }
}
for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
  if (row.trip_id !== current) { flush(); current = row.trip_id; calls = [] }
  if (meta.has(current)) calls.push([row.stop_id, parseGtfsTime(row.arrival_time || row.departure_time), parseGtfsTime(row.departure_time || row.arrival_time), row.pickup_type || '0', row.drop_off_type || '0', Number(row.stop_sequence)])
  if (++scanned % 10000000 === 0) console.log(`Independently checked ${scanned} national stop-time rows`)
}
flush()
assert.equal(scanned, report.sourceStopTimeRows)
assert.deepEqual(seen, new Set(trains.keys()))
for (const r of report.routes) {
  assert.deepEqual([...routeDays.get(r.routeId)].sort(([a],[b]) => a.localeCompare(b)).map(([date, journeys]) => ({ date, journeys })), r.activeCivilDates)
  if (r.witness) {
    const t = trains.get(r.witness.sourceTripId)
    assert.equal(t.routeId, r.routeId)
    assert(t.activeServiceDates.includes(r.witness.sourceServiceDate))
    assert.equal(Date.parse(r.witnessDate+'T00:00:00Z')-Date.parse(r.witness.sourceServiceDate+'T00:00:00Z'), (-r.witness.serviceOffset*1000) || 0)
    assert(t.start + r.witness.serviceOffset < 86400 && t.end + r.witness.serviceOffset > 0)
  } else assert.equal(routeDays.get(r.routeId).size, 0)
}
const verified = { schemaVersion: 1, inventorySha256: await hashFile(`${root}/inventory.json`), sourcePatternsSha256: await hashFile(`${root}/source-patterns.json.gz`), archiveSha256: report.archiveSha256,
  method: 'Independent Node GTFS parser scans the complete national stop-time archive, verifies exact target trip-set and full-call equality plus platform coordinates, and recomputes every annual service and civil date from weekly calendars and exceptions.',
  nationalStopTimeRows: scanned, completeCantonTrips: seen.size, completeCalls: verifiedCalls, annualCalendarDates: (last-first)/86400000+1, targetRoutes: targets.size, passed: true }
if (process.argv.includes('--check')) assert.deepEqual(await read(`${root}/source-verification.json`), verified)
else await writeFile(`${root}/source-verification.json`, JSON.stringify(verified, null, 2)+'\n')
console.log(verified)
