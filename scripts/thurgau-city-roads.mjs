import assert from 'node:assert/strict'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

// Paths remain scoped to their complete pattern. A pair's pathIndex is merely
// a representative for pair counts; each train retains its own full-pattern path.
export function applyThurgauCityRoads(raw, result, bundle) {
  if (!bundle) return result
  const byPattern = new Map(result.patterns.map(p => [p.id, p]))
  const byPair = new Map(result.pairs.map(p => [JSON.stringify([p.routeId, p.fromId, p.toId]), p]))
  const indexes = new Map(result.paths.map((p, i) => [JSON.stringify(p), i])), seen = new Set(), variants = new Map()
  for (const train of result.trains) {
    if (!['727', '797'].includes(train.agencyId)) continue
    const pattern = byPattern.get(train.patternId)
    if (train.route === 'NT') { train.admission = 'demand-responsive-night-taxi'; continue }
    if (train.reservationRequired) continue
    const cache = bundle.caches[train.agencyId], key = roadPatternId(train, raw.stops)
    const segments = cache?.patterns[key]
    assert(segments && segments.length === train.stops.length - 1 && segments.every(i => Number.isInteger(i) && cache.paths[i]), 'Changed/missing city road pattern: rebuild the pinned supplement')
    if (!seen.has(pattern.id)) {
      seen.add(pattern.id)
      assert(pattern.sourceLines.length === 0, 'City supplement must not replace admitted official-line geometry')
      pattern.roadPatternId = key; pattern.geometrySource = 'osm-city-road'
      pattern.pathSegments = segments.map((index, i) => {
        const from = raw.stops[train.stops[i][0]], to = raw.stops[train.stops[i + 1][0]], path = structuredClone(cache.paths[index])
        assert(distanceMetres(path[0], from) < 0.15 && distanceMetres(path.at(-1), to) < 0.15, 'Changed city platforms')
        // Restore original GTFS endpoint precision after six-decimal road output.
        path[0] = from.slice(0, 2); path[path.length - 1] = to.slice(0, 2)
        const signature = JSON.stringify(path)
        if (!indexes.has(signature)) { indexes.set(signature, result.paths.length); result.paths.push(path) }
        const pathIndex = indexes.get(signature), pairKey = JSON.stringify([train.routeId, from[4], to[4]])
        const pair = byPair.get(pairKey)
        delete pair.reason
        pair.geometrySource = 'osm-city-road'; pair.pathIndex = pathIndex
        pair.sourceCacheMaximumSnapMetres = cache.report.maxSnapMetres
        const paths = variants.get(pairKey) ?? new Set(); paths.add(pathIndex); variants.set(pairKey, paths)
        pair.pathVariantCount = paths.size
        return pathIndex
      })
      pattern.matchedSegments = pattern.segmentCount
    }
    train.pathSegments = pattern.pathSegments; train.admission = 'admitted'; train.geometrySource = 'osm-city-road'
  }
  // Reconcile admission counts after replacing only complete city patterns.
  for (const p of result.patterns) { p.admittedTrips = 0; p.decisions = {} }
  for (const p of result.pairs) p.admittedOccurrences = 0
  for (const train of result.trains) {
    const p = byPattern.get(train.patternId), admitted = train.admission === 'admitted'
    if (p.geometrySource === 'osm-city-road') train.pathSegments = p.pathSegments
    p.admittedTrips += Number(admitted); p.decisions[train.admission] = (p.decisions[train.admission] ?? 0) + 1
    for (let i = 1; i < train.stops.length; i++) {
      byPair.get(JSON.stringify([train.routeId, raw.stops[train.stops[i - 1][0]][4], raw.stops[train.stops[i][0]][4]])).admittedOccurrences += Number(admitted)
    }
  }
  return result
}
