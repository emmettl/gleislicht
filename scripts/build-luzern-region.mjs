import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { SERVICE_CATEGORIES } from '@motionstudies/core/theme'
import { luzernGraphs, matchLuzernPair, directedPatternKey } from './luzern-line-geometry.mjs'
import { luzernMode, inCanton } from './luzern-timetable.mjs'
import { sha256, LUZERN_METADATA, LUZERN_TERMS } from './download-luzern-sources.mjs'
import { roadConsensus, validateLuzernRoadScope } from './luzern-road-geometry.mjs'
import { loadLuzernRail } from './luzern-rail-geometry.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const save = async (path, value, pretty = false) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, pretty ? 2 : undefined) + (pretty ? '\n' : '')) }
const ratio = (a, b) => b ? a / b : null
const gz = value => gzipSync(JSON.stringify(value)).length
const keyForRoute = r => JSON.stringify([r.agencyId, r.mode, r.line])
export const luzernCategory = r => r.mode === 'rail' ? r.line.startsWith('EC') ? 'international' : r.line.startsWith('IC') ? 'intercity' : r.line.startsWith('S') ? 's-bahn' : r.line.startsWith('RE') ? 'regional-express' : r.line.startsWith('IR') || r.line === 'VAE' ? 'interregio' : r.line === 'EXT' ? 'other' : 'regional' : r.mode === 'mountain' ? r.routeType === 116 ? 'other' : r.routeType === 1400 ? 'funicular' : 'cableway' : r.mode

export function compactLuzern(trains, stops, paths, metadata) {
  const ids = [...new Set(trains.flatMap(t => t.calls.map(c => c.id)))].sort(), indices = new Map(ids.map((id, i) => [id, i]))
  const platforms = ids.map(id => { const s = stops.get(id); return [Number(s.stop_lon), Number(s.stop_lat), s.stop_name, s.platform_code, id] })
  const usedPaths = [...new Set(trains.flatMap(t => t.pathSegments))].sort((a, b) => a - b), remap = new Map(usedPaths.map((id, i) => [id, i]))
  const movements = trains.map(({ calls, ...t }) => ({ ...t, stops: calls.map(c => [indices.get(c.id), c.arrival, c.departure]),
    callRules: calls.map(c => [c.pickupType, c.dropOffType]), sourceCallSequences: calls.map(c => c.sequence), pathSegments: t.pathSegments.map(p => remap.get(p)),
    start: calls[0].departure, end: calls.at(-1).arrival }))
  const edges = [...new Set(movements.flatMap(t => t.stops.slice(1).map(([b], i) => [t.stops[i][0], b].sort((a, b) => a - b).join(':'))))].sort().map(k => k.split(':').map(Number))
  return { metadata, bounds: { minLongitude: Math.min(...platforms.map(s => s[0])), maxLongitude: Math.max(...platforms.map(s => s[0])), minLatitude: Math.min(...platforms.map(s => s[1])), maxLatitude: Math.max(...platforms.map(s => s[1])) },
    stops: platforms, trains: movements, paths: usedPaths.map(i => paths[i]), edges, edgePaths: edges.map(() => null) }
}

export function validateLuzernSnapshot(snapshot) {
  assert(snapshot.trains.length, 'Empty Luzern feed')
  assert.equal(new Set(snapshot.trains.map(t => t.id)).size, snapshot.trains.length)
  for (const t of snapshot.trains) {
    assert(SERVICE_CATEGORIES.some(c => c.id === t.category), 'Unknown feed service category')
    assert.equal(t.pathSegments.length, t.stops.length - 1)
    assert.equal(t.sourceCallSequences.length, t.stops.length)
    assert.equal(t.callRules.length, t.stops.length)
    assert(t.stops.every(([i, a, d], j) => snapshot.stops[i] && Number.isFinite(a) && a <= d && (!j || a >= t.stops[j - 1][2])), 'Invalid timetable')
    for (let i = 0; i < t.pathSegments.length; i++) {
      const index = t.pathSegments[i], p = snapshot.paths[index]
      assert(Number.isInteger(index) && p?.length >= 2, 'Admitted trip has a geometry gap')
      const near = (a, b) => Math.abs(a[0] - b[0]) < 0.000001 && Math.abs(a[1] - b[1]) < 0.000001
      assert(near(p[0], snapshot.stops[t.stops[i][0]]) && near(p.at(-1), snapshot.stops[t.stops[i + 1][0]]), 'Path direction/endpoints do not match source calls')
    }
  }
}

export async function buildLuzernRegion({ timetablePath, sourceDirectory, policyPath, output, auditPath }) {
  const raw = await json(timetablePath), policy = await json(policyPath), catalogue = await json(join(sourceDirectory, 'sources.json'))
  assert.equal(raw.sourceHashes.archive, policy.feedSha256, 'Unreviewed timetable archive')
  assert.deepEqual(raw.dates, policy.dates)
  for (const source of catalogue.sources) assert.equal(sha256(await readFile(join(sourceDirectory, source.file))), source.sha256, `Changed source ${source.file}`)
  assert.equal(raw.sourceHashes.boundary, sha256(await readFile(join(sourceDirectory, 'boundary.json'))))
  const sourceHashes = { ...raw.sourceHashes, timetable: sha256(await readFile(timetablePath)), policy: sha256(await readFile(policyPath)), catalogue: sha256(await readFile(join(sourceDirectory, 'sources.json'))) }
  let roadCache, roads = new Map()
  if (policy.roadFallback) {
    const bytes = await readFile(policy.roadFallback.cache)
    assert.equal(sha256(bytes), policy.roadFallback.sha256, 'Changed road cache')
    roadCache = JSON.parse(bytes)
    assert.equal(roadCache.metadata.timetableSha256, sourceHashes.timetable)
    validateLuzernRoadScope(raw, roadCache)
    roads = roadConsensus(roadCache, policy.limits)
    sourceHashes.roads = sha256(bytes)
  }
  const rail = policy.railFallback ? await loadLuzernRail(policy.railFallback, raw) : undefined
  if (rail) { sourceHashes.rail = rail.source.sha256; sourceHashes.railInputs = policy.railFallback.inputsSha256 }
  const collections = {}, layers = {}
  for (const layer of ['bus', 'rail', 'boat']) { collections[layer] = await json(join(sourceDirectory, `${layer}.geojson`)); layers[layer] = await json(join(sourceDirectory, `${layer}-layer.json`)) }
  const { graphs, inventory: sourceInventory } = luzernGraphs(collections, layers, policy)
  const routes = new Map(raw.inventory.map(r => [r.routeId, { ...r, mode: luzernMode(r.routeType) }]))
  const stops = new Map(raw.stops.map(s => [s.stop_id, s])), pairCache = new Map(), paths = [], pathIndices = new Map()
  const sourceStops = (await json(join(sourceDirectory, 'stops.geojson'))).features
  const boundary = (await json(join(sourceDirectory, 'boundary.json'))).feature.geometry
  const rawCantonSloids = new Set(raw.cantonStops.map(s => `ch:1:sloid:${Number(s.didok) - 8500000}`))
  const sourceStopReview = sourceStops.filter(s => inCanton(s.geometry.coordinates, boundary)).map(f => ({ id: f.properties.SLOID, name: f.properties.HSTNAME, municipality: f.properties.GEMEINDE,
    modeCode: f.properties.VMITTEL, sourceTU: f.properties.TU, gtfsStopPresent: rawCantonSloids.has(f.properties.SLOID) }))
  const days = []
  for (const day of raw.snapshots) {
    console.log(`Matching ${day.date}: ${day.trains.length} full civil-day trips…`)
    const patterns = new Map(), pairs = new Map(), admitted = [], routeCounts = new Map(), reasons = new Map()
    for (const train of day.trains) {
      const route = routes.get(train.routeId), candidate = graphs.get(keyForRoute(route)), patternKey = directedPatternKey(train)
      if (!patterns.has(patternKey)) {
        const pairKeys = train.calls.slice(1).map((call, i) => {
          const from = train.calls[i].id, to = call.id, key = JSON.stringify([route.routeId, from, to])
          if (!pairCache.has(key)) {
            const a = stops.get(from), b = stops.get(to)
            let result = route.mode === 'boat' ? { reason: 'stale-or-missing-boat-source' } : matchLuzernPair(candidate, [Number(a.stop_lon), Number(a.stop_lat)], [Number(b.stop_lon), Number(b.stop_lat)], policy.limits)
            if (result.path) result.geometrySource = 'official-line'
            else if (route.mode === 'bus' && roads.has(key)) {
              const road = roads.get(key)
              result = road.path ? { ...road, officialAssessment: result } : { ...result, roadAssessment: road }
            }
            else if (route.mode === 'rail' && rail?.pairs.has(key)) {
              const fallback = rail.pairs.get(key)
              result = fallback.path ? { ...fallback, officialAssessment: result } : { ...result, railAssessment: fallback }
            }
            const { path, ...assessment } = result
            let pathIndex = null
            if (path) { const signature = JSON.stringify(path); if (!pathIndices.has(signature)) { pathIndices.set(signature, paths.length); paths.push(path) } pathIndex = pathIndices.get(signature) }
            pairCache.set(key, { key, routeId: route.routeId, agencyId: route.agencyId, mode: route.mode, line: route.line, fromId: from, toId: to, from: a.stop_name, to: b.stop_name, pathIndex, geometrySha256: path ? sha256(JSON.stringify(path)) : null, ...assessment })
          }
          return key
        })
        const failures = pairKeys.filter(k => pairCache.get(k).pathIndex === null)
        // A service requiring prior arrangement is inventoried, not animated as
        // an unconditional fixed departure. This also preserves GTFS call rules.
        const demandResponsive = train.calls.some(c => ['2', '3'].includes(c.pickupType) || ['2', '3'].includes(c.dropOffType))
        const reasonList = [...new Set(failures.map(k => pairCache.get(k).reason)), ...(demandResponsive ? ['prior-arrangement-call'] : [])]
        patterns.set(patternKey, { id: sha256(patternKey).slice(0, 20), routeId: route.routeId, agencyId: route.agencyId, mode: route.mode, line: route.line,
          directionId: train.directionId, stopIds: train.calls.map(c => c.id), stopNames: train.calls.map(c => stops.get(c.id).stop_name), callRules: train.calls.map(c => [c.pickupType, c.dropOffType]),
          pairKeys, trips: 0, admitted: !reasonList.length, reasons: reasonList, geometryPairs: pairKeys.length - failures.length, totalPairs: pairKeys.length,
          carryInTrips: 0, representativeHeadwayTrips: 0 })
      }
      const pattern = patterns.get(patternKey)
      pattern.trips++; pattern.carryInTrips += Number(train.sourceServiceDate !== day.date); pattern.representativeHeadwayTrips += Number(train.frequency?.exactTimes === 0)
      for (const k of pattern.pairKeys) { const pair = pairs.get(k) ?? { ...pairCache.get(k), occurrences: 0, scheduledOccurrences: 0, representativeHeadwayOccurrences: 0, admittedOccurrences: 0 }; pair.occurrences++; pair.scheduledOccurrences += Number(train.frequency?.exactTimes !== 0); pair.representativeHeadwayOccurrences += Number(train.frequency?.exactTimes === 0); pair.admittedOccurrences += Number(pattern.admitted); pairs.set(k, pair) }
      const count = routeCounts.get(route.routeId) ?? { routeId: route.routeId, agencyId: route.agencyId, mode: route.mode, line: route.line, trips: 0, admittedTrips: 0, segmentOccurrences: 0, matchedSegmentOccurrences: 0, carryInTrips: 0, admittedCarryInTrips: 0 }
      count.trips++; count.admittedTrips += Number(pattern.admitted); count.segmentOccurrences += pattern.totalPairs; count.matchedSegmentOccurrences += pattern.geometryPairs
      count.carryInTrips += Number(train.sourceServiceDate !== day.date); count.admittedCarryInTrips += Number(pattern.admitted && train.sourceServiceDate !== day.date)
      routeCounts.set(route.routeId, count)
      if (pattern.admitted) admitted.push({ ...train, route: route.line, agencyId: route.agencyId, routeType: route.routeType, transportMode: route.routeType === 116 ? 'cogwheel' : route.mode, category: luzernCategory(route), patternId: pattern.id, pathSegments: pattern.pairKeys.map(k => pairCache.get(k).pathIndex), geometrySources: pattern.pairKeys.map(k => pairCache.get(k).geometrySource) })
      else for (const reason of pattern.reasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
    }
    const metadata = { publisher: 'Gleislicht, derived from SBB and official Luzern open data', feedVersion: raw.feed.feed_version, serviceDate: day.date,
      dayModel: 'civil day with preceding service-day spillover', sourceServiceDates: [new Date(Date.parse(`${day.date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10), day.date],
      windowStart: 0, windowEnd: 86400, focusTime: 27900, sourceHashes, modes: [...new Set(admitted.map(t => routes.get(t.routeId).mode))],
      label: 'Luzern canton — admitted complete stop patterns', model: 'scheduled interpolation along inferred official alignments',
      note: policy.admission, scope: raw.scope.description, exclusions: policy.scopeLimits,
      attribution: ['Timetable: SBB / opentransportdata.swiss', '© rawi Kanton Luzern; © Verkehrsverbund Luzern', 'Canton boundary: © swisstopo'],
      sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020', termsUrl: 'https://opentransportdata.swiss/en/terms-of-use/',
      geometry: { license: 'Open-By', metadataUrl: LUZERN_METADATA, termsUrl: LUZERN_TERMS, busVintage: '2026-05-26', railVintage: '2026-05-08', limits: policy.limits, sourceCrs: 'EPSG:2056', outputCrs: 'EPSG:4326', repairs: policy.geometryRepairs, direction: 'Undirected source alignments; ordered GTFS calls determine travel direction. No one-way street certification.' },
      frequency: { headwayTrips: admitted.filter(t => t.frequency?.exactTimes === 0).length, exactFrequencyTrips: admitted.filter(t => t.frequency?.exactTimes === 1).length, model: 'Source-interval-anchored representative grid when exact_times=0; not scheduled departures.' } }
    if (metadata.frequency.headwayTrips) metadata.model = 'scheduled and representative headway interpolation along inferred official alignments'
    if (roadCache) {
      metadata.model = 'scheduled interpolation along official alignments and inferred OSM bus roads'
      metadata.attribution.push('© OpenStreetMap contributors (ODbL-1.0)')
      metadata.geometry.license = 'Open-By (official alignments); ODbL-1.0 (OSM-derived road segments)'
      metadata.geometry.roadFallback = { ...roadCache.metadata, cacheSha256: sourceHashes.roads,
        licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
        consensus: 'Every complete bus pattern containing a pair must yield an identical accepted path',
        limits: policy.limits, pathAttribution: 'Per-journey geometrySources identifies each official or OSM-derived segment' }
    }
    if (rail) {
      metadata.publisher = 'Gleislicht, derived from SBB, Luzern, FOT and OpenStreetMap data'
      metadata.model = 'scheduled interpolation along cantonal alignments and inferred federal rail / OSM bus corridors'
      metadata.attribution.push(rail.source.attribution)
      metadata.geometry.federalRail = { ...rail.source, limits: policy.railFallback.limits,
        matching: 'Exact operating-point IDs, reviewed route/gauge identities and full-pattern stop-order constraints; consensus across every context',
        pathAttribution: 'geometrySources = fot-rail-inference; no individual running-track or diversion certification' }
    }
    const snapshot = compactLuzern(admitted, stops, paths, metadata)
    validateLuzernSnapshot(snapshot)
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'luzern-region-day-chunks')
    const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
    const destination = join(output, day.date)
    for (const { descriptor, payload } of chunks) await save(join(destination, descriptor.path), payload)
    await save(join(destination, 'luzern-region-day-manifest.json'), manifest)
    await save(join(destination, 'luzern-region-morning.json'), morning)
    const counts = [...routeCounts.values()], ps = [...patterns.values()], pairList = [...pairs.values()]
    const groups = [...new Set(counts.map(c => `${c.agencyId}:${c.mode}`))].map(id => {
      const rr = counts.filter(c => `${c.agencyId}:${c.mode}` === id), pp = ps.filter(p => `${p.agencyId}:${p.mode}` === id), sp = pairList.filter(p => `${p.agencyId}:${p.mode}` === id)
      const sum = key => rr.reduce((n, r) => n + r[key], 0)
      return { id, agency: routes.get(rr[0].routeId).agency, mode: rr[0].mode, routes: rr.length, trips: sum('trips'), admittedTrips: sum('admittedTrips'),
        patterns: pp.length, admittedPatterns: pp.filter(p => p.admitted).length, directedPairs: sp.length, matchedDirectedPairs: sp.filter(p => p.pathIndex !== null).length,
        segmentOccurrences: sum('segmentOccurrences'), matchedSegmentOccurrences: sum('matchedSegmentOccurrences'), geometryCoverage: ratio(sum('matchedSegmentOccurrences'), sum('segmentOccurrences')) }
    })
    days.push({ date: day.date, trips: day.trains.length, admittedTrips: admitted.length, excludedTrips: day.trains.length - admitted.length,
      carryInTrips: day.trains.filter(t => t.sourceServiceDate !== day.date).length, admittedCarryInTrips: admitted.filter(t => t.sourceServiceDate !== day.date).length,
      representativeHeadwayTrips: day.trains.filter(t => t.frequency?.exactTimes === 0).length, admittedHeadwayTrips: metadata.frequency.headwayTrips,
      patterns: ps.length, admittedPatterns: ps.filter(p => p.admitted).length, directedPairs: pairList.length, matchedDirectedPairs: pairList.filter(p => p.pathIndex !== null).length,
      segmentOccurrences: counts.reduce((n, c) => n + c.segmentOccurrences, 0), matchedSegmentOccurrences: counts.reduce((n, c) => n + c.matchedSegmentOccurrences, 0),
      scheduledSegmentOccurrences: pairList.reduce((n, p) => n + p.scheduledOccurrences, 0), matchedScheduledSegmentOccurrences: pairList.filter(p => p.pathIndex !== null).reduce((n, p) => n + p.scheduledOccurrences, 0),
      representativeHeadwaySegmentOccurrences: pairList.reduce((n, p) => n + p.representativeHeadwayOccurrences, 0),
      repairedDirectedPairs: pairList.filter(p => p.geometryRepairIds?.length).length,
      admittedTripsUsingRepair: ps.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometryRepairIds?.length)).reduce((n, p) => n + p.trips, 0),
      roadDirectedPairs: pairList.filter(p => p.geometrySource === 'osm-road-inference').length,
      admittedTripsUsingRoads: ps.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometrySource === 'osm-road-inference')).reduce((n, p) => n + p.trips, 0),
      federalRailDirectedPairs: pairList.filter(p => p.geometrySource === 'fot-rail-inference').length,
      admittedTripsUsingFederalRail: ps.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometrySource === 'fot-rail-inference')).reduce((n, p) => n + p.trips, 0),
      groups, routes: counts, exclusionReasons: Object.fromEntries(reasons), directedPatterns: ps, directedStopPairs: pairList.map(({ pathIndex, ...p }) => ({ ...p, matched: pathIndex !== null })),
      artifacts: { directory: destination, manifestGzipBytes: gz(manifest), morningGzipBytes: gz(morning), chunks: chunks.map(({ descriptor, payload }) => ({ id: descriptor.id, gzipBytes: gz(payload), trips: descriptor.tripCount })) } })
  }
  const inventory = [...routes.values()].map(r => ({ ...r, sourceFeatures: graphs.get(keyForRoute(r))?.sourceFeatures ?? [], days: days.map(day => {
    const c = day.routes.find(c => c.routeId === r.routeId), patterns = day.directedPatterns.filter(p => p.routeId === r.routeId)
    return { date: day.date, trips: c?.trips ?? 0, admittedTrips: c?.admittedTrips ?? 0, status: !c ? 'inactive-on-civil-day' : c.admittedTrips === c.trips ? 'admitted' : c.admittedTrips ? 'partially-admitted' : 'excluded', reasons: [...new Set(patterns.flatMap(p => p.reasons))] }
  }) }))
  for (const source of sourceInventory) {
    source.geometryRepairIds = policy.geometryRepairs?.repairs.filter(r => r.targetFeature === source.key).map(r => r.id) ?? []
    source.repairDonorFor = policy.geometryRepairs?.repairs.filter(r => r.sourceFeatures.includes(source.key)).map(r => r.id) ?? []
    source.gtfsRoutes = inventory.filter(r => r.sourceFeatures.includes(source.key)).map(r => r.routeId)
    source.admittedTrips = days.reduce((n, d) => {
      const used = new Set(d.directedStopPairs.filter(p => p.matched && p.sourceFeatures?.includes(source.key)).map(p => p.key))
      return n + d.directedPatterns.filter(p => p.admitted && p.pairKeys.some(k => used.has(k))).reduce((n, p) => n + p.trips, 0)
    }, 0)
    source.status = !source.agencyIds ? 'identity-or-vintage-exclusion' : !source.gtfsRoutes.length ? 'no-annual-Luzern-calling-route' : source.admittedTrips ? 'used-for-admitted-patterns' : 'no-admitted-fixture-pattern'
  }
  const report = { schemaVersion: 1, feed: raw.feed, sourceHashes, scope: raw.scope, policy, annualRouteRecords: inventory.length, annualAgencies: new Set(inventory.map(r => r.agencyId)).size,
    catalogue, sourceInventory, sourceStopReview, inventory, days,
    ...(roadCache ? { roads: { metadata: roadCache.metadata, agencies: Object.entries(roadCache.agencies).map(([agencyId, a]) => ({ agencyId, patterns: Object.keys(a.identities).length, matcher: a.cache.metadata.matcher, report: a.cache.report })),
      consensusPairs: roads.size, acceptedConsensusPairs: [...roads.values()].filter(r => r.path).length,
      rejectedConsensusPairs: [...roads].filter(([, r]) => !r.path).map(([key, r]) => ({ key, ...r })) } } : {}),
    ...(rail ? { federalRail: { source: rail.source, sourceInventory: rail.sourceInventory, directedPatterns: rail.patterns,
      consensusPairs: rail.pairs.size, matchedConsensusPairs: [...rail.pairs.values()].filter(r => r.path).length,
      rejectedConsensusPairs: [...rail.pairs].filter(([, r]) => !r.path).map(([key, r]) => ({ key, ...r })) } } : {}),
    validation: { passed: true, annualPinnedTimetableInventoryComplete: true, admittedGeometryComplete: true, cantonMotionCoverageComplete: false, publicationReady: false,
      meaning: 'All admitted complete directed patterns pass numerical and artifact checks. Coverage denominators include excluded modes/patterns. This does not certify road direction or establish year-round geometry coverage.',
      pending: ['Resolve every excluded route/pattern before claiming complete cantonal motion coverage', 'Review street directions, loops, rail branches and temporary diversions before presenting paths as direction-certified', 'Validate seasonal and holiday dates', 'Integrate UI selection and refresh separately if requested'] } }
  await save(auditPath, report, true)
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [timetablePath, sourceDirectory = 'data/luzern-sources', output = 'public/data/luzern-region', auditPath = 'data/luzern-study-audit.json'] = process.argv.slice(2)
  assert(timetablePath, 'Usage: node scripts/build-luzern-region.mjs TIMETABLE [SOURCES OUTPUT AUDIT]')
  const r = await buildLuzernRegion({ timetablePath, sourceDirectory, output, auditPath, policyPath: 'data/luzern-policy.json' })
  console.log(JSON.stringify({ routes: r.annualRouteRecords, agencies: r.annualAgencies, days: r.days.map(({ directedPatterns: _patterns, directedStopPairs: _pairs, routes: _routes, ...d }) => d) }, null, 2))
}
