import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export function completeAccessPattern(original, patternId, route, train, stops, cache, review) {
  if (original.every(p => p.path)) return original
  const identity = review.routes.find(r => r.routeId === route.routeId)
  if (!identity) return original
  assert.equal(identity.agencyId, route.agencyId); assert.equal(identity.line, route.line)
  if (!review.admittedPatternIds.includes(patternId)) return original
  const segments = cache.patterns[patternId]
  assert(segments?.length === train.calls.length - 1 && segments.every(i => i !== null), 'Incomplete reviewed access-road pattern')
  return segments.map((index, i) => {
    const path = structuredClone(cache.paths[index]), a = stops.get(train.calls[i].id), b = stops.get(train.calls[i + 1].id)
    const from = [Number(a.stop_lon), Number(a.stop_lat)], to = [Number(b.stop_lon), Number(b.stop_lat)]
    assert(distanceMetres(path[0], from) < .15 && distanceMetres(path.at(-1), to) < .15, 'Changed access-road pattern endpoints')
    path[0] = from; path[path.length - 1] = to
    return { path, geometrySource: 'osm-access-road-inference', roadPatternId: patternId, roadSegmentIndex: i, primaryFailure: original[i].reason ?? null }
  })
}

export async function loadGraubuendenAccessRoads(policy, raw) {
  if (!policy.roadAccessReview) return null
  const dir = 'data/graubuenden-access-roads', sourceBytes = await readFile(`${dir}/sources.json`), reviewBytes = await readFile(`${dir}/policy.json`)
  assert.equal(sha256(sourceBytes), policy.roadAccessReview.sourceSha256); assert.equal(sha256(reviewBytes), policy.roadAccessReview.policySha256)
  const source = JSON.parse(sourceBytes), review = JSON.parse(reviewBytes), selectionBytes = await readFile(`${dir}/selection.json`), selection = JSON.parse(selectionBytes)
  assert.equal(sha256(selectionBytes), source.selectionSha256)
  assert.equal(selection.timetableSha256, policy.timetableSha256); assert.deepEqual(selection.serviceDates, raw.dates)
  assert.deepEqual(review.routes, selection.routes)
  for (const r of selection.routes) {
    const actual = raw.inventory.find(t => t.routeId === r.routeId)
    assert(actual?.mode === 'bus'); assert.equal(actual.agencyId, r.agencyId); assert.equal(actual.line, r.line)
  }
  assert.equal(new Set(review.admittedPatternIds).size, review.admittedPatternIds.length)
  const cacheBytes = await readFile(`${dir}/cache.json.gz`); assert.equal(sha256(cacheBytes), source.cacheSha256)
  const cache = JSON.parse(gunzipSync(cacheBytes))
  assert.equal(sha256(await readFile(`${dir}/graph-source.json`)), source.graphSourceSha256)
  assert.equal(sha256(gunzipSync(await readFile(`${dir}/network.osm.gz`))), source.graph.osmSha256)
  assert.equal(sha256(await readFile(`${dir}/routing.cfg`)), cache.metadata.matcher.configSha256)
  assert.equal(cache.metadata.sourceSha256, source.graph.osmSha256)
  assert.equal(cache.metadata.matcher.binarySha256, source.graph.binarySha256)
  for (const [file, hash] of Object.entries(source.files)) assert.equal(sha256(gunzipSync(await readFile(`${dir}/${file}.gz`))), hash)
  for (const [file, hash] of Object.entries(source.graphFiles)) assert.equal(sha256(await readFile(`${dir}/${file}`)), hash)
  const patterns = JSON.parse(gunzipSync(await readFile(`${dir}/patterns.json.gz`)))
  assert.deepEqual(Object.keys(cache.patterns).sort(), patterns.patterns.map(p => p.id).sort())
  for (const id of review.admittedPatternIds) assert(cache.patterns[id]?.every(i => i !== null), 'Unmatched access-road review')
  return { source, review, cache, match: (original, id, route, train, stops) => completeAccessPattern(original, id, route, train, stops, cache, review) }
}
