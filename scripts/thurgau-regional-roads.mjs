import assert from 'node:assert/strict'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export const THURGAU_REGIONAL_BUS_AGENCIES = ['138', '744', '801', '896']

// Supplements are complete, route-specific patterns. Retain complete official
// patterns; never fill an incomplete pattern using another pattern's stop pair.
export function applyThurgauRegionalRoads(raw, result, bundle, routes) {
  if (!bundle) return result
  const patterns = new Map(result.patterns.map(p => [p.id, p]))
  const indexes = new Map(result.paths.map((p, i) => [JSON.stringify(p), i]))
  const seen = new Set()
  for (const train of result.trains) {
    if (routes.get(train.routeId).type === 715) {
      if (train.admission !== 'demand-responsive-night-taxi') train.admission = 'demand-responsive-route-type'
      continue
    }
    if (!THURGAU_REGIONAL_BUS_AGENCIES.includes(train.agencyId) || train.category !== 'bus' || train.reservationRequired) continue
    const pattern = patterns.get(train.patternId)
    if (pattern.matchedSegments === pattern.segmentCount && pattern.geometrySource !== 'osm-regional-road') continue
    const cache = bundle.caches[train.agencyId], key = roadPatternId(train, raw.stops)
    const segments = cache?.patterns[key]
    assert(segments && segments.length === train.stops.length - 1, 'Changed/missing regional road pattern: rebuild the pinned supplement')
    assert(segments.every(i => i === null || Number.isInteger(i) && i >= 0 && cache.paths[i]?.length >= 2), 'Invalid regional road path reference')
    if (!seen.has(pattern.id)) {
      seen.add(pattern.id)
      pattern.roadPatternId = key
      const issues = cache.report.issues.filter(i => i.pattern === key)
      pattern.roadSupplement = { status: segments.includes(null) ? 'rejected-incomplete-pattern' : 'admitted', issues }
      if (!segments.includes(null)) {
        pattern.officialMatchedSegments = pattern.matchedSegments
        pattern.geometrySource = 'osm-regional-road'
        pattern.pathSegments = segments.map((index, i) => {
          const from = raw.stops[train.stops[i][0]], to = raw.stops[train.stops[i + 1][0]]
          const path = structuredClone(cache.paths[index])
          assert(distanceMetres(path[0], from) < 0.15 && distanceMetres(path.at(-1), to) < 0.15, 'Changed regional platforms')
          path[0] = from.slice(0, 2); path[path.length - 1] = to.slice(0, 2)
          const signature = JSON.stringify(path)
          if (!indexes.has(signature)) { indexes.set(signature, result.paths.length); result.paths.push(path) }
          return indexes.get(signature)
        })
        pattern.matchedSegments = pattern.segmentCount
      }
    }
    if (pattern.geometrySource === 'osm-regional-road') {
      train.pathSegments = pattern.pathSegments; train.admission = 'admitted'; train.geometrySource = pattern.geometrySource
    }
  }
  // Pair coverage means a path exists in at least one full-pattern context.
  // Occurrence coverage is counted from each pattern, never from this union.
  const pairs = new Map(result.pairs.map(p => [JSON.stringify([p.routeId, p.fromId, p.toId]), p]))
  for (const p of result.patterns) { p.admittedTrips = 0; p.decisions = {} }
  for (const p of result.pairs) p.admittedOccurrences = 0
  const variants = new Map(), sources = new Map()
  for (const pattern of result.patterns) for (let i = 0; i < pattern.pathSegments.length; i++) {
    const key = JSON.stringify([pattern.routeId, pattern.stopIds[i], pattern.stopIds[i + 1]])
    const index = pattern.pathSegments[i]
    if (index === null) continue
    const set = variants.get(key) ?? new Set(); set.add(index); variants.set(key, set)
    const tags = sources.get(key) ?? new Set(); tags.add(pattern.geometrySource ?? 'cantonal-line'); sources.set(key, tags)
  }
  for (const [key, set] of variants) {
    const pair = pairs.get(key)
    if (pair.reason) { pair.officialFailure = { reason: pair.reason }; delete pair.reason }
    pair.pathIndex = [...set][0]; pair.pathVariantCount = set.size
    pair.geometrySources = [...sources.get(key)].sort()
  }
  for (const train of result.trains) {
    const pattern = patterns.get(train.patternId), admitted = train.admission === 'admitted'
    train.pathSegments = pattern.pathSegments
    pattern.admittedTrips += Number(admitted)
    pattern.decisions[train.admission] = (pattern.decisions[train.admission] ?? 0) + 1
    for (let i = 1; i < train.stops.length; i++) {
      pairs.get(JSON.stringify([train.routeId, raw.stops[train.stops[i - 1][0]][4], raw.stops[train.stops[i][0]][4]])).admittedOccurrences += Number(admitted)
    }
  }
  return result
}
