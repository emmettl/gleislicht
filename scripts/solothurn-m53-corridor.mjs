import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { bernGraph, bernPatternId } from './bern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { SO_LIMITS } from './solothurn-network-geometry.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex')

export function solothurnM53Matcher(feature, policy, context, access) {
  assert.equal(hash(feature), policy.featureSha256, 'Changed M53 source feature')
  for (const [key, value] of Object.entries(policy.sourceIdentity)) assert.equal(feature.properties[key], value, 'Changed M53 line/operator identity')
  assert.deepEqual(policy.limits, SO_LIMITS.bus, 'M53 uses unchanged bus limits')
  const route = context.routes.find(r => r.id === policy.route.id)
  for (const [key, value] of Object.entries(policy.route)) assert.equal(route[key], value, 'Changed M53 GTFS identity')
  const patterns = new Map()
  for (const day of context.snapshots) for (const train of day.trains.filter(t => t.routeId === route.id)) {
    const id = bernPatternId(train, day.stops), stops = train.stops.map(([i]) => day.stops[i])
    const index = stops.findIndex((s, i) => s[4] === policy.from[4] && stops[i + 1]?.[4] === policy.to[4])
    assert(index >= 0, 'M53 context lacks reviewed pair')
    assert.deepEqual(stops[index], policy.from); assert.deepEqual(stops[index + 1], policy.to)
    patterns.set(id, { id, directionId: train.directionId, stops, reviewedPairIndex: index })
  }
  assert.deepEqual([...patterns.keys()].sort(), policy.patternIds, 'Changed complete M53 context scope')
  const key = JSON.stringify([route.id, policy.from[4], policy.to[4]])
  const original = access.all.get(key)
  assert.equal(original?.reason, 'road-pattern-dependent-path')
  assert.deepEqual(original.roadPatternIds, policy.roadPatternIds, 'Changed rejected M53 road contexts')
  const result = matchBaselSegment(bernGraph([feature]), policy.from, policy.to, policy.limits)
  assert(result.path, result.reason)
  result.path = result.path.map(p => p.map(n => +n.toFixed(7)))
  assert.equal(hash(result.path), policy.geometrySha256, 'Changed M53 corridor path')
  return { result, patterns: [...patterns.values()], original,
    match(candidateRoute, from, to, previous) {
      if (previous?.path || !Object.entries(policy.route).every(([k, v]) => candidateRoute[k] === v)) return previous
      if (from[4] !== policy.from[4] || to[4] !== policy.to[4]) return previous
      assert.deepEqual(from, policy.from, 'Changed M53 stop coordinate'); assert.deepEqual(to, policy.to, 'Changed M53 stop coordinate')
      return { ...result, agencyId: route.agencyId, geometrySource: 'bern-official-m53-corridor',
        sourceFeatures: [feature.properties.liniencode], contextCount: patterns.size, previousSupplementFailure: previous?.reason }
    } }
}

export async function loadSolothurnM53(context, access) {
  const file = 'data/solothurn-m53-policy.json', policy = JSON.parse(await readFile(file)), dir = policy.sourceDirectory
  assert.equal(await hashFile('data/solothurn-pattern-contexts.json.gz'), policy.contextSha256)
  assert.deepEqual(context.sourceHashes, policy.timetableSourceHashes)
  assert.equal(await hashFile('data/solothurn-access-roads/cache.json.gz'), policy.accessCacheSha256)
  assert.equal(await hashFile(`${dir}/sources.json`), policy.sourceSha256)
  const source = JSON.parse(await readFile(`${dir}/sources.json`))
  for (const item of source.files) assert.equal(await hashFile(`${dir}/${item.file}`), item.sha256)
  const matcher = solothurnM53Matcher(JSON.parse(await readFile(`${dir}/bern-9353.json`)), policy, context, access)
  const differences = JSON.parse(gunzipSync(await readFile(`${dir}/road-context-review.json.gz`)))
  for (const review of differences) for (const r of review.rows) {
    const identity = access.cache.agencies.all.identities[r.id]
    assert.equal(identity.routeId, review.route); assert.deepEqual(identity.stops, r.stops)
    const index = identity.stops.findIndex((s, i) => s[4] === review.fromId && identity.stops[i + 1]?.[4] === review.toId)
    assert(index >= 0)
    assert.deepEqual(access.cache.agencies.all.cache.paths[access.cache.agencies.all.cache.patterns[r.id][index]], r.path, 'Changed reviewed road alternative')
  }
  const { path, ...pair } = matcher.result
  return { ...matcher, metadata: { policy, policySha256: await hashFile(file), source, patterns: matcher.patterns,
    pair: { ...pair, geometrySha256: policy.geometrySha256, priorRoadAssessment: matcher.original },
    roadContextReview: differences.map(({rows,...r}) => ({ ...r, variants: rows.map(({ path, stops, ...v }) => ({ ...v, geometrySha256: hash(path), stopCount: stops.length })) })) } }
}
