import { solothurnLocalGapReview } from './review-solothurn-local-gaps.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { bernPatternId } from './bern-line-geometry.mjs'
import { loadSolothurnSupplements } from './solothurn-supplement-geometry.mjs'
import { solothurnNight, SO_LIMITS, solothurnGraphs, applySolothurnGeometry } from './solothurn-network-geometry.mjs'
import { validateBernSnapshot, validateBernChunks } from './build-bern-region.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const sum = (rows, fn) => rows.reduce((n, row) => n + fn(row), 0)

export async function checkSolothurnRegion({ output = 'public/data/solothurn-region', audit = 'data/solothurn-audit', sources = 'data/solothurn-sources' } = {}) {
  const summary = await json(join(audit, 'summary.json')), routes = await json(join(audit, 'routes.json'))
  const sourceLines = await json(join(audit, 'source-network.json'))
  const decodedBytes = await readFile(join(sources, 'decoded.json.gz')), decoded = JSON.parse(gunzipSync(decodedBytes))
  assert.equal(sha(decodedBytes), summary.sourceHashes.source)
  for (const record of decoded.metadata.records) assert.equal(sha(await readFile(join(sources, record.file))), record.sha256)
  assert.equal(sha(await readFile(join(sources, 'boundary-rows.json.gz'))), decoded.metadata.boundary.snapshotSha256)
  assert.equal(routes.length, summary.routeCount); assert.equal(new Set(routes.map(r => r.id)).size, routes.length)
  assert.equal(new Set(routes.map(r => r.agencyId)).size, summary.agencyCount)
  assert.equal(sourceLines.length, 3951); assert.equal(new Set(sourceLines.map(s => s.T_Ili_Tid)).size, 3951)
  assert.equal(summary.districts.length, 10)
  assert(summary.districts.every(d => d.calledPlatforms > 0 && d.routeIds.length > 0))
  for (const route of routes) {
    assert(route.allYearTripRecords > 0 && route.inCantonStops.length > 0 && route.districts.length > 0)
    assert.equal(route.night, solothurnNight(route))
    const trips = sum(route.days, d => d.trips), admitted = sum(route.days, d => d.admittedTrips)
    assert.equal(route.status, !trips ? 'inactive-on-validation-dates' : !admitted ? 'excluded' : admitted === trips ? 'admitted-all-dated-trips' : 'partially-admitted')
  }
  assert.deepEqual(sourceLines.map(s => s.T_Ili_Tid), decoded.lines.map(f => f.properties.T_Ili_Tid))
  for (const term of ['metadata.html', 'terms.html', 'publications.json']) assert.deepEqual(await readFile(join(sources, term)), await readFile(join(output, term)))
  const supplements = await loadSolothurnSupplements({ routes, sourceHashes: summary.sourceHashes }, { verifyEvidence: true })
  assert.deepEqual(supplements.metadata, summary.sources.supplements)
  const corridorReview = await json(join(audit, 'corridor-review.json')), corridorBaseline = await json('data/solothurn-corridor-baseline.json')
  assert.deepEqual(corridorReview.sources, supplements.metadata.corridors)
  assert.deepEqual(await readFile(join(sources, 'corridors/sbb/terms.html')), await readFile(join(output, 'supplements/sbb-terms.html')))
  const railReview = await json(join(audit, 'rail-platform-review.json')), railBaseline = await json('data/solothurn-rail-review-baseline.json')
  assert.deepEqual(railReview.sources, supplements.metadata.railReview)
  assert.deepEqual(railReview.sourceHashes, summary.sourceHashes)
  assert.deepEqual(railBaseline.sourceHashes, summary.sourceHashes)
  assert.equal(railReview.baselineCommit, railBaseline.commit)
  const s29Review = await json(join(audit, 's29-precedence-review.json')), s29Baseline = await json('data/solothurn-s29-baseline.json')
  assert.deepEqual(s29Review.source, supplements.metadata.s29Precedence)
  assert.deepEqual(s29Review.alternatives, supplements.s29PrecedenceReview)
  assert.deepEqual(s29Review.sourceHashes, summary.sourceHashes); assert.deepEqual(s29Baseline.sourceHashes, summary.sourceHashes)
  assert.equal(s29Review.baselineCommit, s29Baseline.commit)
  const busReview = await json(join(audit, 'bus-junction-review.json')), busBaseline = await json('data/solothurn-bus-junction-baseline.json')
  assert.deepEqual(busReview.source, supplements.metadata.busJunction)
  assert.deepEqual(busReview.sourceHashes, summary.sourceHashes); assert.deepEqual(busBaseline.sourceHashes, summary.sourceHashes)
  assert.equal(busReview.baselineCommit, busBaseline.commit)
  assert.deepEqual(await json(join(audit, 'local-gap-review.json')), await solothurnLocalGapReview())
  const accessReview = await json(join(audit, 'access-road-review.json')), accessBaseline = await json('data/solothurn-access-baseline.json')
  assert.deepEqual(accessReview.source, supplements.metadata.accessRoads)
  assert.deepEqual(accessReview.candidates, supplements.accessRoadReview)
  assert.deepEqual(accessReview.sourceHashes, summary.sourceHashes); assert.deepEqual(accessBaseline.sourceHashes, summary.sourceHashes)
  assert.equal(accessReview.baselineCommit, accessBaseline.commit)
  const supplementReview = await json(join(audit, 'supplement-review.json'))
  const admittedRouteStops = new Map()
  const topologyReview = await json(join(audit, 'topology-review.json')), baseline = await json('data/solothurn-topology-baseline.json')
  assert.deepEqual(baseline.sourceHashes, summary.sourceHashes)
  const patternSets = [], graphs = solothurnGraphs(decoded.lines), matchCache = new Map()
  const sourceStops = await json(join(audit, 'source-stops.json'))
  assert.equal(sourceStops.length, decoded.stops.length)
  assert.deepEqual(sourceStops.map(s => s.properties.T_Ili_Tid), decoded.stops.map(s => s.properties.T_Ili_Tid))
  for (const [mode, graph] of graphs) {
    assert.deepEqual(graph.topology, summary.sourceInventory.graph[mode])
    assert.deepEqual(graph.endpointInteriorJunctions, topologyReview.junctions[mode])
    assert.equal(graph.edges.length, baseline.graph[mode].edges)
  }
  for (const day of summary.days) {
    const report = await json(join(audit, `${day.serviceDate}.json`))
    assert.deepEqual(report.sourceHashes, summary.sourceHashes)
    assert.deepEqual(report.coverage, day.coverage)
    const accessDay = accessReview.days.find(d => d.date === day.serviceDate), accessBefore = accessBaseline.days.find(d => d.date === day.serviceDate)
    assert.deepEqual(accessDay.before, accessBefore.coverage); assert.deepEqual(accessDay.after, report.coverage)
    assert.deepEqual(accessDay.lostAdmittedPatterns, [])
    for (const id of accessBefore.admittedPatternIds) assert(report.patterns.some(p => p.id === id && p.admittedTrips))
    assert.deepEqual(accessDay.newlyAdmittedPatterns.map(p => p.id).sort(), report.patterns.filter(p => p.admittedTrips && !accessBefore.admittedPatternIds.includes(p.id)).map(p => p.id).sort())
    assert.deepEqual(accessDay.sourcePairs, report.directedPairs.filter(p => p.geometrySource === 'osm-solothurn-access-road-inference').map(({ matched, ...p }) => p))
    const busDay = busReview.days.find(d => d.date === day.serviceDate), busBefore = busBaseline.days.find(d => d.date === day.serviceDate)
    assert.deepEqual(busDay.before, busBefore.coverage); assert.deepEqual(busDay.after, report.coverage)
    assert.deepEqual(busDay.lostAdmittedPatterns, [])
    for (const id of busBefore.admittedPatternIds) assert(report.patterns.some(p => p.id === id && p.admittedTrips))
    assert.deepEqual(busDay.newlyAdmittedPatterns.map(p => p.id).sort(), report.patterns.filter(p => p.admittedTrips && !busBefore.admittedPatternIds.includes(p.id)).map(p => p.id).sort())
    assert.deepEqual(busDay.sourcePairs, report.directedPairs.filter(p => p.geometrySource === 'solothurn-reviewed-bus-junction').map(({ matched, ...p }) => p))
    const s29Day = s29Review.days.find(d => d.date === day.serviceDate), s29Before = s29Baseline.days.find(d => d.date === day.serviceDate)
    assert.deepEqual(s29Day.before, s29Before.coverage); assert.deepEqual(s29Day.after, report.coverage)
    assert.deepEqual(s29Day.lostAdmittedPatterns, [])
    for (const id of s29Before.admittedPatternIds) assert(report.patterns.some(p => p.id === id && p.admittedTrips))
    assert.deepEqual(s29Day.newlyAdmittedPatterns.map(p => p.id).sort(), report.patterns.filter(p => p.admittedTrips && !s29Before.admittedPatternIds.includes(p.id)).map(p => p.id).sort())
    const railDay = railReview.days.find(d => d.date === day.serviceDate), railBefore = railBaseline.days.find(d => d.date === day.serviceDate)
    assert.deepEqual(railDay.before, railBefore.coverage); assert.deepEqual(railDay.after, report.coverage)
    assert.deepEqual(railDay.lostAdmittedPatterns, [])
    for (const id of railBefore.admittedPatternIds) assert(report.patterns.some(p => p.id === id && p.admittedTrips))
    assert.deepEqual(railDay.newlyAdmittedPatterns.map(p => p.id).sort(), report.patterns.filter(p => p.admittedTrips && !railBefore.admittedPatternIds.includes(p.id)).map(p => p.id).sort())
    assert.deepEqual(railDay.sourcePairs, report.directedPairs.filter(p => p.geometrySource === 'fot-reviewed-interlaken-platforms').map(({ matched, ...p }) => p))
    const corridorDay = corridorReview.days.find(d => d.date === day.serviceDate), corridorBefore = corridorBaseline.days.find(d => d.date === day.serviceDate)
    assert.deepEqual(corridorDay.before, corridorBefore.coverage); assert.deepEqual(corridorDay.after, report.coverage)
    assert.deepEqual(corridorDay.lostAdmittedPatterns, [])
    for (const id of corridorBefore.admittedPatternIds) assert(report.patterns.some(p => p.id === id && p.admittedTrips))
    assert.deepEqual(corridorDay.newlyAdmittedPatterns.map(p => p.id).sort(), report.patterns.filter(p => p.admittedTrips && !corridorBefore.admittedPatternIds.includes(p.id)).map(p => p.id).sort())
    assert.equal(new Set(report.patterns.map(p => p.id)).size, report.patterns.length)
    patternSets.push(new Set(report.patterns.map(p => p.id)))
    const before = baseline.days.find(d => d.date === day.serviceDate)
    const review = topologyReview.days.find(d => d.date === day.serviceDate)
    assert.deepEqual(review.before, before.coverage); assert.deepEqual(review.after, supplementReview.days.find(d => d.date === day.serviceDate).before)
    assert.deepEqual(review.lostAdmittedPatterns, [])
    for (const id of before.admittedPatternIds) assert(report.patterns.some(p => p.id === id && p.admittedTrips))
    for (const p of review.newlyAdmittedPatterns) assert(report.patterns.some(q => q.id === p.id && q.admittedTrips))
    const pairCounts = new Map(), byPattern = new Map(report.patterns.map(p => [p.id, p]))
    for (const p of report.patterns) {
      assert.equal(p.segmentCount, p.stopIds.length - 1)
      assert.equal(p.matchedMask.length, p.segmentCount)
      assert.equal(p.matchedSegments, p.matchedMask.filter(Boolean).length)
      assert.equal(sum(Object.values(p.decisions), n => n), p.trips)
      assert.equal(p.decisions.admitted ?? 0, p.admittedTrips)
      if (p.admittedTrips) {
        assert.equal(p.matchedSegments, p.segmentCount)
        if (solothurnNight(routes.find(r => r.id === p.routeId))) assert(p.geometrySources.every(s => s !== 'solothurn-network'))
        assert(SO_LIMITS[p.mode] || p.supplementAvailable)
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
      assert.deepEqual(pairCounts.get(JSON.stringify([p.routeId, p.fromId, p.toId])), { occurrences: p.occurrences, admitted: p.admittedOccurrences, matched: p.matched })
      if (!p.matched) assert(['missing-line', 'endpoint-gap', 'disconnected-line', 'implausible-detour', 'collapsed-path', 'night-network-excluded-by-source', 'no-compatible-source-mode'].includes(p.reason))
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
    const directory = join(output, day.serviceDate), manifest = await json(join(directory, 'solothurn-region-day-manifest.json'))
    assert.deepEqual(manifest.metadata.sourceHashes, summary.sourceHashes)
    assert.equal(manifest.metadata.publisher, 'Gleislicht')
    const chunks = await Promise.all(manifest.chunks.map(async descriptor => {
      const bytes = await readFile(join(directory, descriptor.path))
      assert.equal(bytes.length, descriptor.bytes); assert.equal(sha(bytes), descriptor.sha256)
      return { descriptor, payload: JSON.parse(bytes) }
    }))
    const trains = [...new Map(chunks.flatMap(c => c.payload.trains).map(t => [t.id, t])).values()]
    const snapshot = { ...manifest, trains }
    validateBernSnapshot(snapshot); validateBernChunks(snapshot, manifest, chunks)
    assert.equal(trains.length, c.admittedTrips)
    const rerouted = applySolothurnGeometry(snapshot, new Map(routes.map(r => [r.id, r])), graphs, matchCache, supplements)
    for (const [i, train] of rerouted.trains.entries()) {
      assert.equal(train.admission, 'admitted', 'Published journey no longer passes source routing')
      assert.deepEqual(train.pathSegments.map(p => rerouted.paths[p]), trains[i].pathSegments.map(p => snapshot.paths[p]), 'Published geometry differs from source graph')
    }
    const zeroDuration = trains.reduce((n, t) => n + t.stops.slice(1).filter((stop, i) => stop[1] === t.stops[i][2]).length, 0)
    assert.equal(zeroDuration, report.timingResolution.zeroDurationSegmentOccurrences)
    const admittedPatternTrips = new Map()
    for (const train of trains) {
      const ids = admittedRouteStops.get(train.routeId) ?? new Set()
      for (const [i] of train.stops) ids.add(snapshot.stops[i][4])
      admittedRouteStops.set(train.routeId, ids)
      assert.equal(bernPatternId(train, snapshot.stops), train.patternId)
      const pattern = byPattern.get(train.patternId)
      assert(pattern?.admittedTrips && pattern.matchedMask.every(Boolean))
      assert.deepEqual(train.stops.map(([i]) => snapshot.stops[i][4]), pattern.stopIds)
      admittedPatternTrips.set(train.patternId, (admittedPatternTrips.get(train.patternId) ?? 0) + 1)
    }
    for (const p of report.patterns) assert.equal(admittedPatternTrips.get(p.id) ?? 0, p.admittedTrips)
    const morning = await json(join(directory, 'solothurn-region-morning.json'))
    validateBernSnapshot(morning)
    assert.deepEqual(morning.metadata.sourceHashes, summary.sourceHashes)
    assert(morning.trains.every(t => trains.some(source => source.id === t.id)))
    console.log(`${day.serviceDate}: ${trains.length} journeys, ${report.patterns.length} directed patterns, 12 verified chunks`)
  }
  const cantonStops = await json(join(audit, 'stops.json'))
  for (const district of summary.districts) {
    const stops = cantonStops.filter(s => s.district === district.district)
    assert.equal(district.admittedCalledPlatforms, stops.filter(s => [...admittedRouteStops.values()].some(ids => ids.has(s.id))).length)
    assert.deepEqual(district.admittedRouteIds, routes.filter(r => stops.some(s => admittedRouteStops.get(r.id)?.has(s.id))).map(r => r.id))
  }
  assert.equal(summary.weekdaySundayPatterns.shared, [...patternSets[0]].filter(id => patternSets[1].has(id)).length)
  assert.equal(summary.weekdaySundayPatterns.weekdayOnly, [...patternSets[0]].filter(id => !patternSets[1].has(id)).length)
  assert.equal(summary.weekdaySundayPatterns.sundayOnly, [...patternSets[1]].filter(id => !patternSets[0].has(id)).length)
  console.log(`Solothurn audit reconciles: ${routes.length} routes, ${summary.agencyCount} agencies, all 10 districts, ${sourceLines.length} network records`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await checkSolothurnRegion()
