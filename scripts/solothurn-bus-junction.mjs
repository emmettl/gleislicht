import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { solothurnGraphs, SO_LIMITS } from './solothurn-network-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function reviewedSolothurnBusJunction(source, policy) {
  const features = policy.features.map(review => {
    const candidates = source.lines.filter(f => f.properties.T_Ili_Tid === review.id)
    assert.equal(candidates.length, 1)
    const f = candidates[0]
    assert.equal(f.properties.verkehrsmittel, 'Bus'); assert.equal(f.properties.tunnel, 0)
    assert.equal(hash(f), review.sha256, 'Changed reviewed bus source feature')
    const line = f.geometry.coordinates[review.part]
    assert(review.endpoint === 0 || review.endpoint === line.length - 1)
    assert.deepEqual(line[review.endpoint], review.coordinate)
    return f
  })
  assert.equal(features.length, 2)
  const [a, b] = policy.features.map(f => f.coordinate), joinMetres = Math.hypot(a[0] - b[0], a[1] - b[1])
  assert(joinMetres > 0 && joinMetres <= policy.maximumJoinMetres && policy.maximumJoinMetres <= .003, 'Unreviewed bus junction gap')
  const graph = solothurnGraphs(features).get('bus'), before = { ...graph.topology }
  const from = graph.indexes.get(a.join(',')), to = graph.indexes.get(b.join(','))
  assert(Number.isInteger(from) && Number.isInteger(to) && from !== to)
  const length = distanceMetres(graph.points[from], graph.points[to])
  const connector = { a: from, b: to, length, sourceId: 'reviewed-inferred-oberbuchsiten-connector', tunnel: 0 }
  graph.edges.push(connector); graph.parts.push([connector])
  graph.adjacency[from].push([to, length]); graph.adjacency[to].push([from, length])
  const evidence = { endpointsLv95: [a, b], joinMetres, sourceFeatureIds: policy.features.map(f => f.id),
    originalVertices: before.vertices, originalEdges: before.edges, addedVertices: 0, addedEdges: 1 }
  return { evidence,
    match(route, fromStop, toStop, original) {
      if (original?.path || route.id !== policy.routeId || route.agencyId !== policy.agencyId || route.name !== policy.line || route.mode !== policy.mode
        || fromStop[4] !== policy.from[4] || toStop[4] !== policy.to[4]) return original
      assert.deepEqual(fromStop, policy.from, 'Changed reviewed bus platform'); assert.deepEqual(toStop, policy.to, 'Changed reviewed bus platform')
      const result = matchBaselSegment(graph, fromStop, toStop, SO_LIMITS.bus)
      return { ...result, agencyId: route.agencyId, geometrySource: 'solothurn-reviewed-bus-junction', sourceJunction: evidence,
        ...(original ? { previousSupplementFailure: original.reason } : {}) }
    } }
}

export async function loadSolothurnBusJunction() {
  const file = 'data/solothurn-bus-junction-policy.json', policy = JSON.parse(await readFile(file))
  assert.equal(await hashFile(policy.sourceFile), policy.sourceSha256)
  const source = JSON.parse(gunzipSync(await readFile(policy.sourceFile)))
  const matcher = reviewedSolothurnBusJunction(source, policy)
  return { ...matcher, metadata: { policy, policySha256: await hashFile(file), source: source.metadata, evidence: matcher.evidence } }
}
