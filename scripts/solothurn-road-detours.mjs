import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
import { hashFile } from './solothurn-timetable.mjs'

const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const keyOf = (route, from, to) => JSON.stringify([route, from, to])
const projectGap = (p, a, b) => {
  const scale = Math.cos(p[1] * Math.PI / 180), dx = (b[0] - a[0]) * scale, dy = b[1] - a[1]
  const t = dx || dy ? Math.max(0, Math.min(1, ((p[0] - a[0]) * scale * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0
  return distanceMetres(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
}
const samples = path => path.flatMap((b, i) => {
  if (!i) return [b]
  const a = path[i - 1], n = Math.max(1, Math.ceil(distanceMetres(a, b) / 5))
  return Array.from({ length: n }, (_, j) => a.map((v, k) => v + (b[k] - v) * (j + 1) / n))
})
export const corridorGap = (a, b) => Math.max(...samples(a).map(p => Math.min(...b.slice(1).map((q, i) => projectGap(p, b[i], q)))))

export function reviewedRoadCorridor(osm, review) {
  assert(!osm.remark, 'Incomplete road relation response')
  const nodes = new Map(osm.elements.filter(e => e.type === 'node').map(e => [e.id, e]))
  const ways = new Map(osm.elements.filter(e => e.type === 'way').map(e => [e.id, e]))
  const relation = osm.elements.find(e => e.type === 'relation' && e.id === review.relationId)
  assert.equal(hash(relation), review.relationSha256, 'Changed road relation')
  assert.equal(relation.tags.route, 'bus'); assert.equal(relation.tags.ref, review.line)
  assert.equal(relation.tags.operator, review.operator); assert.equal(relation.tags['gtfs:route_id'], review.routeId)
  const stopMembers = relation.members.filter(m => m.type === 'node' && m.role === 'stop')
  assert(stopMembers.some((m, i) => m.ref === review.fromNode && stopMembers[i + 1]?.ref === review.toNode), 'Changed directed stop order')
  for (const [id, uic] of [[review.fromNode, review.fromUic], [review.toNode, review.toUic]]) assert.equal(nodes.get(id)?.tags?.uic_ref, uic)
  const members = relation.members.filter(m => m.type === 'way' && m.role === '')
  assert.deepEqual(members.slice(review.memberOffset, review.memberOffset + review.segments.length).map(m => m.ref), review.segments.map(s => s.wayId))
  const ids = [], features = []
  for (const segment of review.segments) {
    const way = ways.get(segment.wayId)
    assert.equal(hash(way), segment.featureSha256, 'Changed reviewed road way')
    assert(way.tags.highway && !['footway', 'path', 'cycleway'].includes(way.tags.highway))
    const oneWay = way.tags['oneway:bus'] ?? way.tags['oneway:psv'] ?? way.tags.oneway ?? (way.tags.junction === 'roundabout' ? 'yes' : 'no')
    if (oneWay === 'yes') assert.equal(segment.direction, 1, 'Reversed one-way road')
    if (oneWay === '-1') assert.equal(segment.direction, -1, 'Reversed one-way road')
    const ordered = segment.direction === 1 ? [...way.nodes] : [...way.nodes].reverse()
    const start = ordered.indexOf(segment.fromNode), end = ordered.indexOf(segment.toNode)
    assert(start >= 0 && end >= 0 && start !== end)
    let part
    if (end > start) part = ordered.slice(start, end + 1)
    else { assert.equal(ordered[0], ordered.at(-1), 'Non-cyclic road wrap'); part = [...ordered.slice(start), ...ordered.slice(1, end + 1)] }
    if (ids.length) assert.equal(ids.at(-1), part[0], 'Disconnected reviewed road corridor')
    ids.push(...(ids.length ? part.slice(1) : part)); features.push({ id: way.id, tags: way.tags, version: way.version, timestamp: way.timestamp })
  }
  assert.equal(ids[0], review.fromNode); assert.equal(ids.at(-1), review.toNode)
  return { path: ids.map(id => { const n = nodes.get(id); assert(n); return [n.lon, n.lat] }), features }
}

export function solothurnRoadDetourMatcher(osm, policy, access) {
  for (const e of osm.elements) assert(e.timestamp <= policy.snapshot, 'Source newer than road review snapshot')
  const pairs = new Map(), evidence = []
  for (const review of policy.pairs) {
    const key = keyOf(review.routeId, review.from[4], review.to[4])
    assert.equal(access.all.get(key)?.reason, 'road-excessive-detour', 'Review must only resolve the generic detour rejection')
    const relaxed = roadConsensus(access.cache, { ...access.policy.limits, detourFloorMetres: review.maximumPathMetres }, access.metadata.source.osmSha256)
    const candidate = relaxed.get(key)
    assert(candidate?.path, 'Reviewed detour lacks full-context consensus')
    assert.equal(hash(candidate.path), review.geometrySha256, 'Changed reviewed bus geometry')
    assert.deepEqual(candidate.roadPatternIds, review.roadPatternIds, 'Changed full-pattern scope')
    assert.deepEqual(candidate.path[0], review.from.slice(0, 2).map(n => +n.toFixed(7)))
    assert.deepEqual(candidate.path.at(-1), review.to.slice(0, 2).map(n => +n.toFixed(7)))
    assert(candidate.lengthMetres <= review.maximumPathMetres)
    const corridor = reviewedRoadCorridor(osm, review)
    const forwardGap = corridorGap(candidate.path, corridor.path), reverseGap = corridorGap(corridor.path, candidate.path)
    assert(Math.max(forwardGap, reverseGap) <= review.maximumCorridorGapMetres, 'Road geometry disagrees with reviewed bus relation')
    const identity = access.cache.metadata.routes.find(r => r.routeId === review.routeId)
    assert.equal(identity.agencyId, review.agencyId); assert.equal(identity.line, review.line)
    pairs.set(key, { ...candidate, agencyId: review.agencyId, geometrySource: 'osm-solothurn-reviewed-road-detour', reviewedRelationId: review.relationId })
    evidence.push({ ...review, pathMetres: candidate.lengthMetres, directMetres: candidate.directMetres, forwardGapMetres: forwardGap, reverseGapMetres: reverseGap,
      originalFailure: access.all.get(key), sourceFeatures: corridor.features, sourcePathSha256: hash(corridor.path), roadContextOccurrences: candidate.roadContextOccurrences })
  }
  return { pairs, evidence, match(route, from, to, original) {
    if (original?.path || route.mode !== 'bus') return original
    const review = policy.pairs.find(p => p.routeId === route.id && p.agencyId === route.agencyId && p.line === route.name && p.from[4] === from[4] && p.to[4] === to[4])
    if (!review) return original
    assert.deepEqual(from, review.from, 'Changed reviewed bus stop'); assert.deepEqual(to, review.to, 'Changed reviewed bus stop')
    return { ...pairs.get(keyOf(route.id, from[4], to[4])), previousSupplementFailure: original?.reason }
  } }
}

export async function loadSolothurnRoadDetours(access) {
  const file = 'data/solothurn-road-detour-policy.json', policy = JSON.parse(await readFile(file)), dir = policy.sourceDirectory
  assert.equal(await hashFile(`${dir}/sources.json`), policy.sourceSha256)
  assert.equal(await hashFile('data/solothurn-access-roads/cache.json.gz'), policy.accessCacheSha256)
  const source = JSON.parse(await readFile(`${dir}/sources.json`))
  for (const item of source.files) assert.equal(await hashFile(`${dir}/${item.file}`), item.sha256)
  assert.equal(source.snapshot, policy.snapshot)
  assert((await readFile(`${dir}/query.txt`, 'utf8')).includes(`[date:"${policy.snapshot}"]`))
  const matcher = solothurnRoadDetourMatcher(JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`))), policy, access)
  const osm = JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`)))
  const rejected = JSON.parse(await readFile(`${dir}/egerkingen-rejected-review.json`))
  const review = rejected.review, key = keyOf(review.routeId, review.from[4], review.to[4])
  const candidate = roadConsensus(access.cache, { ...access.policy.limits, detourFloorMetres: 1300 }, access.metadata.source.osmSha256).get(key)
  assert.equal(hash(candidate.path), rejected.roadCandidateSha256)
  const corridor = reviewedRoadCorridor(osm, review)
  const forwardGapMetres = corridorGap(candidate.path, corridor.path), reverseGapMetres = corridorGap(corridor.path, candidate.path)
  assert(Math.max(forwardGapMetres, reverseGapMetres) > review.maximumCorridorGapMetres, 'Reassess changed Egerkingen disagreement')
  const arlesheim = JSON.parse(await readFile('data/solothurn-audit/local-gap-review.json')).arlesheim
  const nodes = new Map(osm.elements.filter(e => e.type === 'node').map(e => [e.id, [e.lon, e.lat]]))
  const tramWays = osm.elements.filter(e => e.type === 'way' && e.tags?.railway === 'tram')
  const nearestTrackMetres = Math.min(...tramWays.map(w => corridorGap([arlesheim.to.slice(0, 2)], w.nodes.map(id => nodes.get(id)))))
  assert(nearestTrackMetres > arlesheim.limits.snapMetres, 'Reassess changed Arlesheim source gap')
  return { ...matcher, metadata: { policy, policySha256: await hashFile(file), source, pairs: matcher.evidence,
    exclusions: { egerkingen: { ...rejected, forwardGapMetres, reverseGapMetres },
      arlesheim: { stop: arlesheim.to, nearestTrackMetres, limitMetres: arlesheim.limits.snapMetres, decision: 'Excluded; original platform coordinate remains unsupported by retained tram ways.' } } } }
}
