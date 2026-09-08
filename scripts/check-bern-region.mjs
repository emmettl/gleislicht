import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { bernFeatureMatch, bernPatternId } from './bern-line-geometry.mjs'
import { validateBernSnapshot, validateBernChunks } from './build-bern-region.mjs'
import { loadBernUrban } from './bern-urban-geometry.mjs'
import { loadBernRegionalRoads } from './bern-regional-roads.mjs'
import { loadBernMountains } from './bern-mountain-geometry.mjs'
import { loadBernRail, bernRailCandidates } from './bern-rail-geometry.mjs'
import { loadBernRegionalRail } from './bern-regional-rail.mjs'
import { loadBernCrosscantonRail } from './bern-crosscanton-rail.mjs'
import { loadBernIr66 } from './bern-ir66-geometry.mjs'
import { loadBernIr16 } from './bern-ir16-geometry.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const sum = (rows, fn) => rows.reduce((n, row) => n + fn(row), 0)

export async function checkBernRegion({ output = 'public/data/bern-region', audit = 'data/bern-audit', sources = 'data/bern-sources' } = {}) {
  const summary = await json(join(audit, 'summary.json')), routes = await json(join(audit, 'routes.json'))
  const sourceLines = await json(join(audit, 'source-lines.json'))
  const decodedBytes = await readFile(join(sources, 'decoded.json.gz')), decoded = JSON.parse(gunzipSync(decodedBytes))
  const crosswalk = await json('data/bern-operator-crosswalk.json')
  const urban = await loadBernUrban()
  const regionalRoads = await loadBernRegionalRoads()
  assert.equal(summary.sourceHashes.regionalRoadCache, regionalRoads.metadata.cacheSha256)
  assert.equal(summary.sourceHashes.regionalRoadPolicy, regionalRoads.metadata.policySha256)
  assert.deepEqual(summary.sources.regionalRoadSupplement, regionalRoads.metadata)
  const mountain = await loadBernMountains()
  const rail = await loadBernRail()
  const regionalRail = await loadBernRegionalRail()
  const crosscantonRail = await loadBernCrosscantonRail()
  const ir66 = await loadBernIr66()
  assert.equal(summary.sourceHashes.ir66Policy, ir66.metadata.policySha256)
  assert.deepEqual(summary.sources.ir66Supplement, ir66.metadata)
  for (const doc of ir66.policy.documents) assert.equal(sha(await readFile(join(output, 'ir66-platforms', doc.file))), doc.sha256)
  const ir16 = await loadBernIr16()
  assert.equal(summary.sourceHashes.ir16Policy, ir16.metadata.policySha256)
  assert.deepEqual(summary.sources.ir16Supplement, ir16.metadata)
  for (const doc of ir16.policy.documents) assert.equal(sha(await readFile(join(output, 'ir16-platforms', doc.file))), doc.sha256)
  const railSuppliers = [rail, regionalRail, crosscantonRail, ir66, ir16]
  assert.equal(summary.sourceHashes.crosscantonRailPolicy, crosscantonRail.metadata.policySha256)
  assert.deepEqual(summary.sources.crosscantonRailSupplement, crosscantonRail.metadata)
  assert.equal(summary.sourceHashes.regionalRailPolicy, regionalRail.metadata.policySha256)
  assert.deepEqual(summary.sources.regionalRailSupplement, regionalRail.metadata)
  assert.equal(summary.sourceHashes.railPolicy, rail.metadata.policySha256)
  assert.deepEqual(summary.sources.railSupplement, rail.metadata)
  for (const file of ['source.json', ...Object.keys(rail.metadata.source.files)]) assert.deepEqual(await readFile(join(output, 'fot-rail', file)), await readFile(join(rail.policy.sourceDirectory, file)))
  assert.equal(summary.sourceHashes.mountainPolicy, mountain.metadata.policySha256)
  assert.deepEqual(summary.sources.mountainSupplement, mountain.metadata)
  for (const file of ['source.json', ...Object.keys(mountain.metadata.source.files)]) assert.deepEqual(await readFile(join(output, 'fot-cableways', file)), await readFile(join(mountain.policy.sourceDirectory, file)))
  assert.equal(urban.metadata.cacheSha256, summary.sourceHashes.urbanCache)
  assert.equal(urban.metadata.policySha256, summary.sourceHashes.urbanPolicy)
  assert.deepEqual(summary.sources.urbanSupplement, urban.metadata)
  for (const document of urban.policy.documents) assert.equal(sha(await readFile(join(output, document.file))), document.sha256)
  assert.equal(sha(decodedBytes), summary.sourceHashes.source)
  assert.equal(sha(await readFile(join(sources, 'oevtp.gpkg.zip'))), summary.sourceHashes.geometryArchive)
  assert.equal(sha(await readFile('data/bern-operator-crosswalk.json')), summary.sourceHashes.crosswalk)
  for (const document of crosswalk.supportingDocuments ?? []) {
    assert.equal(sha(await readFile(join(sources, document.file))), document.sha256)
    assert.equal(sha(await readFile(join(output, document.file))), document.sha256)
  }
  assert.equal(sha(await readFile(join(sources, 'boundary-rows.json.gz'))), decoded.metadata.boundary.snapshotSha256)
  assert.equal(routes.length, summary.routeCount); assert.equal(new Set(routes.map(r => r.id)).size, routes.length)
  assert.equal(new Set(routes.map(r => r.agencyId)).size, summary.agencyCount)
  assert.equal(sourceLines.length, 518); assert.equal(new Set(sourceLines.map(s => s.liniencode)).size, 518)
  assert.equal(summary.districts.length, 10)
  assert(summary.districts.every(d => d.calledPlatforms > 0 && d.routeIds.length > 0))
  for (const route of routes) {
    assert(route.allYearTripRecords > 0 && route.inCantonStops.length > 0 && route.districts.length > 0)
    assert.deepEqual(decoded.lines.filter(f => bernFeatureMatch(route, f, crosswalk)).map(f => f.properties.liniencode).sort(), route.sourceLines)
    const trips = sum(route.days, d => d.trips), admitted = sum(route.days, d => d.admittedTrips)
    assert.equal(route.status, !trips ? 'inactive-on-validation-dates' : !admitted ? 'excluded' : admitted === trips ? 'admitted-all-dated-trips' : 'partially-admitted')
  }
  for (const line of sourceLines) assert.deepEqual(line.routeIds.sort(), routes.filter(r => r.sourceLines.includes(line.liniencode)).map(r => r.id).sort())
  for (const term of [...decoded.metadata.termsFiles, 'metadata_oevtp_linie_de.pdf']) assert.deepEqual(await readFile(join(sources, term)), await readFile(join(output, term)))
  const patternSets = []
  for (const day of summary.days) {
    const report = await json(join(audit, `${day.serviceDate}.json`))
    assert.deepEqual(report.sourceHashes, summary.sourceHashes)
    assert.deepEqual(report.coverage, day.coverage)
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
      if (p.admittedTrips && !p.sourceLines.length) {
        assert(p.supplementalBinding && mountain.policy.admittedRouteIds.includes(p.routeId))
        assert(p.supplementalSources.every(id => mountain.policy.bindings.some(b => b.routeId === p.routeId && b.installation === id)))
      }
      for (let i = 1; i < p.stopIds.length; i++) {
        const key = JSON.stringify([p.routeId, p.stopIds[i - 1], p.stopIds[i]])
        const pair = pairCounts.get(key) ?? { occurrences: 0, admitted: 0, matched: p.matchedMask[i - 1] }
        assert.equal(pair.matched, p.matchedMask[i - 1])
        pair.occurrences += p.trips; pair.admitted += p.admittedTrips; pairCounts.set(key, pair)
      }
    }
    assert.equal(pairCounts.size, report.directedPairs.length)
    for (const p of report.directedPairs) {
      if (p.sourceKind === 'osm-road-inference') {
        const roadSource = p.sourceId === 'bern-regional-osm-20260902' ? regionalRoads : urban
        assert(roadSource.policy.roadRouteIds.includes(p.routeId) && p.matched && p.originalAssessment.reason)
        const candidate = roadSource.roads.get(JSON.stringify([p.routeId, p.fromId, p.toId]))
        assert(candidate?.path)
        assert.deepEqual(p.roadPatternIds, candidate.roadPatternIds)
      } else if (p.sourceKind === 'dated-cantonal-tram-corridor') {
        assert(urban.policy.tramPairs.some(pair => JSON.stringify(pair) === JSON.stringify([p.routeId, p.fromId, p.toId])))
        assert.equal(p.sourceId, '30_003'); assert(p.matched && p.maximumSnapMetres <= 80)
      } else if (p.sourceKind === 'fot-cableway-axis') {
        assert(mountain.policy.admittedRouteIds.includes(p.routeId) && p.matched && p.maximumSnapMetres <= 80)
        assert(mountain.policy.bindings.some(b => b.routeId === p.routeId && b.installation === p.sourceId))
      } else if (p.sourceKind === 'fot-rail-topology') {
        const supplier = railSuppliers.find(r => r.policy.sourceId === p.sourceId)
        assert(supplier, 'Unreviewed federal supplier')
        assert(supplier.policy.routes.some(r => r.routeId === p.routeId) && p.matched && p.maximumSnapMetres <= 120)
        assert.equal(p.sourceId, supplier.policy.sourceId)
        assert(p.maximumTopologyAttachmentMetres <= supplier.policy.limits.topologyAttachmentMetres)
        assert(['disconnected-line', 'endpoint-gap', 'missing-line', 'implausible-detour', 'collapsed-path'].includes(p.originalAssessment.reason))
      } else assert(!p.sourceKind)
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
    const directory = join(output, day.serviceDate), manifest = await json(join(directory, 'bern-region-day-manifest.json'))
    assert.deepEqual(manifest.metadata.sourceHashes, summary.sourceHashes)
    assert.equal(manifest.metadata.publisher, 'Gleislicht')
    const chunks = await Promise.all(manifest.chunks.map(async descriptor => ({ descriptor, payload: await json(join(directory, descriptor.path)) })))
    const trains = [...new Map(chunks.flatMap(c => c.payload.trains).map(t => [t.id, t])).values()]
    const snapshot = { ...manifest, trains }
    const routeMap = new Map(routes.map(r => [r.id, r]))
    const railCandidates = new Map(railSuppliers.flatMap(supplier => [...bernRailCandidates(snapshot, routeMap, supplier)]))
    const railPairs = new Map(report.directedPairs.filter(p => p.sourceKind === 'fot-rail-topology').map(p => [JSON.stringify([p.routeId, p.fromId, p.toId]), p]))
    for (const t of trains) for (let i = 1; i < t.stops.length; i++) {
      const key = JSON.stringify([t.routeId, snapshot.stops[t.stops[i - 1][0]][4], snapshot.stops[t.stops[i][0]][4]])
      if (!railPairs.has(key)) continue
      assert.deepEqual(snapshot.paths[t.pathSegments[i - 1]], railCandidates.get(key)?.path, 'Changed federal rail path')
      // Partial routes also retain contexts from excluded full journeys. The
      // raw-cache follow-up checker reproduces that complete context set.
      assert(railCandidates.get(key).railPatternIds.every(id => railPairs.get(key).railPatternIds.includes(id)))
    }
    validateBernSnapshot(snapshot); validateBernChunks(snapshot, manifest, chunks)
    assert.equal(trains.length, c.admittedTrips)
    const admittedPatternTrips = new Map()
    for (const train of trains) {
      assert.equal(bernPatternId(train, snapshot.stops), train.patternId)
      const pattern = byPattern.get(train.patternId)
      assert(pattern?.admittedTrips && pattern.matchedMask.every(Boolean))
      assert.deepEqual(train.stops.map(([i]) => snapshot.stops[i][4]), pattern.stopIds)
      admittedPatternTrips.set(train.patternId, (admittedPatternTrips.get(train.patternId) ?? 0) + 1)
    }
    for (const p of report.patterns) assert.equal(admittedPatternTrips.get(p.id) ?? 0, p.admittedTrips)
    const morning = await json(join(directory, 'bern-region-morning.json'))
    validateBernSnapshot(morning)
    assert(morning.trains.every(t => trains.some(source => source.id === t.id)))
    console.log(`${day.serviceDate}: ${trains.length} journeys, ${report.patterns.length} directed patterns, 12 verified chunks`)
  }
  assert.equal(summary.weekdaySundayPatterns.shared, [...patternSets[0]].filter(id => patternSets[1].has(id)).length)
  assert.equal(summary.weekdaySundayPatterns.weekdayOnly, [...patternSets[0]].filter(id => !patternSets[1].has(id)).length)
  assert.equal(summary.weekdaySundayPatterns.sundayOnly, [...patternSets[1]].filter(id => !patternSets[0].has(id)).length)
  console.log(`Bern audit reconciles: ${routes.length} routes, ${summary.agencyCount} agencies, all 10 districts, ${sourceLines.length} source lines`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await checkBernRegion()
