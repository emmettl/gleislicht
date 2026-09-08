import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { zugGraphs, directedPatternKey } from './zug-line-geometry.mjs'
import { zugMode, inCanton } from './zug-timetable.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { loadZugRoads, mergeZugRoadCandidates, matchZugRoadPair, zugOfficialAttempt } from './zug-road-geometry.mjs'
import { loadZugMountain } from './zug-mountain-geometry.mjs'
import { loadZugBoats } from './zug-boat-geometry.mjs'
import { loadZugOsmBoats } from './zug-osm-boats.mjs'
import { reviewZugBoats } from './review-zug-boats.mjs'
import { reviewZugGrienbach } from './review-zug-grienbach.mjs'
import { reviewZugGrienbachAtlas } from './review-zug-grienbach-atlas.mjs'
import { reviewZugGrienbachDirections } from './review-zug-grienbach-directions.mjs'
import { loadZugRoadContexts, matchZugRoadContext } from './zug-road-contexts.mjs'
import { loadZugServiceRoads, matchZugServiceRoadPair } from './zug-service-road-geometry.mjs'
import { loadZugComoRail, matchZugRailWithComo } from './zug-como-rail.mjs'
import { loadZugSbbRailSupplement } from './zug-sbb-rail-supplement.mjs'
import { loadZugRail } from './zug-rail-geometry.mjs'
import { loadZugBusSupplement, matchZugBusPair } from './zug-bus-supplement.mjs'

const json = async path => { const bytes = await readFile(path); return JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes) : bytes.toString()) }
const save = async (path, value, pretty = false) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, pretty ? 2 : undefined) + (pretty ? '\n' : '')) }
const ratio = (a, b) => b ? a / b : null
const gz = value => gzipSync(JSON.stringify(value)).length
const uniquePairs = pairs => {
  const groups = new Map()
  for (const p of pairs) {
    const key = JSON.stringify([p.routeId, p.fromId, p.toId]), values = groups.get(key) ?? []
    values.push(p); groups.set(key, values)
  }
  return { uniqueDirectedRouteStopPairs: groups.size, fullyMatchedUniqueDirectedRouteStopPairs: [...groups.values()].filter(values => values.every(p => p.pathIndex !== null)).length }
}
const keyForRoute = r => JSON.stringify([r.agencyId, r.mode, r.line])
const category = r => r.mode === 'rail' ? r.line.startsWith('S') ? 's-bahn' : r.line.startsWith('RE') ? 'regional-express' : r.line.startsWith('IR') ? 'interregio' : 'regional' : r.mode === 'boat' ? 'ferry' : r.mode === 'mountain' ? r.routeType === 116 ? 'other' : r.routeType === 1400 ? 'funicular' : 'cableway' : r.mode

export { compactLuzern as compactZug, validateLuzernSnapshot as validateZugSnapshot } from './build-luzern-region.mjs'
import { compactLuzern as compactZug, validateLuzernSnapshot as validateZugSnapshot } from './build-luzern-region.mjs'

export async function buildZugRegion({ timetablePath, sourceDirectory, policyPath, output, auditPath }) {
  const raw = await json(timetablePath), policy = await json(policyPath), catalogue = await json(join(sourceDirectory, 'sources.json'))
  assert.equal(raw.sourceHashes.archive, policy.feedSha256, 'Unreviewed timetable archive')
  assert.deepEqual(raw.dates, policy.dates)
  for (const source of catalogue.sources) assert.equal(sha256(await readFile(join(sourceDirectory, source.file))), source.sha256, `Changed source ${source.file}`)
  assert.equal(raw.sourceHashes.boundary, sha256(await readFile(join(sourceDirectory, 'boundary.json'))))
  const sourceHashes = { ...raw.sourceHashes, timetable: sha256(await readFile(timetablePath)), policy: sha256(await readFile(policyPath)), catalogue: sha256(await readFile(join(sourceDirectory, 'sources.json'))) }
  const collection = await json(join(sourceDirectory, 'bus.geojson'))
  const { graphs, inventory: sourceInventory } = zugGraphs(collection, policy)
  const routes = new Map(raw.inventory.map(r => [r.routeId, { ...r, mode: zugMode(r.routeType) }]))
  const stops = new Map(raw.stops.map(s => [s.stop_id, s])), pairCache = new Map(), paths = [], pathIndices = new Map()
  const municipalities = (await json(join(sourceDirectory, 'municipalities.geojson'))).features
  assert.equal(municipalities.length, 11)
  const municipalityReview = municipalities.map(f => ({ name: f.properties.name, bfs: f.properties.bfs_nummer,
    cantonStopIds: raw.cantonStops.filter(s => inCanton([Number(s.stop_lon), Number(s.stop_lat)], f.geometry)).map(s => s.stop_id) }))
  const rail = await loadZugRail(policy.rail, raw.dates)
  sourceHashes.rail = policy.rail.sourceSha256
  const railSupplement = await loadZugSbbRailSupplement(policy.railSupplement)
  sourceHashes.railSupplement = policy.railSupplement.sourceSha256
  const comoRail = await loadZugComoRail(policy.railComo, raw, sourceHashes.timetable)
  sourceHashes.railComo = policy.railComo.sourceSha256
  const supplement = await loadZugBusSupplement(policy.busSupplement)
  sourceHashes.busSupplement = policy.busSupplement.sourceSha256
  const boats = await loadZugBoats(policy.boat)
  sourceHashes.boat = policy.boat.sourceSha256
  const osmBoats = await loadZugOsmBoats(policy.boatOsm, policy.boat, raw, sourceHashes.timetable)
  sourceHashes.boatOsm = policy.boatOsm.sourceSha256
  const boatReview = await reviewZugBoats(policy.boatReview, policy.boat, raw, sourceHashes.timetable)
  sourceHashes.boatReview = policy.boatReview.sourceSha256
  const mountain = await loadZugMountain(policy.mountain)
  sourceHashes.mountain = policy.mountain.sourceSha256
  const roads = await loadZugRoads(policy.road, raw, sourceHashes.timetable)
  sourceHashes.road = policy.road.cacheSha256
  const roadExpansion = await loadZugRoads(policy.roadExpansion, raw, sourceHashes.timetable)
  sourceHashes.roadExpansion = policy.roadExpansion.cacheSha256
  roads.candidates = mergeZugRoadCandidates(roads, roadExpansion)
  const serviceRoads = await loadZugServiceRoads(policy.roadServiceAccess, policy.roadExpansion, raw, sourceHashes.timetable)
  sourceHashes.roadServiceAccess = policy.roadServiceAccess.sourceSha256
  const roadContexts = await loadZugRoadContexts(policy.roadContexts, policy.roadExpansion, raw)
  sourceHashes.roadContexts = policy.roadContexts.sourceSha256
  const grienbachReview = await reviewZugGrienbach(policy.grienbachReview, policy.roadExpansion, raw, sourceHashes.timetable)
  sourceHashes.grienbachReview = policy.grienbachReview.sourceSha256
  const grienbachAtlasReview = await reviewZugGrienbachAtlas(policy.grienbachAtlasReview, policy.grienbachReview, raw, sourceHashes.timetable)
  sourceHashes.grienbachAtlasReview = policy.grienbachAtlasReview.sourceSha256
  const grienbachDirectionReview = await reviewZugGrienbachDirections(policy.grienbachDirectionReview, policy, raw, sourceHashes.timetable)
  sourceHashes.grienbachDirectionReview = policy.grienbachDirectionReview.sourceSha256
  const expansionRoutes = new Set(policy.roadExpansion.routes.map(r => r.routeId))
  const days = []
  for (const day of raw.snapshots) {
    console.log(`Matching ${day.date}: ${day.trains.length} full civil-day trips…`)
    const patterns = new Map(), pairs = new Map(), admitted = [], routeCounts = new Map(), reasons = new Map()
    for (const train of day.trains) {
      const route = routes.get(train.routeId), candidate = graphs.get(keyForRoute(route)), patternKey = directedPatternKey(train)
      if (!patterns.has(patternKey)) {
        const railPairs = route.mode === 'rail' ? matchZugRailWithComo(rail, railSupplement, comoRail, train, stops, route) : undefined
        const pairKeys = train.calls.slice(1).map((call, i) => {
          const from = train.calls[i].id, to = call.id
          const contextual = Boolean(railPairs) || osmBoats.pairKeys.has(JSON.stringify([route.routeId, from, to])) || roadContexts.pairKeys.has(JSON.stringify([route.routeId, from, to]))
          const key = JSON.stringify([route.routeId, from, to, ...(contextual ? [patternKey] : [])])
          if (!pairCache.has(key)) {
            const a = stops.get(from), b = stops.get(to)
            let result = railPairs ? railPairs[i] : route.mode === 'boat' ? boats.matchPair(route, a, b) : route.mode === 'mountain' ? mountain.matchPair(route, a, b) : route.mode !== 'bus' ? { reason: `no-reviewed-${route.mode}-geometry` } : matchZugBusPair(candidate, supplement.graphs.get(keyForRoute(route)), [Number(a.stop_lon), Number(a.stop_lat)], [Number(b.stop_lon), Number(b.stop_lat)], policy.limits)
            if (route.mode === 'boat') result = osmBoats.matchPair(result, route, train, a, b)
            if (route.mode === 'bus') {
              result = matchZugRoadPair(result, roads, route.routeId, from, to)
              result = matchZugServiceRoadPair(result, serviceRoads, route.routeId, from, to)
              result = matchZugRoadContext(result, roadContexts, train, stops, from, to)
            }
            const { path, ...assessment } = result
            let pathIndex = null
            if (path) { const signature = JSON.stringify(path); if (!pathIndices.has(signature)) { pathIndices.set(signature, paths.length); paths.push(path) } pathIndex = pathIndices.get(signature) }
            pairCache.set(key, { key, ...(contextual ? { contextPatternId: sha256(patternKey).slice(0, 20), pairIndex: i } : {}), routeId: route.routeId, agencyId: route.agencyId, mode: route.mode, line: route.line, fromId: from, toId: to, from: a.stop_name, to: b.stop_name, pathIndex, geometrySha256: path ? sha256(JSON.stringify(path)) : null, ...assessment })
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
      if (pattern.admitted) admitted.push({ ...train, route: route.line, agencyId: route.agencyId, routeType: route.routeType, transportMode: route.mode === 'boat' ? 'ferry' : route.routeType === 116 ? 'cogwheel' : route.routeType === 1400 ? 'funicular' : route.mode, category: category(route), patternId: pattern.id, pathSegments: pattern.pairKeys.map(k => pairCache.get(k).pathIndex) })
      else for (const reason of pattern.reasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
    }
    const metadata = { publisher: 'Gleislicht, derived from SBB and official Zug open data', feedVersion: raw.feed.feed_version, serviceDate: day.date,
      dayModel: 'civil day with preceding service-day spillover', sourceServiceDates: [new Date(Date.parse(`${day.date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10), day.date],
      windowStart: 0, windowEnd: 86400, focusTime: 27900, sourceHashes, modes: [...new Set(admitted.map(t => routes.get(t.routeId).mode))],
      label: 'Zug canton — admitted complete stop patterns', model: 'scheduled interpolation along official alignments and attributed inferred road, rail and shipping paths',
      note: policy.admission, scope: raw.scope.description, exclusions: policy.scopeLimits,
      attribution: ['Timetable: SBB / opentransportdata.swiss', 'Quelle: GIS Kanton Zug', 'Canton boundary: © swisstopo', '© Federal Office of Transport (FOT)', supplement.source.attribution, roads.source.attribution, railSupplement.source.attribution, boats.source.attribution, osmBoats.source.attribution],
      sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020', termsUrl: 'https://opentransportdata.swiss/en/terms-of-use/',
      geometry: { license: catalogue.license, metadataUrl: 'https://zg.ch/de/planen-bauen/geoinformation/geoinformationen-nutzen/geoinformationen-von-a-bis-z',
        termsUrl: 'https://zg.ch/de/planen-bauen/geoinformation/geoinformationen-nutzen/nutzungsbedingungen',
        archiveLastModified: catalogue.archiveLastModified, geopackageLastChange: catalogue.geopackageLastChange, currentAlignmentValidity: 'unproven',
        boatOsm: { source: osmBoats.source, policy: policy.boatOsm }, railComo: { source: comoRail.source, policy: policy.railComo }, roadContexts: { source: roadContexts.source, policy: policy.roadContexts }, roadServiceAccess: { source: serviceRoads.source, policy: policy.roadServiceAccess }, boat: { source: boats.source, policy: policy.boat }, railSupplement: { source: railSupplement.source, policy: policy.railSupplement }, road: { source: roads.source, policy: policy.road }, roadExpansion: { source: roadExpansion.source, policy: policy.roadExpansion }, mountain: { source: mountain.source, policy: policy.mountain }, busSupplement: { source: supplement.source, policy: policy.busSupplement }, topologyJoins: policy.topologyJoins, rail: { source: rail.source, policy: policy.rail },
        wfsComparison: catalogue.comparison, limits: policy.limits, sourceCrs: 'EPSG:2056', outputCrs: 'EPSG:4326',
        direction: 'Undirected source segments filtered by exact line membership. Ordered GTFS calls determine orientation; no one-way street certification.' },
      frequency: { headwayTrips: admitted.filter(t => t.frequency?.exactTimes === 0).length, exactFrequencyTrips: admitted.filter(t => t.frequency?.exactTimes === 1).length, model: 'Source-interval-anchored representative grid when exact_times=0; not scheduled departures.' } }
    if (metadata.frequency.headwayTrips) metadata.model = 'scheduled and representative headway interpolation along inferred official alignments'
    const snapshot = compactZug(admitted, stops, paths, metadata)
    validateZugSnapshot(snapshot)
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'zug-region-day-chunks')
    const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
    const destination = join(output, day.date)
    for (const { descriptor, payload } of chunks) await save(join(destination, descriptor.path), payload)
    await save(join(destination, 'zug-region-day-manifest.json'), manifest)
    await save(join(destination, 'zug-region-morning.json'), morning)
    const counts = [...routeCounts.values()], ps = [...patterns.values()], pairList = [...pairs.values()]
    const groups = [...new Set(counts.map(c => `${c.agencyId}:${c.mode}`))].map(id => {
      const rr = counts.filter(c => `${c.agencyId}:${c.mode}` === id), pp = ps.filter(p => `${p.agencyId}:${p.mode}` === id), sp = pairList.filter(p => `${p.agencyId}:${p.mode}` === id)
      const sum = key => rr.reduce((n, r) => n + r[key], 0)
      return { id, agency: routes.get(rr[0].routeId).agency, mode: rr[0].mode, routes: rr.length, trips: sum('trips'), admittedTrips: sum('admittedTrips'), ...uniquePairs(sp),
        patterns: pp.length, admittedPatterns: pp.filter(p => p.admitted).length, directedPairs: sp.length, matchedDirectedPairs: sp.filter(p => p.pathIndex !== null).length,
        segmentOccurrences: sum('segmentOccurrences'), matchedSegmentOccurrences: sum('matchedSegmentOccurrences'), geometryCoverage: ratio(sum('matchedSegmentOccurrences'), sum('segmentOccurrences')),
        failures: [...new Set(sp.filter(p => p.pathIndex === null).map(p => p.reason))].map(reason => {
          const failed = sp.filter(p => p.reason === reason)
          return { reason, directedPairs: failed.length, uniqueDirectedRouteStopPairs: uniquePairs(failed).uniqueDirectedRouteStopPairs, scheduledSegmentOccurrences: failed.reduce((n, p) => n + p.scheduledOccurrences, 0),
            representativeHeadwaySegmentOccurrences: failed.reduce((n, p) => n + p.representativeHeadwayOccurrences, 0),
            affectedPatterns: pp.filter(p => p.reasons.includes(reason)).length,
            affectedTrips: pp.filter(p => p.reasons.includes(reason)).reduce((n, p) => n + p.trips, 0) }
        }) }
    })
    days.push({ date: day.date, trips: day.trains.length, admittedTrips: admitted.length, excludedTrips: day.trains.length - admitted.length, ...uniquePairs(pairList),
      carryInTrips: day.trains.filter(t => t.sourceServiceDate !== day.date).length, admittedCarryInTrips: admitted.filter(t => t.sourceServiceDate !== day.date).length,
      representativeHeadwayTrips: day.trains.filter(t => t.frequency?.exactTimes === 0).length, admittedHeadwayTrips: metadata.frequency.headwayTrips,
      patterns: ps.length, admittedPatterns: ps.filter(p => p.admitted).length, directedPairs: pairList.length, matchedDirectedPairs: pairList.filter(p => p.pathIndex !== null).length,
      segmentOccurrences: counts.reduce((n, c) => n + c.segmentOccurrences, 0), matchedSegmentOccurrences: counts.reduce((n, c) => n + c.matchedSegmentOccurrences, 0),
      scheduledSegmentOccurrences: pairList.reduce((n, p) => n + p.scheduledOccurrences, 0), matchedScheduledSegmentOccurrences: pairList.filter(p => p.pathIndex !== null).reduce((n, p) => n + p.scheduledOccurrences, 0),
      representativeHeadwaySegmentOccurrences: pairList.reduce((n, p) => n + p.representativeHeadwayOccurrences, 0),
      admittedTripsUsingRoadContexts: ps.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometrySource === 'osm-road-pattern-inference')).reduce((n, p) => n + p.trips, 0),
      admittedTripsUsingServiceRoads: ps.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometrySource === 'osm-service-road-inference')).reduce((n, p) => n + p.trips, 0),
      admittedTripsUsingRoadExpansion: ps.filter(p => p.admitted && expansionRoutes.has(p.routeId) && p.pairKeys.some(k => pairs.get(k).geometrySource === 'osm-road-inference')).reduce((n, p) => n + p.trips, 0),
      admittedTripsUsingComoRail: ps.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometrySource === 'osm-como-rail-inference')).reduce((n, p) => n + p.trips, 0),
      admittedTripsUsingRailSupplement: ps.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometrySource === 'sbb-rail-inference')).reduce((n, p) => n + p.trips, 0),
      roadMatchedPairs: pairList.filter(p => p.geometrySource === 'osm-road-inference' && p.pathIndex !== null).length,
      admittedTripsUsingRoads: ps.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometrySource === 'osm-road-inference')).reduce((n, p) => n + p.trips, 0),
      supplementalMatchedPairs: pairList.filter(p => p.geometrySource === 'luzern' && p.pathIndex !== null).length,
      admittedTripsUsingSupplement: ps.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometrySource === 'luzern')).reduce((n, p) => n + p.trips, 0),
      repairedDirectedPairs: pairList.filter(p => p.geometryRepairIds?.length).length,
      admittedTripsUsingRepair: ps.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometryRepairIds?.length)).reduce((n, p) => n + p.trips, 0),
      groups, routes: counts, exclusionReasons: Object.fromEntries(reasons), directedPatterns: ps, directedStopPairs: pairList.map(({ pathIndex, ...p }) => ({ ...p, matched: pathIndex !== null })),
      artifacts: { directory: destination, manifestGzipBytes: gz(manifest), morningGzipBytes: gz(morning), chunks: chunks.map(({ descriptor, payload }) => ({ id: descriptor.id, gzipBytes: gz(payload), trips: descriptor.tripCount })) } })
  }
  const inventory = [...routes.values()].map(r => ({ ...r, supplementSourceFeatures: supplement.graphs.get(keyForRoute(r))?.sourceFeatures ?? [], sourceFeatures: graphs.get(keyForRoute(r))?.sourceFeatures ?? [], days: days.map(day => {
    const c = day.routes.find(c => c.routeId === r.routeId), patterns = day.directedPatterns.filter(p => p.routeId === r.routeId)
    return { date: day.date, trips: c?.trips ?? 0, admittedTrips: c?.admittedTrips ?? 0, status: !c ? 'inactive-on-civil-day' : c.admittedTrips === c.trips ? 'admitted' : c.admittedTrips ? 'partially-admitted' : 'excluded', reasons: [...new Set(patterns.flatMap(p => p.reasons))] }
  }) }))
  for (const municipality of municipalityReview) {
    const stopIds = new Set(municipality.cantonStopIds)
    municipality.annualRouteIds = inventory.filter(r => r.annualCantonStopIds.some(id => stopIds.has(id))).map(r => r.routeId)
    municipality.days = days.map(day => {
      const patterns = day.directedPatterns.filter(p => p.stopIds.some(id => stopIds.has(id)))
      return { date: day.date, routes: new Set(patterns.map(p => p.routeId)).size,
        trips: patterns.reduce((n, p) => n + p.trips, 0), admittedTrips: patterns.filter(p => p.admitted).reduce((n, p) => n + p.trips, 0) }
    })
  }
  for (const source of sourceInventory) {
    source.geometryRepairIds = policy.geometryRepairs?.repairs.filter(r => r.targetFeature === source.key).map(r => r.id) ?? []
    source.repairDonorFor = policy.geometryRepairs?.repairs.filter(r => r.sourceFeatures.includes(source.key)).map(r => r.id) ?? []
    source.gtfsRoutes = inventory.filter(r => r.line === source.line && source.agencyIds?.includes(r.agencyId) && r.sourceFeatures.includes(source.key)).map(r => r.routeId)
    source.admittedTrips = days.reduce((n, d) => n + d.routes.filter(r => source.gtfsRoutes.includes(r.routeId)).reduce((n, r) => n + r.admittedTrips, 0), 0)
    source.status = !source.agencyIds ? 'unmapped-historic-line' : !source.gtfsRoutes.length ? 'no-annual-Zug-calling-route' : source.admittedTrips ? 'used-for-admitted-patterns' : 'no-admitted-fixture-pattern'
  }
  const supplementInventory = supplement.inventory.map(entry => {
    const matchingRoutes = inventory.filter(r => r.agencyId === entry.agencyId && r.mode === 'bus' && r.line === entry.line).map(r => r.routeId)
    return { ...entry, routeIds: matchingRoutes, days: days.map(day => {
      const pairs = day.directedStopPairs.map(zugOfficialAttempt).filter(p => p.geometrySource === 'luzern' && p.sourceFeatures?.includes(entry.key))
      const used = new Set(pairs.filter(p => p.matched).map(p => p.key))
      return { date: day.date, attemptedPairs: pairs.length, matchedPairs: used.size,
        matchedOccurrences: pairs.filter(p => p.matched).reduce((n, p) => n + p.occurrences, 0),
        admittedTrips: day.directedPatterns.filter(p => p.admitted && p.pairKeys.some(k => used.has(k))).reduce((n, p) => n + p.trips, 0),
        failures: pairs.filter(p => !p.matched).map(p => ({ fromId: p.fromId, toId: p.toId, reason: p.reason })) }
    }) }
  })
  const report = { schemaVersion: 1, feed: raw.feed, sourceHashes, scope: raw.scope, policy, annualRouteRecords: inventory.length, annualAgencies: new Set(inventory.map(r => r.agencyId)).size,
    catalogue, sourceInventory, osmBoatSource: osmBoats.source, osmBoatInventory: osmBoats.inventory, osmBoatRelations: osmBoats.relations, osmBoatPatterns: osmBoats.patterns, osmBoatPairs: osmBoats.pairs, shippingTopography: osmBoats.topography, comoRailSource: comoRail.source, comoRailInventory: comoRail.inventory, comoRailPairs: comoRail.pairs, comoRailTiming: comoRail.timing, comoComparisonInventory: comoRail.comparisonInventory, boatReview, grienbachReview, grienbachAtlasReview, grienbachDirectionReview, roadContextSource: roadContexts.source, roadContextInventory: roadContexts.inventory, roadContextStationWays: roadContexts.stationWays, serviceRoadSource: serviceRoads.source, serviceRoadInventory: serviceRoads.inventory, serviceRoadReview: serviceRoads.review, boatSource: boats.source, boatInventory: boats.inventory, railSupplementSource: railSupplement.source, railSupplementInventory: railSupplement.inventory, roadSource: roads.source, roadInventory: roads.inventory, roadExpansionSource: roadExpansion.source, roadExpansionInventory: roadExpansion.inventory, mountainSource: mountain.source, mountainInventory: mountain.inventory, supplementSource: supplement.source, supplementInventory, railSource: rail.source, railSourceInventory: rail.sourceInventory, municipalityReview, inventory, days,
    validation: { passed: true, annualPinnedTimetableInventoryComplete: true, admittedGeometryComplete: true, cantonMotionCoverageComplete: false, publicationReady: false,
      meaning: 'All admitted complete directed patterns pass numerical and artifact checks. Coverage denominators include excluded modes/patterns. This does not certify road direction or establish year-round geometry coverage.',
      pending: ['Resolve every excluded route/pattern before claiming complete cantonal motion coverage', 'Review street directions, loops, rail branches and temporary diversions before presenting paths as direction-certified', 'Validate seasonal and holiday dates', 'Integrate UI selection and refresh separately if requested'] } }
  await save(auditPath, report, true)
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [timetablePath, sourceDirectory = 'data/zug-sources', output = 'public/data/zug-region', auditPath = 'data/zug-study-audit.json'] = process.argv.slice(2)
  assert(timetablePath, 'Usage: node scripts/build-zug-region.mjs TIMETABLE [SOURCES OUTPUT AUDIT]')
  const r = await buildZugRegion({ timetablePath, sourceDirectory, output, auditPath, policyPath: 'data/zug-policy.json' })
  console.log(JSON.stringify({ routes: r.annualRouteRecords, agencies: r.annualAgencies, days: r.days.map(({ directedPatterns: _patterns, directedStopPairs: _pairs, routes: _routes, ...d }) => d) }, null, 2))
}
