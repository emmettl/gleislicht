import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { previousServiceDate } from './civil-day.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { rowsFromArchive, parseGtfsTime, transportModeForRouteType } from '@motionstudies/data/gtfs'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { applyRivieraFuniculars, loadRivieraFuniculars } from './riviera-funicular-geometry.mjs'
import { applyRoadCache } from './enrich-postbus-roads.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { summarizeVaud, validateVaudArtifacts } from './audit-vaud-study.mjs'
import { assertCompleteRivieraCalls, RIVIERA_AGENCIES, rivieraRailCorridors, applyRivieraRailGeometry } from './riviera-rail-geometry.mjs'
const [archive, railPath, weekdayPath, sundayPath, output] = process.argv.slice(2)
assert(output, 'Usage: ARCHIVE RAIL COMPLETE_WEEKDAY COMPLETE_SUNDAY OUTPUT')
const digest = createHash('sha256'); for await (const bytes of createReadStream(archive)) digest.update(bytes); const archiveSha256 = digest.digest('hex')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const agencies = new Map(); for await (const row of rowsFromArchive(archive, 'agency.txt')) agencies.set(row.agency_id, row.agency_name)
const routes = new Map()
for await (const r of rowsFromArchive(archive, 'routes.txt')) routes.set(r.route_id, { agencyId: r.agency_id, name: r.route_short_name, mode: transportModeForRouteType(r.route_type) })
const feed = []; for await (const row of rowsFromArchive(archive, 'feed_info.txt')) feed.push(row)
const bytes = await Promise.all([weekdayPath, sundayPath].map(path => readFile(path)))
const days = bytes.map(b => JSON.parse(b)), sourceTrips = new Set(days.flatMap(day => day.trains.map(t => t.sourceTripId))), tripRoutes = new Map()
for await (const row of rowsFromArchive(archive, 'trips.txt')) if (sourceTrips.has(row.trip_id)) tripRoutes.set(row.trip_id, row.route_id)
const calls = new Map([...sourceTrips].map(id => [id, []]))
for await (const row of rowsFromArchive(archive, 'stop_times.txt')) if (calls.has(row.trip_id)) calls.get(row.trip_id).push({ id: row.stop_id, sequence: +row.stop_sequence, arrival: parseGtfsTime(row.arrival_time || row.departure_time), departure: parseGtfsTime(row.departure_time || row.arrival_time) })
for (const rows of calls.values()) rows.sort((a, b) => a.sequence - b.sequence)
const railBytes = await readFile(railPath), corridors = rivieraRailCorridors(parseRailNetworkXtf(railBytes.toString(), 10))
const { source: funicularSource, sha256: funicularSha256 } = await loadRivieraFuniculars()
const reports = []
for (const [i, day] of days.entries()) {
  assert.deepEqual(day.metadata.agencyIds, RIVIERA_AGENCIES)
  assert.deepEqual(day.metadata.sourceServiceDates, [previousServiceDate(day.metadata.serviceDate), day.metadata.serviceDate])
  assert.equal(new Set(day.trains.map(t => t.id)).size, day.trains.length, 'Duplicate Riviera journey')
  assert.equal(day.metadata.feedVersion, feed[0].feed_version)
  assert.equal(day.metadata.dayModel, 'civil day with preceding service-day spillover')
  assert(day.metadata.windowStart === 0 && day.metadata.windowEnd === 86400)
  day.trains = day.trains.map(train => {
    const routeId = tripRoutes.get(train.sourceTripId); assert(routeId)
    if (train.routeId) assert.equal(train.routeId, routeId)
    assertCompleteRivieraCalls(train, day.stops, calls.get(train.sourceTripId), day.metadata.serviceDate)
    return { ...train, routeId }
  })
  let { snapshot, reports: railReports } = applyRivieraRailGeometry(day, routes, corridors)
  const cacheBytes = await readFile(`data/riviera-sources/road-cache-${day.metadata.serviceDate}.json`), cache = JSON.parse(cacheBytes)
  assert.equal(cache.metadata.serviceDate, day.metadata.serviceDate)
  const bus = applyRoadCache(snapshot, snapshot.trains.filter(t => t.category === 'bus'), cache), offset = snapshot.paths.length
  const buses = new Map(bus.trains.map(t => [t.id, { ...t, pathSegments: t.pathSegments.map(i => i === null ? null : i + offset) }]))
  snapshot.trains = snapshot.trains.map(t => buses.get(t.id) ?? t)
  snapshot.paths.push(...bus.paths)
  snapshot.edgePaths = snapshot.edgePaths.map((index, i) => bus.edgePaths[i] === null ? index : bus.edgePaths[i] + offset)
  snapshot.metadata.geometry = { ...cache.metadata, matchedSegments: bus.matched, totalSegments: bus.total }

  const funicular = applyRivieraFuniculars(snapshot, routes, funicularSource)
  snapshot = funicular.snapshot
  snapshot.metadata.funicularGeometry = { publisher: funicularSource.metadata.publisher, sourceUrl: funicularSource.metadata.sourceUrl, termsUrl: funicularSource.metadata.termsUrl, sha256: funicularSha256, model: funicularSource.interpretation, routes: funicular.reports }
  const groups = summarizeVaud(snapshot, routes).map(g => ({ ...g, operator: agencies.get(g.agencyId) }))
  assert(groups.every(g => g.coverage === 1), 'Riviera: incomplete per-operator geometry')
  const gate = { passed: groups.every(g => g.coverage >= .95), minimumCoverage: .95, deferred: groups.filter(g => g.coverage < .95).map(g => g.id) }
  snapshot.metadata.sourceHashes = { archive: archiveSha256, rail: hash(railBytes), snapshot: hash(bytes[i]), busCache: hash(cacheBytes), funiculars: funicularSha256 }
  snapshot.metadata.studyScope = 'Complete GTFS journeys for MOB, MVR CEV/MTGN/LAS/VCP, VMCV and their replacement agencies on two reviewed dates. Excludes SBB, BLS onward GoldenPass services and boats. Operator scope, not a Riviera geographic boundary.'
  snapshot.metadata.note = 'Scheduled movements on inferred FOT rail, federal funicular centrelines and OSM roads. Complete source journeys for the stated operators and dates; not live positions or independently operator-verified vehicle paths.'
  snapshot.metadata.geometryGate = gate
  snapshot.metadata.railGeometry = { publisher: 'Federal Office of Transport', sha256: hash(railBytes), corridors: railReports.map(r => ({ agencyId: r.agencyId, ...r.corridor, segmentIds: r.segmentIds })), matchedSegments: railReports.reduce((n,r) => n+r.matchedSegments,0), totalSegments: railReports.reduce((n,r) => n+r.totalSegments,0) }
  const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'day-chunks'), morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
  validateVaudArtifacts(manifest, chunks, morning)
  const gzipBytes = value => gzipSync(JSON.stringify(value)).length
  const payload = { manifest: gzipBytes(manifest), morning: gzipBytes(morning), largestChunk: Math.max(...chunks.map(c => gzipBytes(c.payload))) }
  assert(payload.manifest < 650 * 1024 && payload.morning < 1600 * 1024 && payload.largestChunk < 450 * 1024)
  const destination = join(output, day.metadata.serviceDate)
  for (const [name, value] of [['riviera-region-day-manifest.json', manifest], ['riviera-region-morning.json', morning], ...chunks.map(c => [c.descriptor.path, c.payload])]) {
    const path = join(destination, name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value))
  }
  reports.push({ date: day.metadata.serviceDate, trips: day.trains.length, completeSourceJourneysChecked: day.trains.length, groups, payload, railProjection: railReports, funicularGeometry: funicular.reports, gate, sourceHashes: snapshot.metadata.sourceHashes, feedVersion: day.metadata.feedVersion, sourceServiceDates: day.metadata.sourceServiceDates, scope: snapshot.metadata.studyScope })
}
await writeFile(join(output, 'audit.json'), JSON.stringify({ schemaVersion: 1, agencies: RIVIERA_AGENCIES, days: reports }, null, 2) + '\n')
console.log(reports.map(r => ({ date: r.date, trips: r.trips, geometry: r.groups.map(g => [g.id, g.coverage]), payload: r.payload })))
