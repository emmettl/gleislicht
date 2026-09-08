import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { compactBernFeed, bernCoverage, validateBernSnapshot, validateBernChunks } from './build-bern-region.mjs'
import { SO_DATES, SO_GTFS_SHA, hashFile } from './solothurn-timetable.mjs'
import { bernArea, bernWgs84 } from './bern-spatial.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { loadSolothurnSupplements } from './solothurn-supplement-geometry.mjs'
import { solothurnGraphs, applySolothurnGeometry, SO_LIMITS, SO_MODES, solothurnNight } from './solothurn-network-geometry.mjs'

const zipped = async path => JSON.parse(gunzipSync(await readFile(path)))
const writeJson = async (path, value, pretty = false) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(value, null, pretty ? 2 : undefined) + '\n')
}
export async function buildSolothurnRegion() {
  const sourceDir = 'data/solothurn-sources', auditDir = 'data/solothurn-audit', output = 'public/data/solothurn-region'
  const source = await zipped(join(sourceDir, 'decoded.json.gz'))
  const timetable = await zipped(join(auditDir, 'timetable-cache.json.gz'))
  const sourceHashes = { archive: SO_GTFS_SHA, source: await hashFile(join(sourceDir, 'decoded.json.gz')) }
  assert.deepEqual(timetable.sourceHashes, sourceHashes, 'Stale timetable cache')
  assert.deepEqual(timetable.snapshots.map(s => s.metadata.serviceDate), SO_DATES)
  for (const record of source.metadata.records) assert.equal(await hashFile(join(sourceDir, record.file)), record.sha256)
  assert.equal(await hashFile(join(sourceDir, 'boundary-rows.json.gz')), source.metadata.boundary.snapshotSha256)
  const census = JSON.parse(await readFile('data/swiss-transit-agencies.json'))
  assert.equal(census.sourceSha256, SO_GTFS_SHA)
  const baseline = JSON.parse(await readFile('data/solothurn-topology-baseline.json'))
  assert.deepEqual(baseline.sourceHashes, sourceHashes)
  const topologyReview = { baselineCommit: baseline.commit, sourceHashes, rule: 'Exact non-tunnel endpoint/interior vertex noding; no added source edges or coordinates', days: [] }
  const supplements = await loadSolothurnSupplements(timetable)
  const supplementReview = { sourceHashes, sources: supplements.metadata, days: [] }
  const corridorBaseline = JSON.parse(await readFile('data/solothurn-corridor-baseline.json'))
  assert.deepEqual(corridorBaseline.sourceHashes, sourceHashes)
  const corridorReview = { baselineCommit: corridorBaseline.commit, sources: supplements.metadata.corridors, days: [] }
  const railBaseline = JSON.parse(await readFile('data/solothurn-rail-review-baseline.json'))
  assert.deepEqual(railBaseline.sourceHashes, sourceHashes)
  const railReview = { baselineCommit: railBaseline.commit, sourceHashes, sources: supplements.metadata.railReview, days: [] }
  const s29Baseline = JSON.parse(await readFile('data/solothurn-s29-baseline.json'))
  assert.deepEqual(s29Baseline.sourceHashes, sourceHashes)
  const s29Review = { baselineCommit: s29Baseline.commit, sourceHashes, source: supplements.metadata.s29Precedence, alternatives: supplements.s29PrecedenceReview, days: [] }
  const busBaseline = JSON.parse(await readFile('data/solothurn-bus-junction-baseline.json'))
  assert.deepEqual(busBaseline.sourceHashes, sourceHashes)
  const busReview = { baselineCommit: busBaseline.commit, sourceHashes, source: supplements.metadata.busJunction, days: [] }
  const accessBaseline = JSON.parse(await readFile('data/solothurn-access-baseline.json'))
  assert.deepEqual(accessBaseline.sourceHashes, sourceHashes)
  const accessReview = { baselineCommit: accessBaseline.commit, sourceHashes, source: supplements.metadata.accessRoads, candidates: supplements.accessRoadReview, days: [] }
  const terminalBaseline = JSON.parse(await readFile('data/solothurn-bern-terminal-baseline.json'))
  assert.deepEqual(terminalBaseline.sourceHashes, sourceHashes)
  const terminalReview = { baselineCommit: terminalBaseline.commit, sourceHashes, source: supplements.metadata.bernTerminal, days: [] }
  const s26Baseline = JSON.parse(await readFile('data/solothurn-s26-baseline.json'))
  assert.deepEqual(s26Baseline.sourceHashes, sourceHashes)
  const s26Review = { baselineCommit: s26Baseline.commit, sourceHashes, source: supplements.metadata.s26, days: [] }
  const comoBaseline = JSON.parse(await readFile('data/solothurn-como-baseline.json'))
  assert.deepEqual(comoBaseline.sourceHashes, sourceHashes)
  const comoReview = { baselineCommit: comoBaseline.commit, sourceHashes, source: supplements.metadata.como, days: [] }
  const simplonBaseline = JSON.parse(await readFile('data/solothurn-simplon-baseline.json'))
  assert.deepEqual(simplonBaseline.sourceHashes, sourceHashes)
  const simplonReview = { baselineCommit: simplonBaseline.commit, sourceHashes, source: supplements.metadata.simplon, days: [] }
  const delleBaseline = JSON.parse(await readFile('data/solothurn-delle-baseline.json'))
  assert.deepEqual(delleBaseline.sourceHashes, sourceHashes)
  const delleReview = { baselineCommit: delleBaseline.commit, sourceHashes, source: supplements.metadata.delle, days: [] }
  const provenance = { supplements: supplements.metadata, ...source.metadata, timetable: {
    publisher: 'SBB / Open data platform mobility Switzerland', attribution: 'opentransportdata.swiss',
    sha256: SO_GTFS_SHA, feed: census.feed, sourceUrl: census.sourceUrl,
    downloadUrl: 'https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip',
    termsUrl: 'https://opentransportdata.swiss/en/terms-of-use/', processedBy: 'Gleislicht',
    archivalStudy: true, refreshPolicy: 'Pinned September 2026 study, not current service. Rebuild census, graph, both days and audit when updating either source.' },
    geometryModel: 'Mode-filtered, bidirectional shortest-path inference on official network centrelines. No route/operator attributes, legal road direction, rail gauge/running-track or diversion certification.',
    topologyRule: 'Exact LV95 source endpoints join within one mode, including an endpoint on another feature’s exact non-tunnel interior vertex. No interior-only crossing junctions, tunnel-interior joins, distance-based stitching or stop-to-stop straight-line fallback. Tunnel flags retained.',
    coordinateModel: 'Original LV95 XY vertices; swisstopo approximate WGS84 conversion; seven-decimal output. Metre-level transformation, not survey precision.',
    limits: SO_LIMITS, endpointConnectors: 'GTFS platforms connect to projected graph points within the mode snap limit; these short connectors are inferred.',
  }
  const graphs = solothurnGraphs(source.lines), routes = new Map(timetable.routes.map(r => [r.id, r]))
  const admittedRouteStops = new Map()
  const matchCache = new Map(), days = [], patternSets = [], routeDays = new Map(timetable.routes.map(r => [r.id, []]))
  for (const raw of timetable.snapshots) {
    console.log(`Routing Solothurn ${raw.metadata.serviceDate}: ${raw.trains.length} complete civil-day journeys…`)
    const baseResult = applySolothurnGeometry(raw, routes, graphs, matchCache)
    const result = applySolothurnGeometry(raw, routes, graphs, matchCache, supplements)
    const coverage = bernCoverage(result.trains, result.pairs, result.patterns)
    const accessBefore = accessBaseline.days.find(d => d.date === raw.metadata.serviceDate)
    const accessPrevious = new Set(accessBefore.admittedPatternIds)
    const accessLost = [...accessPrevious].filter(id => !result.patterns.some(p => p.id === id && p.admittedTrips))
    assert.equal(accessLost.length, 0, 'Access-road review regressed an admitted pattern')
    accessReview.days.push({ date: raw.metadata.serviceDate, before: accessBefore.coverage, after: coverage, lostAdmittedPatterns: accessLost,
      newlyAdmittedPatterns: result.patterns.filter(p => p.admittedTrips && !accessPrevious.has(p.id)).map(({ pathSegments, ...p }) => p),
      sourcePairs: result.pairs.filter(p => p.geometrySource === 'osm-solothurn-access-road-inference').map(({ pathIndex, ...p }) => p) })
    const terminalBefore = terminalBaseline.days.find(d => d.date === raw.metadata.serviceDate)
    const terminalPrevious = new Set(terminalBefore.admittedPatternIds)
    const terminalLost = [...terminalPrevious].filter(id => !result.patterns.some(p => p.id === id && p.admittedTrips))
    assert.equal(terminalLost.length, 0, 'Bern terminal review regressed an admitted pattern')
    terminalReview.days.push({ date: raw.metadata.serviceDate, before: terminalBefore.coverage, after: coverage, lostAdmittedPatterns: terminalLost,
      newlyAdmittedPatterns: result.patterns.filter(p => p.admittedTrips && !terminalPrevious.has(p.id)).map(({ pathSegments, ...p }) => p),
      sourcePairs: result.pairs.filter(p => p.geometrySource === 'fot-reviewed-bern-eastern-terminal').map(({ pathIndex, ...p }) => p) })
    const s26Before = s26Baseline.days.find(d => d.date === raw.metadata.serviceDate)
    const s26Previous = new Set(s26Before.admittedPatternIds)
    const s26Lost = [...s26Previous].filter(id => !result.patterns.some(p => p.id === id && p.admittedTrips))
    assert.equal(s26Lost.length, 0, 'S26 review regressed an admitted pattern')
    s26Review.days.push({ date: raw.metadata.serviceDate, before: s26Before.coverage, after: coverage, lostAdmittedPatterns: s26Lost,
      newlyAdmittedPatterns: result.patterns.filter(p => p.admittedTrips && !s26Previous.has(p.id)).map(({ pathSegments, ...p }) => p),
      sourcePairs: result.pairs.filter(p => p.geometrySource === 'fot-sbb-reviewed-s26').map(({ pathIndex, ...p }) => p) })
    const comoBefore = comoBaseline.days.find(d => d.date === raw.metadata.serviceDate)
    const comoPrevious = new Set(comoBefore.admittedPatternIds)
    const comoLost = [...comoPrevious].filter(id => !result.patterns.some(p => p.id === id && p.admittedTrips))
    assert.equal(comoLost.length, 0, 'Como review regressed an admitted pattern')
    comoReview.days.push({ date: raw.metadata.serviceDate, before: comoBefore.coverage, after: coverage, lostAdmittedPatterns: comoLost,
      newlyAdmittedPatterns: result.patterns.filter(p => p.admittedTrips && !comoPrevious.has(p.id)).map(({ pathSegments, ...p }) => p),
      sourcePairs: result.pairs.filter(p => p.geometrySource === 'osm-solothurn-como-rail-inference').map(({ pathIndex, ...p }) => p) })
    const simplonBefore = simplonBaseline.days.find(d => d.date === raw.metadata.serviceDate)
    const simplonPrevious = new Set(simplonBefore.admittedPatternIds)
    const simplonLost = [...simplonPrevious].filter(id => !result.patterns.some(p => p.id === id && p.admittedTrips))
    assert.equal(simplonLost.length, 0, 'Simplon review regressed an admitted pattern')
    simplonReview.days.push({ date: raw.metadata.serviceDate, before: simplonBefore.coverage, after: coverage, lostAdmittedPatterns: simplonLost,
      newlyAdmittedPatterns: result.patterns.filter(p => p.admittedTrips && !simplonPrevious.has(p.id)).map(({ pathSegments, ...p }) => p),
      sourcePairs: result.pairs.filter(p => p.geometrySource === 'osm-solothurn-simplon-inference').map(({ pathIndex, ...p }) => p) })
    const delleBefore = delleBaseline.days.find(d => d.date === raw.metadata.serviceDate)
    const dellePrevious = new Set(delleBefore.admittedPatternIds)
    const delleLost = [...dellePrevious].filter(id => !result.patterns.some(p => p.id === id && p.admittedTrips))
    assert.equal(delleLost.length, 0, 'Delle review regressed an admitted pattern')
    delleReview.days.push({ date: raw.metadata.serviceDate, before: delleBefore.coverage, after: coverage, lostAdmittedPatterns: delleLost,
      newlyAdmittedPatterns: result.patterns.filter(p => p.admittedTrips && !dellePrevious.has(p.id)).map(({ pathSegments, ...p }) => p),
      sourcePairs: result.pairs.filter(p => p.geometrySource === 'osm-solothurn-delle-rail-inference').map(({ pathIndex, ...p }) => p) })
    const busBefore = busBaseline.days.find(d => d.date === raw.metadata.serviceDate)
    const busPrevious = new Set(busBefore.admittedPatternIds)
    const busLost = [...busPrevious].filter(id => !result.patterns.some(p => p.id === id && p.admittedTrips))
    assert.equal(busLost.length, 0, 'Reviewed bus junction regressed an admitted pattern')
    busReview.days.push({ date: raw.metadata.serviceDate, before: busBefore.coverage, after: coverage, lostAdmittedPatterns: busLost,
      newlyAdmittedPatterns: result.patterns.filter(p => p.admittedTrips && !busPrevious.has(p.id)).map(({ pathSegments, ...p }) => p),
      sourcePairs: result.pairs.filter(p => p.geometrySource === 'solothurn-reviewed-bus-junction').map(({ pathIndex, ...p }) => p) })
    const s29Before = s29Baseline.days.find(d => d.date === raw.metadata.serviceDate)
    const s29Previous = new Set(s29Before.admittedPatternIds)
    const s29Lost = [...s29Previous].filter(id => !result.patterns.some(p => p.id === id && p.admittedTrips))
    assert.equal(s29Lost.length, 0, 'S29 precedence regressed an admitted pattern')
    s29Review.days.push({ date: raw.metadata.serviceDate, before: s29Before.coverage, after: coverage, lostAdmittedPatterns: s29Lost,
      newlyAdmittedPatterns: result.patterns.filter(p => p.admittedTrips && !s29Previous.has(p.id)).map(({ pathSegments, ...p }) => p) })
    const railBefore = railBaseline.days.find(d => d.date === raw.metadata.serviceDate)
    const railPrevious = new Set(railBefore.admittedPatternIds)
    const railLost = [...railPrevious].filter(id => !result.patterns.some(p => p.id === id && p.admittedTrips))
    assert.equal(railLost.length, 0, 'Rail platform review regressed an admitted pattern')
    railReview.days.push({ date: raw.metadata.serviceDate, before: railBefore.coverage, after: coverage, lostAdmittedPatterns: railLost,
      newlyAdmittedPatterns: result.patterns.filter(p => p.admittedTrips && !railPrevious.has(p.id)).map(({ pathSegments, ...p }) => p),
      sourcePairs: result.pairs.filter(p => p.geometrySource === 'fot-reviewed-interlaken-platforms').map(({ pathIndex, ...p }) => p) })
    const previous = corridorBaseline.days.find(d => d.date === raw.metadata.serviceDate)
    const previousIds = new Set(previous.admittedPatternIds)
    const lostCorridorPatterns = [...previousIds].filter(id => !result.patterns.some(p => p.id === id && p.admittedTrips))
    assert.equal(lostCorridorPatterns.length, 0, 'Corridor supplement regressed an admitted pattern')
    corridorReview.days.push({ date: raw.metadata.serviceDate, before: previous.coverage, after: coverage, lostAdmittedPatterns: lostCorridorPatterns,
      newlyAdmittedPatterns: result.patterns.filter(p => p.admittedTrips && !previousIds.has(p.id)).map(({ pathSegments, ...p }) => p),
      sourcePairs: result.pairs.filter(p => ['bern-official-413', 'bern-official-450_S_b', 'sbb-rail-inference'].includes(p.geometrySource)).map(({ pathIndex, ...p }) => p) })
    const baseIds = new Set(baseResult.patterns.filter(p => p.admittedTrips).map(p => p.id))
    const lostBase = [...baseIds].filter(id => !result.patterns.some(p => p.id === id && p.admittedTrips))
    assert.equal(lostBase.length, 0, 'Supplement regressed an admitted cantonal pattern')
    supplementReview.days.push({ date: raw.metadata.serviceDate,
      before: bernCoverage(baseResult.trains, baseResult.pairs, baseResult.patterns), after: coverage,
      lostAdmittedPatterns: lostBase,
      newlyAdmittedPatterns: result.patterns.filter(p => p.admittedTrips && !baseIds.has(p.id)).map(p => ({ id: p.id, routeId: p.routeId, line: p.line, mode: p.mode, stopIds: p.stopIds, admittedTrips: p.admittedTrips, geometrySources: p.geometrySources })),
      geometrySources: Object.fromEntries([...new Set(result.pairs.map(p => p.geometrySource).filter(Boolean))].map(source => [source, {
        directedPairs: result.pairs.filter(p => p.geometrySource === source).length,
        admittedOccurrences: result.pairs.filter(p => p.geometrySource === source).reduce((n, p) => n + p.admittedOccurrences, 0) }])) })
    const before = baseline.days.find(d => d.date === raw.metadata.serviceDate)
    const admittedIds = new Set(baseResult.patterns.filter(p => p.admittedTrips).map(p => p.id))
    const lost = before.admittedPatternIds.filter(id => !admittedIds.has(id))
    assert.equal(lost.length, 0, 'Exact noding regressed a previously admitted pattern')
    topologyReview.days.push({ date: raw.metadata.serviceDate, before: before.coverage, after: bernCoverage(baseResult.trains, baseResult.pairs, baseResult.patterns),
      lostAdmittedPatterns: lost, newlyAdmittedPatterns: baseResult.patterns.filter(p => p.admittedTrips && !before.admittedPatternIds.includes(p.id)).map(p => ({ id: p.id, routeId: p.routeId, line: p.line, mode: p.mode, stopIds: p.stopIds, admittedTrips: p.admittedTrips })) })
    for (const route of routes.values()) routeDays.get(route.id).push({ date: raw.metadata.serviceDate,
      ...bernCoverage(result.trains.filter(t => t.routeId === route.id), result.pairs.filter(p => p.routeId === route.id), result.patterns.filter(p => p.routeId === route.id)) })
    const groups = [...new Set(result.trains.map(t => `${t.agencyId}:${routes.get(t.routeId).mode}`))].sort().map(key => {
      const ids = new Set([...routes.values()].filter(r => `${r.agencyId}:${r.mode}` === key).map(r => r.id))
      return { id: key, agency: routes.get([...ids][0]).agency,
        ...bernCoverage(result.trains.filter(t => ids.has(t.routeId)), result.pairs.filter(p => ids.has(p.routeId)), result.patterns.filter(p => ids.has(p.routeId))) }
    })
    const snapshot = compactBernFeed(raw, result)
    for (const train of snapshot.trains) {
      const ids = admittedRouteStops.get(train.routeId) ?? new Set()
      for (const [i] of train.stops) ids.add(snapshot.stops[i][4])
      admittedRouteStops.set(train.routeId, ids)
    }
    snapshot.metadata = { ...raw.metadata, publisher: 'Gleislicht', label: 'Solothurn canton — inferred network paths',
      attribution: 'opentransportdata.swiss; Kanton Solothurn; Geodaten Kanton Basel-Stadt; Kanton Bern; © Federal Office of Transport; SBB Infrastructure / data.sbb.ch; © OpenStreetMap contributors (ODbL-1.0); © swisstopo',
      sourceHashes, sources: provenance, scope: timetable.census.boundaryRule,
      model: 'Scheduled interpolation on inferred official-network paths. Headway exactTimes=0 instances are representative, not exact departures. No observed vehicle positions.',
      admission: 'Complete original directed patterns only. Cantonal gaps may use separately attributed, compatible supplements with full-pattern consensus. Night services require supplementary geometry on every segment. Reservation/demand and unresolved patterns excluded.',
    }
    validateBernSnapshot(snapshot)
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'day-chunks')
    validateBernChunks(snapshot, manifest, chunks)
    const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
    validateBernSnapshot(morning)
    const destination = join(output, raw.metadata.serviceDate)
    // Chunk hashes describe exact compact bytes, without a trailing newline.
    for (const { descriptor, payload } of chunks) {
      await mkdir(dirname(join(destination, descriptor.path)), { recursive: true })
      await writeFile(join(destination, descriptor.path), JSON.stringify(payload))
    }
    await writeJson(join(destination, 'solothurn-region-day-manifest.json'), manifest)
    await writeJson(join(destination, 'solothurn-region-morning.json'), morning)
    const timedSegments = snapshot.trains.flatMap(t => t.pathSegments.map((path, i) => ({
      routeId: t.routeId, fromId: snapshot.stops[t.stops[i][0]][4], toId: snapshot.stops[t.stops[i + 1][0]][4],
      seconds: t.stops[i + 1][1] - t.stops[i][2], mode: routes.get(t.routeId).mode,
      metres: snapshot.paths[path].slice(1).reduce((n, p, j) => n + distanceMetres(snapshot.paths[path][j], p), 0),
    })))
    const timingResolution = { zeroDurationSegmentOccurrences: timedSegments.filter(s => s.seconds === 0).length,
      zeroDurationDirectedPairs: [...new Map(timedSegments.filter(s => s.seconds === 0).map(s => [JSON.stringify([s.routeId, s.fromId, s.toId]), s])).values()],
      note: 'Original minute-resolution GTFS times retained, including distinct calls at the same second. No fabricated sub-minute times. These legs cannot imply finite measured speed; animation may jump at the common timestamp.',
      maximumNominalPositiveDurationKmh: Object.fromEntries([...new Set(timedSegments.map(s => s.mode))].map(mode => [mode,
        Math.max(...timedSegments.filter(s => s.mode === mode && s.seconds > 0).map(s => s.metres / s.seconds * 3.6))])) }
    const report = { schemaVersion: 1, serviceDate: raw.metadata.serviceDate, sourceHashes, coverage, groups,
      carryInTrips: result.trains.filter(t => t.sourceServiceDate !== raw.metadata.serviceDate).length,
      admittedCarryInTrips: snapshot.trains.filter(t => t.sourceServiceDate !== raw.metadata.serviceDate).length,
      admittedOutsideCantonPlatforms: snapshot.stops.filter(s => !timetable.sourceStopInventory.some(p => p.id === s[4])).length,
      directedPatternChecks: { directionIds: [...new Set(result.patterns.map(p => p.directionId))].sort(),
        patternsRevisitingPlatforms: result.patterns.filter(p => new Set(p.stopIds).size < p.stopIds.length).length,
        admittedPatternsRevisitingPlatforms: result.patterns.filter(p => p.admittedTrips && new Set(p.stopIds).size < p.stopIds.length).length,
        nightTrips: result.trains.filter(t => solothurnNight(routes.get(t.routeId))).length,
        admittedNightTrips: snapshot.trains.filter(t => solothurnNight(routes.get(t.routeId))).length },
      patterns: result.patterns.map(({ pathSegments, ...p }) => ({ ...p, matchedMask: pathSegments.map(i => i !== null) })),
      directedPairs: result.pairs.map(({ pathIndex, ...p }) => ({ ...p, matched: pathIndex !== null })),
      timingResolution,
      pairFailureReasons: Object.fromEntries([...new Set(result.pairs.filter(p => p.pathIndex === null).map(p => p.reason))].sort().map(reason => [reason, result.pairs.filter(p => p.reason === reason).length])),
      validation: { completeSourceCalls: true, directedEndpoints: true, finiteOrderedTimes: true, chunkHashesAndTripIdentity: true,
        admittedGeometryCoverage: 1, straightLineFallback: false, physicalDirectionCertified: false, yearRoundCoverageEstablished: false },
    }
    await writeJson(join(auditDir, `${raw.metadata.serviceDate}.json`), report)
    days.push({ ...report, patterns: undefined, directedPairs: undefined })
    patternSets.push(new Set(result.patterns.map(p => p.id)))
    console.log(JSON.stringify({ date: report.serviceDate, ...coverage }))
  }
  const inventory = timetable.routes.map(route => {
    const days = routeDays.get(route.id), total = days.reduce((n, d) => n + d.trips, 0), admitted = days.reduce((n, d) => n + d.admittedTrips, 0)
    return { ...route, night: solothurnNight(route), geometrySourceMode: Object.keys(SO_MODES).find(k => SO_MODES[k] === route.mode) ?? null, days,
      status: !total ? 'inactive-on-validation-dates' : !admitted ? 'excluded' : total === admitted ? 'admitted-all-dated-trips' : 'partially-admitted' }
  })
  const usedStopIds = new Set(inventory.flatMap(r => r.inCantonStops))
  const contains = bernArea(source.canton[0].geometry)
  const sourceStopInventory = source.stops.map(f => {
    const didok = f.properties.didok == null ? null : String(f.properties.didok < 100000 ? 8500000 + f.properties.didok : f.properties.didok)
    const matches = timetable.sourceStopInventory.filter(s => s.didok === didok)
    const called = matches.filter(s => usedStopIds.has(s.id))
    return { ...f, normalizedDidok: didok, insideCanton: contains(f.geometry.coordinates),
      cantonGtfsStopIds: matches.map(s => s.id), calledCantonGtfsStopIds: called.map(s => s.id),
      nearestMatchingCantonPlatformMetres: matches.length ? Math.min(...matches.map(s => distanceMetres(s.point, bernWgs84(f.geometry.coordinates)))) : null,
      status: called.length ? 'didok-matches-called-canton-stop' : matches.length ? 'didok-matches-uncalled-canton-stop' : 'no-canton-stop-didok-match' }
  })
  const summary = { schemaVersion: 1, sourceHashes, sources: provenance, census: timetable.census,
    routeCount: inventory.length, agencyCount: new Set(inventory.map(r => r.agencyId)).size,
    sourceInventory: { networkRecords: source.lines.length, stops: source.stops.length, emptyLineStructureRecords: 0,
      sourceStopReconciliation: { rule: 'Source five-digit DiDok receives Swiss 8500000 prefix; exact join to original GTFS didok. Compared with canton-contained GTFS stops only; outside/no-match records are not declared missing service.',
        byStatus: Object.fromEntries([...new Set(sourceStopInventory.map(s => s.status))].map(status => [status, sourceStopInventory.filter(s => s.status === status).length])),
        outsideCanton: sourceStopInventory.filter(s => !s.insideCanton).length },
      sourceRecordsAreRouteShapes: false, graph: Object.fromEntries([...graphs].map(([mode, g]) => [mode, g.topology])) },
    weekdaySundayPatterns: { shared: [...patternSets[0]].filter(id => patternSets[1].has(id)).length,
      weekdayOnly: [...patternSets[0]].filter(id => !patternSets[1].has(id)).length,
      sundayOnly: [...patternSets[1]].filter(id => !patternSets[0].has(id)).length,
      key: 'GTFS route identity + direction_id + full ordered original platform IDs, including repeats and out-of-canton calls' },
    routesByStatus: Object.fromEntries([...new Set(inventory.map(r => r.status))].sort().map(status => [status, inventory.filter(r => r.status === status).length])),
    districts: source.districts.map(d => ({ district: d.properties.name,
      calledPlatforms: timetable.sourceStopInventory.filter(s => s.district === d.properties.name && usedStopIds.has(s.id)).length,
      routeIds: inventory.filter(r => r.districts.includes(d.properties.name)).map(r => r.id),
      admittedCalledPlatforms: timetable.sourceStopInventory.filter(s => s.district === d.properties.name && [...admittedRouteStops.values()].some(ids => ids.has(s.id))).length,
      admittedRouteIds: inventory.filter(r => timetable.sourceStopInventory.some(s => s.district === d.properties.name && admittedRouteStops.get(r.id)?.has(s.id))).map(r => r.id) })), days,
    scopeLimits: ['Annual fixed-stop GTFS census, not all real-world services or GTFS-Flex areas. Two September dates do not establish winter, holiday or year-round pattern coverage.',
      'Route membership uses original call coordinates inside the unsimplified canton polygon. Boundary-adjacent calls are disclosed; no buffer silently admits neighbouring-canton services.',
      'Full cross-canton journeys retained. Source extent, gaps and unsupported modes cause whole-pattern exclusion, never cropped calls.',
      'Source has no route/operator/direction identifiers. Geometric checks validate plausibility, not the exact operator itinerary, one-way legality, rail gauge, bridges, running tracks or temporary diversions.',
      'Solothurn source excludes night services; admitted night journeys use separate OSM road, FOT or reviewed SBB corridor inference on every segment, never the daytime cantonal graph.',
      'Bahn remains rail only. BLT tram 10 and BSG boat 3216 use exact official operator/line sources. Standard-gauge rail and bus road supplements retain full-pattern consensus, bounds and separate provenance.',
    ] }
  topologyReview.junctions = Object.fromEntries([...graphs].map(([mode, graph]) => [mode, graph.endpointInteriorJunctions]))
  for (const [mode, graph] of graphs) assert.equal(graph.edges.length, baseline.graph[mode].edges, 'Noding must not invent edges')
  await writeJson(join(auditDir, 'topology-review.json'), topologyReview, true)
  await writeJson(join(auditDir, 'supplement-review.json'), supplementReview, true)
  await writeJson(join(auditDir, 'corridor-review.json'), corridorReview, true)
  await writeJson(join(auditDir, 'rail-platform-review.json'), railReview, true)
  await writeJson(join(auditDir, 's29-precedence-review.json'), s29Review, true)
  await writeJson(join(auditDir, 'bus-junction-review.json'), busReview, true)
  await writeJson(join(auditDir, 'access-road-review.json'), accessReview, true)
  await writeJson(join(auditDir, 'bern-terminal-review.json'), terminalReview, true)
  await writeJson(join(auditDir, 's26-review.json'), s26Review, true)
  await writeJson(join(auditDir, 'como-review.json'), comoReview, true)
  await writeJson(join(auditDir, 'simplon-review.json'), simplonReview, true)
  await writeJson(join(auditDir, 'delle-review.json'), delleReview, true)
  await writeJson(join(auditDir, 'summary.json'), summary, true)
  await writeJson(join(auditDir, 'routes.json'), inventory, true)
  await writeJson(join(auditDir, 'stops.json'), timetable.sourceStopInventory)
  await writeJson(join(auditDir, 'source-network.json'), source.lines.map(f => ({ ...f.properties,
    mode: SO_MODES[f.properties.verkehrsmittel], parts: f.geometry.coordinates.length,
    vertices: f.geometry.coordinates.reduce((n, p) => n + p.length, 0), status: 'included-in-mode-graph', routeIdentity: null })))
  await writeJson(join(auditDir, 'source-stops.json'), sourceStopInventory)
  await writeJson(join(output, 'sources.json'), provenance, true)
  await mkdir(join(output, 'supplements'), { recursive: true })
  for (const name of ['terms_of_use_de.pdf', 'terms_of_use_fr.pdf']) await copyFile(join(sourceDir, 'supplements', name), join(output, 'supplements', name))
  await copyFile(join(sourceDir, 'corridors/sbb/terms.html'), join(output, 'supplements/sbb-terms.html'))
  for (const name of ['metadata.html', 'terms.html', 'publications.json']) await copyFile(join(sourceDir, name), join(output, name))
  await writeJson(join(output, 'index.json'), { label: 'Solothurn canton regional feed', sourceHashes, dates: SO_DATES.map(date => ({ date,
    manifest: `${date}/solothurn-region-day-manifest.json`, morning: `${date}/solothurn-region-morning.json` })),
    admission: 'Complete directed patterns with inferred official-network geometry; exclusions in docs/SOLOTHURN-STUDY.md and data/solothurn-audit.' }, true)
  return summary
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildSolothurnRegion()
