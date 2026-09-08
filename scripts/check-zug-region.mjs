import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sha256 } from './download-luzern-sources.mjs'
import { validateZugSnapshot } from './build-zug-region.mjs'
import { reviewedZugJoins, zugGraphs, directedPatternKey, zugRouteKey } from './zug-line-geometry.mjs'
import { gunzipSync } from 'node:zlib'
import { loadZugBusSupplement, matchZugBusPair } from './zug-bus-supplement.mjs'
import { loadZugRoads, mergeZugRoadCandidates, matchZugRoadPair, zugOfficialAttempt } from './zug-road-geometry.mjs'
import { loadZugMountain } from './zug-mountain-geometry.mjs'
import { loadZugBoats } from './zug-boat-geometry.mjs'
import { loadZugOsmBoats } from './zug-osm-boats.mjs'
import { reviewZugBoats } from './review-zug-boats.mjs'
import { reviewZugGrienbach } from './review-zug-grienbach.mjs'
import { reviewZugGrienbachAtlas } from './review-zug-grienbach-atlas.mjs'
import { loadZugRoadContexts, matchZugRoadContext } from './zug-road-contexts.mjs'
import { loadZugServiceRoads, matchZugServiceRoadPair } from './zug-service-road-geometry.mjs'
import { loadZugComoRail, matchZugRailWithComo } from './zug-como-rail.mjs'
import { loadZugSbbRailSupplement } from './zug-sbb-rail-supplement.mjs'
import { loadZugRail } from './zug-rail-geometry.mjs'
import { inCanton } from './zug-timetable.mjs'
import { assertGeometryMeasurementsEqual } from './compare-geometry-measurements.mjs'

const json = async path => { const bytes = await readFile(path); return JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes) : bytes.toString()) }
const sum = (items, key) => items.reduce((n, item) => n + item[key], 0)

export async function checkZugRegion({ auditPath = 'data/zug-study-audit.json', sourceDirectory = 'data/zug-sources', timetablePath = 'data/zug-timetable.json.gz' } = {}) {
  const audit = await json(auditPath), catalogue = await json(join(sourceDirectory, 'sources.json'))
  assert.equal(sha256(await readFile(join(sourceDirectory, 'sources.json'))), audit.sourceHashes.catalogue)
  assert.equal(sha256(await readFile('data/zug-policy.json')), audit.sourceHashes.policy)
  for (const source of catalogue.sources) assert.equal(sha256(await readFile(join(sourceDirectory, source.file))), source.sha256, `Source hash: ${source.file}`)
  assert.equal(new Set(audit.sourceInventory.map(s => s.key)).size, 175)
  assert.equal(audit.municipalityReview.length, 11)
  assert.equal(new Set(audit.inventory.map(r => r.routeId)).size, audit.annualRouteRecords)
  assert.equal(new Set(audit.inventory.map(r => r.agencyId)).size, audit.annualAgencies)
  assert.equal(sum(audit.inventory, 'annualTripRecords'), audit.scope.annualScopedTripRecords)
  const sourceKeys = new Set(audit.sourceInventory.map(s => s.key))
  const collection = await json(join(sourceDirectory, 'bus.geojson'))
  const repairs = reviewedZugJoins(collection, audit.policy)
  const { graphs } = zugGraphs(collection, audit.policy)
  const supplement = await loadZugBusSupplement(audit.policy.busSupplement)
  assert.deepEqual(supplement.source, audit.supplementSource)
  assert.equal(audit.sourceHashes.busSupplement, audit.policy.busSupplement.sourceSha256)
  assert.equal(audit.supplementInventory.length, supplement.inventory.length)
  for (const source of supplement.inventory) {
    const entry = audit.supplementInventory.find(s => s.key === source.key); assert(entry)
    for (const [key, value] of Object.entries(source)) assert.deepEqual(entry[key], value)
    assert.deepEqual(entry.routeIds, audit.inventory.filter(r => r.agencyId === source.agencyId && r.mode === 'bus' && r.line === source.line).map(r => r.routeId))
    for (const d of entry.days) {
      const day = audit.days.find(day => day.date === d.date)
      const pairs = day.directedStopPairs.map(zugOfficialAttempt).filter(p => p.geometrySource === 'luzern' && p.sourceFeatures.includes(source.key)), matched = pairs.filter(p => p.matched)
      assert.equal(d.attemptedPairs, pairs.length); assert.equal(d.matchedPairs, matched.length)
      assert.equal(d.matchedOccurrences, sum(matched, 'occurrences'))
      const keys = new Set(matched.map(p => p.key))
      assert.equal(d.admittedTrips, sum(day.directedPatterns.filter(p => p.admitted && p.pairKeys.some(key => keys.has(key))), 'trips'))
      assert.deepEqual(d.failures, pairs.filter(p => !p.matched).map(p => ({ fromId: p.fromId, toId: p.toId, reason: p.reason })))
    }
  }
  const rail = await loadZugRail(audit.policy.rail, audit.policy.dates)
  assert.equal(audit.sourceHashes.rail, audit.policy.rail.sourceSha256)
  assert.deepEqual(audit.railSource, rail.source)
  assertGeometryMeasurementsEqual(audit.railSourceInventory, rail.sourceInventory)
  const railSupplement = await loadZugSbbRailSupplement(audit.policy.railSupplement)
  assert.equal(audit.sourceHashes.railSupplement, audit.policy.railSupplement.sourceSha256)
  assert.deepEqual(audit.railSupplementSource, railSupplement.source)
  assertGeometryMeasurementsEqual(audit.railSupplementInventory, railSupplement.inventory)
  const boats = await loadZugBoats(audit.policy.boat)
  assert.equal(audit.sourceHashes.boat, audit.policy.boat.sourceSha256)
  assert.deepEqual(audit.boatSource, boats.source)
  assert.deepEqual(audit.boatInventory, boats.inventory)
  const mountain = await loadZugMountain(audit.policy.mountain)
  assert.equal(audit.sourceHashes.mountain, audit.policy.mountain.sourceSha256)
  assert.deepEqual(audit.mountainSource, mountain.source)
  assertGeometryMeasurementsEqual(audit.mountainInventory, mountain.inventory)
  const repairIds = new Set(repairs.map(r => r.id))
  for (const route of audit.inventory) for (const key of route.sourceFeatures) assert(sourceKeys.has(key))
  let raw
  if (timetablePath) {
    assert.equal(sha256(await readFile(timetablePath)), audit.sourceHashes.timetable); raw = await json(timetablePath)
    assert.equal(raw.inventory.length, audit.annualRouteRecords)
    for (const r of raw.inventory) {
      const result = audit.inventory.find(item => item.routeId === r.routeId); assert(result)
      for (const key of ['agencyId', 'line', 'routeType', 'annualTripRecords', 'activeSourceTripRecords', 'annualCantonStopIds']) assert.deepEqual(result[key], r[key])
    }
  }
  const roads = await loadZugRoads(audit.policy.road, raw, audit.sourceHashes.timetable)
  assert.equal(audit.sourceHashes.road, audit.policy.road.cacheSha256)
  assert.deepEqual(audit.roadSource, roads.source)
  assert.deepEqual(audit.roadInventory, roads.inventory)
  const roadExpansion = await loadZugRoads(audit.policy.roadExpansion, raw, audit.sourceHashes.timetable)
  assert.equal(audit.sourceHashes.roadExpansion, audit.policy.roadExpansion.cacheSha256)
  assert.deepEqual(audit.roadExpansionSource, roadExpansion.source)
  assert.deepEqual(audit.roadExpansionInventory, roadExpansion.inventory)
  roads.candidates = mergeZugRoadCandidates(roads, roadExpansion)
  const serviceRoads = await loadZugServiceRoads(audit.policy.roadServiceAccess, audit.policy.roadExpansion, raw, audit.sourceHashes.timetable)
  assert.equal(audit.sourceHashes.roadServiceAccess, audit.policy.roadServiceAccess.sourceSha256)
  assert.deepEqual(audit.serviceRoadSource, serviceRoads.source)
  assert.deepEqual(audit.serviceRoadInventory, serviceRoads.inventory)
  assert.deepEqual(audit.serviceRoadReview, serviceRoads.review)
  const roadContexts = await loadZugRoadContexts(audit.policy.roadContexts, audit.policy.roadExpansion, raw)
  assert.equal(audit.sourceHashes.roadContexts, audit.policy.roadContexts.sourceSha256)
  assert.deepEqual(audit.roadContextSource, roadContexts.source)
  assert.deepEqual(audit.roadContextInventory, roadContexts.inventory)
  assert.deepEqual(audit.roadContextStationWays, roadContexts.stationWays)
  const comoRail = await loadZugComoRail(audit.policy.railComo, raw, audit.sourceHashes.timetable)
  assert.equal(audit.sourceHashes.railComo, audit.policy.railComo.sourceSha256)
  assert.deepEqual(audit.comoRailSource, comoRail.source)
  assert.deepEqual(audit.comoRailInventory, comoRail.inventory)
  assert.deepEqual(audit.comoRailPairs, comoRail.pairs)
  assert.deepEqual(audit.comoRailTiming, comoRail.timing)
  assert.deepEqual(audit.comoComparisonInventory, comoRail.comparisonInventory)
  const osmBoats = await loadZugOsmBoats(audit.policy.boatOsm, audit.policy.boat, raw, audit.sourceHashes.timetable)
  assert.equal(audit.sourceHashes.boatOsm, audit.policy.boatOsm.sourceSha256)
  assert.deepEqual(audit.osmBoatSource, osmBoats.source)
  assert.deepEqual(audit.osmBoatInventory, osmBoats.inventory)
  assert.deepEqual(audit.osmBoatRelations, osmBoats.relations)
  assert.deepEqual(audit.osmBoatPatterns, osmBoats.patterns)
  assert.deepEqual(audit.osmBoatPairs, osmBoats.pairs)
  assert.deepEqual(audit.shippingTopography, osmBoats.topography)
  const boatReview = await reviewZugBoats(audit.policy.boatReview, audit.policy.boat, raw, audit.sourceHashes.timetable)
  assert.equal(audit.sourceHashes.boatReview, audit.policy.boatReview.sourceSha256)
  assert.deepEqual(audit.boatReview, boatReview)
  const grienbachReview = await reviewZugGrienbach(audit.policy.grienbachReview, audit.policy.roadExpansion, raw, audit.sourceHashes.timetable)
  assert.equal(audit.sourceHashes.grienbachReview, audit.policy.grienbachReview.sourceSha256)
  assert.deepEqual(audit.grienbachReview, grienbachReview)
  const grienbachAtlasReview = await reviewZugGrienbachAtlas(audit.policy.grienbachAtlasReview, audit.policy.grienbachReview, raw, audit.sourceHashes.timetable)
  assert.equal(audit.sourceHashes.grienbachAtlasReview, audit.policy.grienbachAtlasReview.sourceSha256)
  assert.deepEqual(audit.grienbachAtlasReview, grienbachAtlasReview)
  const municipalities = (await json(join(sourceDirectory, 'municipalities.geojson'))).features
  const assignedStops = new Set()
  for (const m of audit.municipalityReview) {
    const polygon = municipalities.find(f => f.properties.bfs_nummer === m.bfs); assert(polygon)
    const ids = raw.cantonStops.filter(s => inCanton([Number(s.stop_lon), Number(s.stop_lat)], polygon.geometry)).map(s => s.stop_id)
    assert.deepEqual(m.cantonStopIds, ids)
    for (const id of ids) assignedStops.add(id)
    const stops = new Set(ids)
    assert.deepEqual(m.annualRouteIds, raw.inventory.filter(r => r.annualCantonStopIds.some(id => stops.has(id))).map(r => r.routeId))
    for (const d of m.days) {
      const trains = raw.snapshots.find(day => day.date === d.date).trains.filter(t => t.calls.some(c => stops.has(c.id)))
      const admitted = new Set(audit.days.find(day => day.date === d.date).directedPatterns.filter(p => p.admitted).map(p => p.id))
      assert.equal(d.trips, trains.length)
      assert.equal(d.routes, new Set(trains.map(t => t.routeId)).size)
      assert.equal(d.admittedTrips, trains.filter(t => admitted.has(sha256(directedPatternKey(t)).slice(0, 20))).length)
    }
  }
  assert.equal(assignedStops.size, raw.cantonStops.length, 'Canton stop without municipal review')
  const summaries = []
  for (const day of audit.days) {
    const manifest = await json(join(day.artifacts.directory, 'zug-region-day-manifest.json')), trains = new Map()
    assert.equal(manifest.metadata.serviceDate, day.date)
    assert.equal(manifest.tripCount, day.admittedTrips)
    for (const chunk of manifest.chunks) {
      const bytes = await readFile(join(day.artifacts.directory, chunk.path))
      assert.equal(bytes.length, chunk.bytes, `Chunk length ${chunk.path}`)
      assert.equal(sha256(bytes), chunk.sha256, `Chunk hash ${chunk.path}`)
      const payload = JSON.parse(bytes)
      assert.equal(payload.trains.length, chunk.tripCount)
      assert.equal(payload.windowStart, chunk.windowStart); assert.equal(payload.windowEnd, chunk.windowEnd)
      for (const t of payload.trains) {
        assert(t.start <= chunk.windowEnd && t.end >= chunk.windowStart)
        if (trains.has(t.id)) assert.deepEqual(trains.get(t.id), t, 'Inconsistent duplicated journey across chunks')
        trains.set(t.id, t)
      }
    }
    assert.equal(trains.size, day.admittedTrips)
    const snapshot = { ...manifest, trains: [...trains.values()] }
    validateZugSnapshot(snapshot)
    assert.deepEqual(manifest.metadata.sourceHashes, audit.sourceHashes)
    const morning = await json(join(day.artifacts.directory, 'zug-region-morning.json'))
    assert.deepEqual(morning.trains.map(t => t.id).sort(), [...trains.values()].filter(t => t.start <= 31500 && t.end >= 24300).map(t => t.id).sort())
    const contextKeys = new Set(day.directedStopPairs.filter(p => p.geometrySource === 'osm-road-pattern-inference' && p.matched).map(p => p.key))
    assert.equal(day.admittedTripsUsingRoadContexts, sum(day.directedPatterns.filter(p => p.admitted && p.pairKeys.some(k => contextKeys.has(k))), 'trips'))
    assert.deepEqual(manifest.metadata.geometry.roadContexts, { source: roadContexts.source, policy: audit.policy.roadContexts })
    assert(manifest.metadata.attribution.includes(roadContexts.source.attribution))
    const serviceKeys = new Set(day.directedStopPairs.filter(p => p.geometrySource === 'osm-service-road-inference' && p.matched).map(p => p.key))
    assert.equal(day.admittedTripsUsingServiceRoads, sum(day.directedPatterns.filter(p => p.admitted && p.pairKeys.some(k => serviceKeys.has(k))), 'trips'))
    assert.deepEqual(manifest.metadata.geometry.roadServiceAccess, { source: serviceRoads.source, policy: audit.policy.roadServiceAccess })
    assert(manifest.metadata.attribution.includes(serviceRoads.source.attribution))
    assert.deepEqual(manifest.metadata.geometry.railComo, { source: comoRail.source, policy: audit.policy.railComo })
    assert(manifest.metadata.attribution.includes(comoRail.source.attribution))
    assert.deepEqual(manifest.metadata.geometry.boatOsm, { source: osmBoats.source, policy: audit.policy.boatOsm })
    assert(manifest.metadata.attribution.includes(osmBoats.source.attribution))
    assert.deepEqual(manifest.metadata.geometry.boat, { source: boats.source, policy: audit.policy.boat })
    assert(manifest.metadata.attribution.includes(boats.source.attribution))
    const railSupplementKeys = new Set(day.directedStopPairs.filter(p => p.geometrySource === 'sbb-rail-inference' && p.matched).map(p => p.key))
    assert.equal(day.admittedTripsUsingRailSupplement, sum(day.directedPatterns.filter(p => p.admitted && p.pairKeys.some(k => railSupplementKeys.has(k))), 'trips'))
    assert.deepEqual(manifest.metadata.geometry.railSupplement.source, railSupplement.source)
    assert(manifest.metadata.attribution.includes(railSupplement.source.attribution))
    const roadPairs = day.directedStopPairs.filter(p => p.geometrySource === 'osm-road-inference' && p.matched), roadKeys = new Set(roadPairs.map(p => p.key))
    const expansionRoutes = new Set(audit.policy.roadExpansion.routes.map(r => r.routeId))
    assert.equal(day.admittedTripsUsingRoadExpansion, sum(day.directedPatterns.filter(p => p.admitted && expansionRoutes.has(p.routeId) && p.pairKeys.some(k => roadKeys.has(k))), 'trips'))
    assert.equal(day.roadMatchedPairs, roadPairs.length)
    assert.equal(day.admittedTripsUsingRoads, sum(day.directedPatterns.filter(p => p.admitted && p.pairKeys.some(k => roadKeys.has(k))), 'trips'))
    assert.deepEqual(manifest.metadata.geometry.road.source, roads.source)
    assert.deepEqual(manifest.metadata.geometry.roadExpansion.source, roadExpansion.source)
    assert(manifest.metadata.attribution.includes(roads.source.attribution))
    assert.equal(day.supplementalMatchedPairs, day.directedStopPairs.filter(p => p.geometrySource === 'luzern' && p.matched).length)
    const supplementKeys = new Set(day.directedStopPairs.filter(p => p.geometrySource === 'luzern' && p.matched).map(p => p.key))
    assert.equal(day.admittedTripsUsingSupplement, sum(day.directedPatterns.filter(p => p.admitted && p.pairKeys.some(k => supplementKeys.has(k))), 'trips'))
    const patterns = new Map(day.directedPatterns.map(p => [p.id, p])), pairs = new Map(day.directedStopPairs.map(p => [p.key, p]))
    assert.equal(day.directedStopPairs.filter(p => p.geometryRepairIds?.length).length, day.repairedDirectedPairs)
    assert.equal(sum(day.directedPatterns.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometryRepairIds?.length)), 'trips'), day.admittedTripsUsingRepair)
    for (const p of pairs.values()) for (const id of p.geometryRepairIds ?? []) assert(repairIds.has(id), 'Unknown geometry repair')
    assert.equal(patterns.size, day.patterns); assert.equal(pairs.size, day.directedPairs)
    assert.equal(sum(day.directedPatterns, 'trips'), day.trips)
    assert.equal(sum(day.directedPatterns.filter(p => p.admitted), 'trips'), day.admittedTrips)
    assert.equal(day.excludedTrips + day.admittedTrips, day.trips)
    assert.equal(day.directedPatterns.filter(p => p.admitted).length, day.admittedPatterns)
    assert.equal(sum(day.directedStopPairs, 'occurrences'), day.segmentOccurrences)
    assert.equal(sum(day.directedStopPairs.filter(p => p.matched), 'occurrences'), day.matchedSegmentOccurrences)
    assert.equal(sum(day.directedStopPairs, 'scheduledOccurrences'), day.scheduledSegmentOccurrences)
    assert.equal(sum(day.directedStopPairs, 'representativeHeadwayOccurrences'), day.representativeHeadwaySegmentOccurrences)
    assert.equal(day.scheduledSegmentOccurrences + day.representativeHeadwaySegmentOccurrences, day.segmentOccurrences)
    assert.equal(day.directedStopPairs.filter(p => p.matched).length, day.matchedDirectedPairs)
    const unique = new Map()
    for (const p of day.directedStopPairs) {
      const key = JSON.stringify([p.routeId, p.fromId, p.toId]), values = unique.get(key) ?? []
      values.push(p); unique.set(key, values)
    }
    assert.equal(unique.size, day.uniqueDirectedRouteStopPairs)
    assert.equal([...unique.values()].filter(values => values.every(p => p.matched)).length, day.fullyMatchedUniqueDirectedRouteStopPairs)
    for (const field of ['trips', 'admittedTrips', 'patterns', 'admittedPatterns', 'directedPairs', 'matchedDirectedPairs', 'segmentOccurrences', 'matchedSegmentOccurrences']) assert.equal(sum(day.groups, field), day[field], `Group ${field}`)
    for (const group of day.groups) {
      const failures = day.directedStopPairs.filter(p => `${p.agencyId}:${p.mode}` === group.id && !p.matched)
      assert.equal(sum(group.failures, 'directedPairs'), failures.length)
      assert.equal(sum(group.failures, 'scheduledSegmentOccurrences'), sum(failures, 'scheduledOccurrences'))
    }
    assert.equal(new Set(day.routes.map(r => r.routeId)).size, day.routes.length)
    for (const route of day.routes) {
      const pp = day.directedPatterns.filter(p => p.routeId === route.routeId), sp = day.directedStopPairs.filter(p => p.routeId === route.routeId)
      assert.equal(sum(pp, 'trips'), route.trips)
      assert.equal(sum(pp.filter(p => p.admitted), 'trips'), route.admittedTrips)
      assert.equal(sum(sp, 'occurrences'), route.segmentOccurrences)
      assert.equal(sum(sp.filter(p => p.matched), 'occurrences'), route.matchedSegmentOccurrences)
    }
    for (const route of audit.inventory) {
      const count = day.routes.find(r => r.routeId === route.routeId), entry = route.days.find(d => d.date === day.date); assert(entry)
      assert.equal(entry.trips, count?.trips ?? 0); assert.equal(entry.admittedTrips, count?.admittedTrips ?? 0)
      const status = !count ? 'inactive-on-civil-day' : count.admittedTrips === count.trips ? 'admitted' : count.admittedTrips ? 'partially-admitted' : 'excluded'
      assert.equal(entry.status, status)
      assert.deepEqual([...entry.reasons].sort(), [...new Set(day.directedPatterns.filter(p => p.routeId === route.routeId).flatMap(p => p.reasons))].sort())
    }
    // Replay ALL source instances, including excluded patterns, so the audit
    // cannot improve its denominator by dropping inconvenient trips or calls.
    const sourceDay = raw.snapshots.find(d => d.date === day.date)
    assert.equal(sourceDay.trains.length, day.trips)
    const expectedPatterns = new Map()
    for (const t of sourceDay.trains) {
      const id = sha256(directedPatternKey(t)).slice(0, 20)
      expectedPatterns.set(id, (expectedPatterns.get(id) ?? 0) + 1)
      const p = patterns.get(id); assert(p, 'Missing source directed pattern')
      assert.deepEqual(p.stopIds, t.calls.map(c => c.id))
      assert.equal(p.directionId, t.directionId)
    }
    assert.equal(expectedPatterns.size, patterns.size)
    for (const p of patterns.values()) assert.equal(expectedPatterns.get(p.id), p.trips)
    // Independently route every reported pair against the preserved source.
    const sourceStops = new Map(raw.stops.map(s => [s.stop_id, s]))
    const rawRoutes = new Map(raw.inventory.map(r => [r.routeId, r]))
    for (const p of pairs.values()) {
      const r = rawRoutes.get(p.routeId), a = sourceStops.get(p.fromId), b = sourceStops.get(p.toId)
      const pattern = p.contextPatternId ? patterns.get(p.contextPatternId) : undefined
      const train = pattern ? { routeId: pattern.routeId, directionId: pattern.directionId, calls: pattern.stopIds.map((id, i) => ({ id, pickupType: pattern.callRules[i][0], dropOffType: pattern.callRules[i][1] })) } : undefined
      let result = train && r.mode === 'rail' ? matchZugRailWithComo(rail, railSupplement, comoRail, train, sourceStops, r)[p.pairIndex] : r.mode === 'boat' ? boats.matchPair(r, a, b) : r.mode === 'mountain' ? mountain.matchPair(r, a, b) : r.mode !== 'bus' ? { reason: `no-reviewed-${r.mode}-geometry` } : matchZugBusPair(graphs.get(zugRouteKey(r)), supplement.graphs.get(zugRouteKey(r)), [Number(a.stop_lon), Number(a.stop_lat)], [Number(b.stop_lon), Number(b.stop_lat)], audit.policy.limits)
      if (r.mode === 'boat') {
        if (osmBoats.pairKeys.has(JSON.stringify([r.routeId, p.fromId, p.toId]))) assert(train, 'Missing full ferry pattern context')
        result = osmBoats.matchPair(result, r, train, a, b)
      }
      if (r.mode === 'bus') {
        result = matchZugRoadPair(result, roads, r.routeId, p.fromId, p.toId)
        result = matchZugServiceRoadPair(result, serviceRoads, r.routeId, p.fromId, p.toId)
        if (roadContexts.pairKeys.has(JSON.stringify([r.routeId, p.fromId, p.toId]))) {
          assert(train, 'Missing full road pattern context')
          assert.equal(pattern.stopIds[p.pairIndex], p.fromId)
          assert.equal(pattern.stopIds[p.pairIndex + 1], p.toId)
          result = matchZugRoadContext(result, roadContexts, train, sourceStops, p.fromId, p.toId)
        }
      }
      if (result.geometrySource === 'osm-como-rail-inference') for (const [field, value] of Object.entries(result)) if (field !== 'path') assert.deepEqual(p[field], value)
      if (result.geometrySource === 'osm-road-pattern-inference') for (const [field, value] of Object.entries(result)) if (field !== 'path') assert.deepEqual(p[field], value)
      if (result.geometrySource === 'osm-service-road-inference') for (const [field, value] of Object.entries(result)) if (field !== 'path') assert.deepEqual(p[field], value)
      assertGeometryMeasurementsEqual(result.officialFailure, p.officialFailure)
      assert.deepEqual(result.roadPatternIds, p.roadPatternIds)
      assert.equal(result.roadContextOccurrences, p.roadContextOccurrences)
      assert.equal(Boolean(result.path), p.matched)
      assert.equal(result.reason, p.reason)
      assert.equal(result.geometrySource, p.geometrySource)
      assertGeometryMeasurementsEqual(result.primaryFailure, p.primaryFailure)
      if (result.geometrySource === 'sbb-rail-inference') for (const field of ['corridor', 'sourceFeatures', 'fromOperatingPoint', 'toOperatingPoint', 'stationAttachmentsMetres']) assertGeometryMeasurementsEqual(result[field], p[field], field)
      if (r.mode === 'boat') for (const [field, value] of Object.entries(result)) if (field !== 'path') assert.deepEqual(p[field], value)
      if (r.mode === 'mountain') for (const field of ['sourceFeatures', 'installation', 'operatingPointIds', 'attachmentMetres']) assertGeometryMeasurementsEqual(result[field], p[field], field)
      assert.equal(result.path ? sha256(JSON.stringify(result.path)) : null, p.geometrySha256)
    }
    const patternTrips = new Map(), pairOccurrences = new Map(), admittedOccurrences = new Map()
    for (const pattern of patterns.values()) {
      assert.equal(pattern.stopIds.length, pattern.pairKeys.length + 1)
      assert.equal(pattern.admitted, pattern.reasons.length === 0)
      assert.equal(pattern.geometryPairs, pattern.pairKeys.filter(k => pairs.get(k).matched).length)
      for (let i = 0; i < pattern.pairKeys.length; i++) {
        const key = pattern.pairKeys[i], pair = pairs.get(key); assert(pair)
        assert.equal(pair.fromId, pattern.stopIds[i]); assert.equal(pair.toId, pattern.stopIds[i + 1])
        pairOccurrences.set(key, (pairOccurrences.get(key) ?? 0) + pattern.trips)
        if (pattern.admitted) admittedOccurrences.set(key, (admittedOccurrences.get(key) ?? 0) + pattern.trips)
      }
    }
    for (const pair of pairs.values()) {
      assert.equal(pairOccurrences.get(pair.key), pair.occurrences)
      assert.equal(admittedOccurrences.get(pair.key) ?? 0, pair.admittedOccurrences)
    }
    const sourceTrains = raw ? new Map(raw.snapshots.find(d => d.date === day.date).trains.map(t => [t.id, t])) : undefined
    for (const train of trains.values()) {
      const pattern = patterns.get(train.patternId); assert(pattern?.admitted)
      patternTrips.set(pattern.id, (patternTrips.get(pattern.id) ?? 0) + 1)
      assert.deepEqual(train.stops.map(([i]) => manifest.stops[i][4]), pattern.stopIds)
      assert.deepEqual(train.callRules, pattern.callRules)
      for (let i = 0; i < train.pathSegments.length; i++) assert.equal(sha256(JSON.stringify(manifest.paths[train.pathSegments[i]])), pairs.get(pattern.pairKeys[i]).geometrySha256)
      if (sourceTrains) {
        const source = sourceTrains.get(train.id); assert(source)
        assert.equal(train.sourceServiceDate, source.sourceServiceDate)
        assert.equal(train.sourceTripId, source.sourceTripId)
        assert.deepEqual(train.frequency, source.frequency)
        assert.deepEqual(train.stops.map(([i, a, d]) => [manifest.stops[i][4], a, d]), source.calls.map(c => [c.id, c.arrival, c.departure]), 'Dropped or changed source call')
        assert.deepEqual(train.sourceCallSequences, source.calls.map(c => c.sequence))
      }
    }
    for (const p of patterns.values()) assert.equal(patternTrips.get(p.id) ?? 0, p.admitted ? p.trips : 0)
    assert.equal([...trains.values()].filter(t => t.sourceServiceDate !== day.date).length, day.admittedCarryInTrips)
    assert.equal([...trains.values()].filter(t => t.frequency?.exactTimes === 0).length, day.admittedHeadwayTrips)
    summaries.push({ date: day.date, admittedTrips: trains.size, completeDirectedPatterns: day.admittedPatterns, sourceCallReplay: Boolean(raw) })
  }
  return { passed: true, annualRoutes: audit.annualRouteRecords, agencies: audit.annualAgencies, days: summaries }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(await checkZugRegion({ timetablePath: process.argv[2] }), null, 2))
