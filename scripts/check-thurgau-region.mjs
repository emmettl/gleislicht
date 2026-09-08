import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { thurgauFeatureMatch, thurgauPatternId } from './thurgau-line-geometry.mjs'
import { compactBernFeed, validateBernSnapshot, validateBernChunks } from './build-bern-region.mjs'
import { thurgauTimingDiagnostics } from './build-thurgau-region.mjs'
import { checkThurgauRegionalRoads } from './check-thurgau-regional-roads.mjs'
import { loadThurgauRail, isThurgauRailSource } from './thurgau-rail-geometry.mjs'
import { checkThurgauCityRoads } from './check-thurgau-city-roads.mjs'
import { loadThurgauShipping, THURGAU_SHIPPING_SOURCE } from './thurgau-shipping.mjs'
import { loadThurgauFerry, THURGAU_FERRY_SOURCE } from './thurgau-ferry.mjs'
import { loadThurgauBoats } from './thurgau-boat-geometry.mjs'
import { loadThurgauWittenbach } from './thurgau-wittenbach.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const sum = (rows, fn) => rows.reduce((n, row) => n + fn(row), 0)

export async function checkThurgauRegion({ output = 'public/data/thurgau-region', audit = 'data/thurgau-audit', sources = 'data/thurgau-sources' } = {}) {
  const summary = await json(join(audit, 'summary.json')), routes = await json(join(audit, 'routes.json'))
  const sourceLines = await json(join(audit, 'source-lines.json'))
  const decodedBytes = await readFile(join(sources, 'decoded.json.gz')), decoded = JSON.parse(gunzipSync(decodedBytes))
  const crosswalk = await json('data/thurgau-line-crosswalk.json')
  const cityRoads = await checkThurgauCityRoads()
  const regionalRoads = await checkThurgauRegionalRoads()
  assert.equal(sha(await readFile('data/thurgau-regional-roads/cache.json.gz')), summary.sourceHashes.regionalRoads)
  assert.deepEqual(await json(join(output, 'regional-road-paths.json')), regionalRoads)
  assert.equal(sha(await readFile('data/thurgau-city-roads/cache.json.gz')), summary.sourceHashes.cityRoads)
  assert.deepEqual(await json(join(output, 'city-road-paths.json')), cityRoads)
  assert.equal(sha(decodedBytes), summary.sourceHashes.source)
  assert.equal(sha(await readFile(join(sources, 'requests.json'))), summary.sourceHashes.requests)
  assert.equal(sha(await readFile('data/thurgau-line-crosswalk.json')), summary.sourceHashes.crosswalk)
  for (const document of crosswalk.supportingDocuments ?? []) {
    assert.equal(sha(await readFile(join(sources, document.file))), document.sha256)
    assert.equal(sha(await readFile(join(output, document.file))), document.sha256)
  }
  assert.equal(sha(await readFile(join(sources, 'boundary-rows.json.gz'))), decoded.metadata.boundary.snapshotSha256)
  assert.equal(routes.length, summary.routeCount); assert.equal(new Set(routes.map(r => r.id)).size, routes.length)
  assert.equal(new Set(routes.map(r => r.agencyId)).size, summary.agencyCount)
  assert.equal(sourceLines.length, 354); assert.equal(new Set(sourceLines.map(s => s.liniencode)).size, 354)
  assert.equal(summary.districts.length, 5)
  assert(summary.districts.every(d => d.calledPlatforms > 0 && d.routeIds.length > 0))
  const sourceStops = await json(join(audit, 'source-stops.json'))
  assert.equal(sourceStops.length, 718)
  assert.deepEqual(sourceStops.map(s => s.id), decoded.layers.bushalte.map(f => f.id))
  assert.deepEqual(summary.demandResponsiveAreas, decoded.layers.sammeltaxi.map(f => ({ id: f.id, ...f.properties, status: 'excluded-service-area-not-fixed-vehicle-path' })))
  assert.deepEqual(decoded.layers.buslinie.map(({ properties, geometry }) => ({ properties, geometry })), decoded.layers.buslinie_takt.map(({ properties, geometry }) => ({ properties, geometry })))
  for (const route of routes) {
    assert(route.allYearTripRecords > 0 && route.inCantonStops.length > 0 && route.districts.length > 0)
    assert.deepEqual(decoded.lines.filter(f => thurgauFeatureMatch(route, f, crosswalk)).map(f => f.id).sort(), route.sourceLines)
    const trips = sum(route.days, d => d.trips), admitted = sum(route.days, d => d.admittedTrips)
    assert.equal(route.status, !trips ? 'inactive-on-validation-dates' : !admitted ? 'excluded' : admitted === trips ? 'admitted-all-dated-trips' : 'partially-admitted')
  }
  for (const line of sourceLines) assert.deepEqual(line.routeIds.sort(), routes.filter(r => r.sourceLines.includes(line.liniencode)).map(r => r.id).sort())
  for (const term of decoded.metadata.termsFiles) assert.deepEqual(gunzipSync(await readFile(join(sources, term + '.gz'))), await readFile(join(output, term)))
  const cacheBytes = await readFile(join(audit, 'timetable-cache.json.gz'))
  assert.equal(sha(cacheBytes), summary.sourceHashes.timetableCache)
  const cache = JSON.parse(gunzipSync(cacheBytes))
  assert.deepEqual(cache.sourceHashes, { archive: summary.sourceHashes.archive, source: summary.sourceHashes.source })
  const rail = await loadThurgauRail(cache), boats = await loadThurgauBoats(cache), wittenbach = await loadThurgauWittenbach(cache, regionalRoads)
  const shipping = await loadThurgauShipping(cache)
  assert.equal(shipping.policySha256, summary.sourceHashes.shippingPolicy); assert.equal(shipping.policy.sourceSha256, summary.sourceHashes.shippingSource)
  assert.deepEqual(await json(join(output, 'shipping-paths.json')), { metadata: summary.sources.shipping, policy: shipping.policy, patterns: shipping.patterns, riverPolygon: shipping.riverPolygon })
  assert.deepEqual(await json(join(audit, 'shipping-source-elements.json')), shipping.inventory)
  for (const file of ['sources.json', ...shipping.source.files.map(f => f.file)]) assert.deepEqual(await readFile(join(output, 'shipping-sources', file)), await readFile(join('data/thurgau-shipping-sources', file)))
  const ferry = await loadThurgauFerry(cache)
  assert.equal(ferry.policySha256, summary.sourceHashes.ferryPolicy); assert.equal(ferry.policy.sourceSha256, summary.sourceHashes.ferrySource)
  assert.deepEqual(await json(join(output, 'ferry-paths.json')), { metadata: summary.sources.ferry, policy: ferry.policy, paths: ferry.paths })
  assert.deepEqual(await json(join(audit, 'ferry-source-elements.json')), ferry.inventory)
  for (const file of ['sources.json', ...ferry.source.files.map(f => f.file)]) assert.deepEqual(await readFile(join(output, 'ferry-sources', file)), await readFile(join('data/thurgau-ferry-sources', file)))
  assert.equal(wittenbach.policySha256, summary.sourceHashes.wittenbachPolicy); assert.equal(wittenbach.policy.sourceSha256, summary.sourceHashes.wittenbachSource)
  assert.deepEqual(await json(join(output, 'wittenbach-paths.json')), { metadata: summary.sources.wittenbach, policy: wittenbach.policy, turn: wittenbach.turn })
  assert.deepEqual(await json(join(audit, 'wittenbach-turnaround.json')), { ...wittenbach.turn, policySha256: wittenbach.policySha256, patterns: wittenbach.policy.patterns })
  for (const f of ['sources.json', ...wittenbach.source.files.map(f => f.file)]) assert.deepEqual(await readFile(join(output, 'wittenbach-sources', f)), await readFile(join('data/thurgau-wittenbach-sources', f)))
  assert.equal(boats.policySha256, summary.sourceHashes.boatPolicy); assert.equal(boats.policy.sourceSha256, summary.sourceHashes.boatSource)
  assert.deepEqual(await json(join(audit, 'boat-source-segments.json')), boats.inventory)
  assert.deepEqual(await json(join(output, 'boat-sources/policy.json')), boats.policy)
  for (const file of ['sources.json', ...boats.source.files.map(f => f.file)]) assert.deepEqual(await readFile(join(output, 'boat-sources', file)), await readFile(join('data/thurgau-boat-sources', file)))
  assert.equal(rail.border.policySha256, summary.sourceHashes.borderRailPolicy)
  assert.equal(rail.border.policy.sourceSha256, summary.sourceHashes.borderRailSource)
  assert.deepEqual(await json(join(audit, 'border-rail-source-segments.json')), rail.border.inventory)
  for (const file of ['sources.json', 'query.txt']) assert.deepEqual(await readFile(join(output, 'border-rail-sources', file)), await readFile(join('data/thurgau-border-rail-sources', file)))
  const borderDatabase = await json(join(output, 'border-rail-paths.json')), borderSeen = new Map()
  assert.deepEqual(borderDatabase.metadata, summary.sources.borderRail)
  assert.equal(rail.sbb.policySha256, summary.sourceHashes.sbbRailPolicy)
  assert.equal(rail.sbb.policy.sourceSha256, summary.sourceHashes.sbbRailSource)
  assert.deepEqual(await json(join(audit, 'sbb-rail-source-segments.json')), { inventory: rail.sbb.inventory, joins: rail.sbb.joins })
  for (const file of ['sources.json', ...rail.sbb.source.files.map(f => f.file)]) assert.deepEqual(await readFile(join(output, 'sbb-rail-sources', file)), await readFile(join('data/thurgau-sbb-rail-sources', file)))
  assert.equal(rail.policySha256, summary.sourceHashes.railPolicy)
  assert.equal(rail.policy.sourceMetadataSha256, summary.sourceHashes.railSourceMetadata)
  assert.deepEqual(await json(join(audit, 'rail-source-segments.json')), rail.sourceInventory)
  for (const file of ['source.json', 'catalogue.json', 'collection.json']) assert.deepEqual(await readFile(join(output, 'rail-sources', file)), await readFile(join('data/thurgau-rail-sources', file)))
  const { thurgauCrosswalk } = await import('./crosswalk-thurgau.mjs')
  const { applyThurgauGeometry } = await import('./thurgau-line-geometry.mjs')
  assert.deepEqual(thurgauCrosswalk(cache, decoded), crosswalk)
  for (const request of decoded.metadata.requests) {
    const bytes = gunzipSync(await readFile(join(sources, request.file)))
    assert.equal(sha(bytes), request.sha256); assert.equal(bytes.length, request.bytes)
  }
  const patternSets = []
  for (const day of summary.days) {
    const report = await json(join(audit, `${day.serviceDate}.json`))
    assert.deepEqual(report.sourceHashes, summary.sourceHashes)
    assert.deepEqual(report.coverage, day.coverage)
    const replay = applyThurgauGeometry(cache.snapshots.find(s => s.metadata.serviceDate === day.serviceDate), new Map(cache.routes.map(r => [r.id, r])), decoded, crosswalk, cityRoads, regionalRoads, rail, boats, wittenbach, ferry, shipping)
    const baseline = applyThurgauGeometry(cache.snapshots.find(s => s.metadata.serviceDate === day.serviceDate), new Map(cache.routes.map(r => [r.id, r])), decoded, crosswalk, cityRoads, regionalRoads, rail, boats, wittenbach, ferry)
    const railRouteIds = new Set(routes.filter(r => r.mode === 'rail').map(r => r.id))
    assert(replay.trains.filter(t => railRouteIds.has(t.routeId)).every(t => t.admission === 'admitted'), 'A dated rail journey lost full geometry')
    const replayTrains = new Map(replay.trains.map(t => [t.id, t]))
    for (const train of baseline.trains.filter(t => t.admission === 'admitted')) {
      const after = replayTrains.get(train.id)
      assert.deepEqual(after.stops, train.stops); assert.deepEqual(after.callPermissions, train.callPermissions)
      assert.equal(after.admission, 'admitted', 'Shipping supplement removed a previously admitted journey')
      assert.deepEqual(after.pathSegments.map(i => replay.paths[i]), train.pathSegments.map(i => baseline.paths[i]), 'Shipping supplement changed complete existing paths')
    }
    assert.equal(report.shippingCoverage.trips, replay.trains.filter(t => t.geometrySource === THURGAU_SHIPPING_SOURCE && t.admission === 'admitted').length)
    assert.equal(report.shippingCoverage.trips, day.serviceDate === '2026-09-04' ? 22 : 21)
    assert.equal(report.shippingCoverage.patterns, replay.patterns.filter(p => p.geometrySource === THURGAU_SHIPPING_SOURCE).length)
    assert.equal(report.shippingCoverage.rejectedPatterns, replay.patterns.filter(p => p.shippingSupplement?.status === 'rejected-incomplete-pattern').length)
    assert.equal(report.ferryCoverage.trips, replay.trains.filter(t => t.geometrySource === THURGAU_FERRY_SOURCE && t.admission === 'admitted').length)
    assert.equal(report.ferryCoverage.trips, day.serviceDate === '2026-09-04' ? 32 : 28)
    assert.equal(report.ferryCoverage.patterns, 4)
    assert.equal(report.ferryCoverage.patterns, replay.patterns.filter(p => p.geometrySource === THURGAU_FERRY_SOURCE).length)
    assert.equal(report.wittenbachCoverage.trips, replay.trains.filter(t => t.geometrySource === 'osm-wittenbach-turnaround-inference' && t.admission === 'admitted').length)
    assert.equal(report.wittenbachCoverage.patterns, replay.patterns.filter(p => p.geometrySource === 'osm-wittenbach-turnaround-inference').length)
    assert(replay.trains.filter(t => { const r = routes.find(r => r.id === t.routeId); return r.mode === 'bus' && r.type !== 715 && !(r.agencyId === '797' && r.name === 'NT') && !t.reservationRequired }).every(t => t.admission === 'admitted'), 'A dated fixed bus journey lost geometry')
    assert.equal(report.boatCoverage.trips, replay.trains.filter(t => t.geometrySource === 'swisstopo-boat-inference' && t.admission === 'admitted').length)
    assert.equal(report.boatCoverage.patterns, replay.patterns.filter(p => p.geometrySource === 'swisstopo-boat-inference').length)
    assert.equal(report.boatCoverage.rejectedPatterns, replay.patterns.filter(p => p.boatSupplement?.status === 'rejected-incomplete-pattern' && p.ferrySupplement?.status !== 'admitted' && p.shippingSupplement?.status !== 'admitted').length)
    assert.equal(report.boatCoverage.originalRejectedPatterns, replay.patterns.filter(p => p.boatSupplement?.status === 'rejected-incomplete-pattern').length)
    assert.equal(report.borderRailCoverage.trips, replay.trains.filter(t => t.geometrySource === 'fot-osm-border-rail-inference' && t.admission === 'admitted').length)
    assert.equal(report.borderRailCoverage.patterns, replay.patterns.filter(p => p.geometrySource === 'fot-osm-border-rail-inference').length)
    for (const p of replay.patterns.filter(p => p.geometrySource === 'fot-osm-border-rail-inference')) p.railSupplement.segments.forEach((s, i) => {
      if (s.geometrySource === 'fot-osm-border-rail-inference') borderSeen.set(JSON.stringify([p.stopIds[i], p.stopIds[i + 1]]), { stopIds: [p.stopIds[i], p.stopIds[i + 1]], path: replay.paths[p.pathSegments[i]], evidence: s })
    })
    assert.equal(report.sbbRailCoverage.trips, replay.trains.filter(t => t.geometrySource === 'fot-sbb-rail-inference' && t.admission === 'admitted').length)
    assert.equal(report.sbbRailCoverage.patterns, replay.patterns.filter(p => p.geometrySource === 'fot-sbb-rail-inference').length)
    assert.equal(report.railCoverage.trips, replay.trains.filter(t => isThurgauRailSource(t.geometrySource) && t.admission === 'admitted').length)
    assert.equal(report.railCoverage.patterns, replay.patterns.filter(p => isThurgauRailSource(p.geometrySource)).length)
    assert.equal(report.railCoverage.rejectedPatterns, replay.patterns.filter(p => p.railSupplement?.status === 'rejected-incomplete-pattern').length)
    assert.deepEqual(report.patterns, replay.patterns.map(({ pathSegments, ...p }) => ({ ...p, matchedMask: pathSegments.map(i => i !== null) })))
    assert.deepEqual(report.directedPairs, replay.pairs.map(({ pathIndex, ...p }) => ({ ...p, matched: pathIndex !== null })))
    assert.deepEqual(report.timing, thurgauTimingDiagnostics(cache.snapshots.find(s => s.metadata.serviceDate === day.serviceDate), replay, new Map(cache.routes.map(r => [r.id, r]))))
    assert.equal(new Set(report.patterns.map(p => p.id)).size, report.patterns.length)
    patternSets.push(new Set(report.patterns.map(p => p.id)))
    const pairCounts = new Map(), byPattern = new Map(report.patterns.map(p => [p.id, p]))
    for (const p of report.patterns) {
      assert.equal(p.segmentCount, p.stopIds.length - 1)
      assert.equal(p.matchedMask.length, p.segmentCount)
      assert.equal(p.matchedSegments, p.matchedMask.filter(Boolean).length)
      assert.equal(sum(Object.values(p.decisions), n => n), p.trips)
      assert.equal(p.decisions.admitted ?? 0, p.admittedTrips)
      if (p.admittedTrips) assert.equal(p.matchedSegments, p.segmentCount)
      for (let i = 1; i < p.stopIds.length; i++) {
        const key = JSON.stringify([p.routeId, p.stopIds[i - 1], p.stopIds[i]])
        const pair = pairCounts.get(key) ?? { occurrences: 0, admitted: 0, matched: p.matchedMask[i - 1] }
        pair.matched ||= p.matchedMask[i - 1]
        pair.occurrences += p.trips; pair.admitted += p.admittedTrips; pairCounts.set(key, pair)
      }
    }
    assert.equal(pairCounts.size, report.directedPairs.length)
    for (const p of report.directedPairs) {
      assert.deepEqual(pairCounts.get(JSON.stringify([p.routeId, p.fromId, p.toId])), { occurrences: p.occurrences, admitted: p.admittedOccurrences, matched: p.matched })
      if (!p.matched) assert(['missing-line', 'endpoint-gap', 'disconnected-line', 'implausible-detour', 'collapsed-path'].includes(p.reason))
    }
    const c = report.coverage
    assert.equal(c.trips, sum(report.patterns, p => p.trips))
    assert.equal(c.admittedTrips, sum(report.patterns, p => p.admittedTrips))
    assert.equal(c.patterns, report.patterns.length)
    assert.equal(c.directedPairs, report.directedPairs.length)
    assert.equal(c.matchedDirectedPairs, report.directedPairs.filter(p => p.matched).length)
    assert.equal(c.segmentOccurrences, sum(report.patterns, p => p.trips * p.segmentCount))
    assert.equal(c.matchedSegmentOccurrences, sum(report.patterns, p => p.trips * p.matchedSegments))
    assert.equal(c.scheduledSegmentOccurrences, sum(report.patterns, p => (p.trips - p.representativeHeadwayTrips) * p.segmentCount))
    assert.equal(c.matchedScheduledSegmentOccurrences, sum(report.patterns, p => (p.trips - p.representativeHeadwayTrips) * p.matchedSegments))
    for (const field of ['trips', 'admittedTrips', 'segmentOccurrences', 'matchedSegmentOccurrences', 'directedPairs', 'patterns']) {
      assert.equal(c[field], sum(report.groups, g => g[field]), `Group mismatch ${field}`)
      assert.equal(c[field], sum(routes, r => r.days.find(d => d.date === day.serviceDate)[field]), `Route mismatch ${field}`)
    }
    const directory = join(output, day.serviceDate), manifest = await json(join(directory, 'thurgau-region-day-manifest.json'))
    assert.deepEqual(manifest.metadata.sourceHashes, summary.sourceHashes)
    assert.equal(manifest.metadata.publisher, 'Gleislicht')
    const chunks = await Promise.all(manifest.chunks.map(async descriptor => ({ descriptor, payload: await json(join(directory, descriptor.path)) })))
    const trains = [...new Map(chunks.flatMap(c => c.payload.trains).map(t => [t.id, t])).values()]
    const snapshot = { ...manifest, trains }
    const expected = compactBernFeed(cache.snapshots.find(s => s.metadata.serviceDate === day.serviceDate), replay)
    for (const field of ['stops', 'paths', 'edges', 'edgePaths']) assert.deepEqual(snapshot[field], expected[field], `Changed feed ${field}`)
    assert.deepEqual([...trains].sort((a, b) => a.id.localeCompare(b.id)), [...expected.trains].sort((a, b) => a.id.localeCompare(b.id)))
    validateBernSnapshot(snapshot); validateBernChunks(snapshot, manifest, chunks)
    assert.equal(trains.length, c.admittedTrips)
    const admittedPatternTrips = new Map()
    for (const train of trains) {
      assert.equal(thurgauPatternId(train, snapshot.stops), train.patternId)
      const pattern = byPattern.get(train.patternId)
      assert(pattern?.admittedTrips && pattern.matchedMask.every(Boolean))
      assert.deepEqual(train.stops.map(([i]) => snapshot.stops[i][4]), pattern.stopIds)
      admittedPatternTrips.set(train.patternId, (admittedPatternTrips.get(train.patternId) ?? 0) + 1)
    }
    for (const p of report.patterns) assert.equal(admittedPatternTrips.get(p.id) ?? 0, p.admittedTrips)
    const morning = await json(join(directory, 'thurgau-region-morning.json'))
    validateBernSnapshot(morning)
    assert(morning.trains.every(t => trains.some(source => source.id === t.id)))
    console.log(`${day.serviceDate}: ${trains.length} journeys, ${report.patterns.length} directed patterns, 12 verified chunks`)
  }
  assert.equal(summary.weekdaySundayPatterns.shared, [...patternSets[0]].filter(id => patternSets[1].has(id)).length)
  assert.equal(summary.weekdaySundayPatterns.weekdayOnly, [...patternSets[0]].filter(id => !patternSets[1].has(id)).length)
  assert.equal(summary.weekdaySundayPatterns.sundayOnly, [...patternSets[1]].filter(id => !patternSets[0].has(id)).length)
  assert.deepEqual(borderDatabase.pairs, [...borderSeen.values()])
  console.log(`Thurgau audit reconciles: ${routes.length} routes, ${summary.agencyCount} agencies, all 5 districts, ${sourceLines.length} source lines`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await checkThurgauRegion()
