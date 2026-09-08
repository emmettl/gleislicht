import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { roadConsensus, verifyLuzernRoadEvidence } from './luzern-road-geometry.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

export async function loadSolothurnAccessRoads(context, { verifyEvidence = false, policyPath = 'data/solothurn-access-policy.json' } = {}) {
  const policy = JSON.parse(await readFile(policyPath)), dir = policy.sourceDirectory
  assert.equal(await hashFile(`${dir}/source.json`), policy.sourceSha256)
  assert.equal(await hashFile(`${dir}/cache.json.gz`), policy.cacheSha256)
  const source = JSON.parse(await readFile(`${dir}/source.json`)), cache = JSON.parse(gunzipSync(await readFile(`${dir}/cache.json.gz`)))
  assert.deepEqual(cache.metadata.source, source); assert.deepEqual(cache.metadata.sourceHashes, context.sourceHashes)
  assert.equal(cache.metadata.contextSha256, await hashFile('data/solothurn-pattern-contexts.json.gz'))
  assert.deepEqual(cache.metadata.dates, context.snapshots.map(s => s.metadata.serviceDate))
  const routes = new Map(cache.metadata.routes.map(r => [r.routeId, r]))
  const expected = new Set()
  for (const d of context.snapshots) for (const t of d.trains) if (routes.has(t.routeId)) {
    const route = context.routes.find(r => r.id === t.routeId), identity = routes.get(t.routeId)
    assert.equal(route.agencyId, identity.agencyId); assert.equal(route.name, identity.line); assert.equal(route.mode, 'bus')
    expected.add(roadPatternId(t, d.stops))
  }
  assert.deepEqual([...expected].sort(), Object.keys(cache.agencies.all.identities).sort(), 'Access-road scope must contain every complete seasonal pattern')
  for (const [file, sha256] of Object.entries(source.files)) assert.equal(await hashFile(`${dir}/${file}`), sha256)
  assert.equal(hash(gunzipSync(await readFile(`${dir}/network.osm.gz`))), source.osmSha256)
  const matcher = cache.agencies.all.cache.metadata.matcher
  assert.equal(matcher.osmSha256, source.osmSha256); assert.equal(matcher.binarySha256, source.binarySha256)
  assert.equal(matcher.configSha256, source.files['routing.cfg'])
  if (verifyEvidence) await verifyLuzernRoadEvidence(cache, source.description)
  const all = roadConsensus(cache, policy.limits, source.osmSha256), pairs = new Map()
  for (const review of policy.pairs) {
    const identity = routes.get(review.routeId); assert(identity)
    assert.equal(review.agencyId, identity.agencyId); assert.equal(review.line, identity.line)
    const key = JSON.stringify([review.routeId, review.fromId, review.toId]), candidate = all.get(key)
    assert(candidate?.path, 'Reviewed access-road pair no longer has full-context consensus')
    assert.equal(hash(JSON.stringify(candidate.path)), review.geometrySha256)
    if (review.roadPatternIds) assert.deepEqual(candidate.roadPatternIds, review.roadPatternIds, 'Changed reviewed complete road contexts')
    assert(!pairs.has(key), 'Duplicate access-road pair')
    pairs.set(key, { ...candidate, agencyId: identity.agencyId, geometrySource: policy.geometrySource ?? 'osm-solothurn-access-road-inference' })
  }
  return { pairs, all, policy, cache, metadata: { policy, policySha256: await hashFile(policyPath), source,
    patterns: expected.size, matcherIssues: cache.agencies.all.cache.report.issues, maximumImportedSnapMetres: cache.agencies.all.cache.report.maxSnapMetres },
    match(route, from, to, original) {
      if (original?.path || route.mode !== 'bus') return original
      const identity = routes.get(route.id)
      if (!identity || identity.agencyId !== route.agencyId || identity.line !== route.name) return original
      const candidate = pairs.get(JSON.stringify([route.id, from[4], to[4]]))
      if (!candidate) return original
      assert.deepEqual(candidate.path[0], from.slice(0, 2).map(n => +n.toFixed(7)), 'Changed access-road stop coordinate')
      assert.deepEqual(candidate.path.at(-1), to.slice(0, 2).map(n => +n.toFixed(7)), 'Changed access-road stop coordinate')
      return { ...candidate, ...(original ? { previousSupplementFailure: original.reason } : {}) }
    } }
}
