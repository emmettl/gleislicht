import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { reviewedRoadContexts, roadContextKey, luzernRoadPatternId, roadConsensus } from './luzern-road-geometry.mjs'
import { validateZugRoadScope } from './zug-road-geometry.mjs'

export function reviewZugRoadContexts(cache, limits, source) {
  assert(Number.isFinite(source.maximumDivergenceFromStopMetres) && source.maximumDivergenceFromStopMetres > 0 && source.maximumDivergenceFromStopMetres <= 110, 'Unreviewed station approach bound')
  const candidates = reviewedRoadContexts(cache, limits, source.reviews), shared = roadConsensus(cache, limits)
  for (const review of source.reviews) assert.equal(review.terminus, cache.agencies[review.agencyId].identities[review.patternId].stops.at(-1)[4], 'Changed context terminus')
  const pairKeys = new Set(source.reviews.map(r => JSON.stringify([r.routeId, r.fromId, r.toId])))
  const inventory = []
  for (const key of pairKeys) {
    const reviews = source.reviews.filter(r => JSON.stringify([r.routeId, r.fromId, r.toId]) === key)
    assert.deepEqual(reviews.map(r => r.patternId).sort(), shared.get(key).roadPatternIds, 'Review must cover every complete input context')
    const paths = reviews.map(r => candidates.get(roadContextKey(r.routeId, r.fromId, r.toId, r.patternId)).path)
    let common = 0
    while (paths.every(p => common < p.length && JSON.stringify(p[common]) === JSON.stringify(paths[0][common]))) common++
    assert(common > 0, 'No shared road approach')
    const end = paths[0].at(-1)
    const divergenceMetres = Math.max(...paths.flatMap(p => p.slice(common - 1).map(point => distanceMetres(point, end))))
    assert(divergenceMetres <= source.maximumDivergenceFromStopMetres, 'Road variants differ outside the reviewed station approach')
    inventory.push({ pairKey: key, sharedPairAssessment: shared.get(key), commonPrefixVertices: common, maximumDivergenceMetres: divergenceMetres,
      variants: reviews.map((r, i) => ({ ...r, vertices: paths[i].length, lengthMetres: candidates.get(roadContextKey(r.routeId, r.fromId, r.toId, r.patternId)).lengthMetres })) })
  }
  return { candidates, pairKeys, inventory }
}

export async function loadZugRoadContexts(policy, roadPolicy, raw) {
  const bytes = await readFile(join(policy.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), policy.sourceSha256, 'Changed road-context catalogue')
  const source = JSON.parse(bytes)
  for (const file of source.files) assert.equal(sha256(await readFile(join(policy.sourceDirectory, file.file))), file.sha256, 'Changed road-context evidence')
  const osm = JSON.parse(gunzipSync(await readFile(join(policy.sourceDirectory, 'roads.json.gz'))))
  assert.equal(osm.osm3s.timestamp_osm_base, source.stationReviewOsmBase)
  const stationWays = source.stationWayIds.map(id => { const way = osm.elements.find(e => e.type === 'way' && e.id === id); assert(way); return { id, version: way.version, timestamp: way.timestamp, tags: way.tags } })
  const cacheBytes = await readFile(roadPolicy.cacheFile)
  assert.equal(sha256(cacheBytes), roadPolicy.cacheSha256)
  assert.equal(roadPolicy.cacheSha256, source.sourceCacheSha256)
  const cache = JSON.parse(cacheBytes)
  // The normal road loader reimports this same pinned cache's original matcher
  // evidence. This review additionally verifies the complete timetable scope.
  validateZugRoadScope(raw, cache, roadPolicy)
  assert.deepEqual(cache.metadata.source, source.matcherSource)
  return { ...reviewZugRoadContexts(cache, roadPolicy.limits, source), source, stationWays }
}

export function matchZugRoadContext(original, contexts, train, stops, fromId, toId) {
  if (original.path || original.reason !== 'road-pattern-dependent-path') return original
  const patternId = luzernRoadPatternId(train, stops)
  const result = contexts.candidates.get(roadContextKey(train.routeId, fromId, toId, patternId))
  return result ? { ...result, officialFailure: original.officialFailure } : original
}
