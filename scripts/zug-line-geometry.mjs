import assert from 'node:assert/strict'
import { lineGraph, directedPatternKey } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './download-luzern-sources.mjs'

export { directedPatternKey }
export const zugRouteKey = r => JSON.stringify([r.agencyId, r.mode, r.line])
const pointKey = p => p.map(n => n.toFixed(7)).join(',')
const edgeKey = (a, b) => [pointKey(a), pointKey(b)].sort().join('|')

export function reviewedZugJoins(collection, policy) {
  const config = policy.topologyJoins
  if (!config) return []
  assert.equal(sha256(JSON.stringify(collection)), config.sourceSha256, 'Changed topology source')
  const byId = new Map(collection.features.map(f => [f.properties.id, f]))
  return config.joins.map(join => {
    assert.equal(join.vertices.length, 2)
    const coordinates = join.vertices.map(({ featureId, index }) => {
      const f = byId.get(featureId); assert(f, 'Missing join feature')
      assert(Number.isInteger(index) && f.geometry.coordinates[index], 'Missing join vertex')
      assert(join.lines.every(line => zugLineLabels(f.properties.liniennummer).includes(line)), 'Join crosses line identities')
      return f.geometry.coordinates[index]
    })
    assert(join.vertices.some(({ featureId, index }) => index === 0 || index === byId.get(featureId).geometry.coordinates.length - 1), 'Join must include a source endpoint')
    const metres = distanceMetres(...coordinates)
    assert(metres > 0 && metres <= 1 && Math.abs(metres - join.metres) < .001, 'Unreviewed topology join length')
    return { ...join, coordinates, edge: edgeKey(...coordinates), feature: { type: 'Feature', properties: { joinId: join.id }, geometry: { type: 'LineString', coordinates } } }
  })
}

export function zugLineLabels(label) {
  assert(typeof label === 'string' && /^\d+(,\d+)*$/.test(label), 'Unreviewed Zug line label')
  const lines = label.split(',')
  assert.equal(new Set(lines).size, lines.length, 'Duplicate line membership')
  return lines
}

export function zugGraphs(collection, policy) {
  assert.equal(collection.type, 'FeatureCollection')
  const joins = reviewedZugJoins(collection, policy)
  const groups = new Map(), inventory = [], seen = new Set()
  for (const feature of collection.features) {
    const p = feature.properties, key = `bus:${p.id}`
    assert(Number.isInteger(p.id) && Number.isInteger(p.t_id) && !seen.has(p.t_id), 'Invalid source identity')
    seen.add(p.t_id)
    for (const line of zugLineLabels(p.liniennummer)) {
      const identity = policy.lineCrosswalk[line]
      assert(identity, `Unreviewed Zug source line ${line}`)
      inventory.push({ key, layer: 'bus', line, properties: p, ...identity })
      if (!identity.agencyIds) continue
      for (const agencyId of identity.agencyIds) {
        const routeKey = zugRouteKey({ agencyId, mode: 'bus', line }), group = groups.get(routeKey) ?? { features: [], sourceFeatures: [] }
        group.features.push(feature); group.sourceFeatures.push(key); groups.set(routeKey, group)
      }
    }
  }
  return { inventory, graphs: new Map([...groups].map(([key, group]) => {
    const applicable = joins.filter(j => j.lines.includes(JSON.parse(key)[2]))
    const original = lineGraph(group.features)
    for (const j of applicable) {
      const from = original.indexes.get(pointKey(j.coordinates[0])), to = original.indexes.get(pointKey(j.coordinates[1]))
      assert(from !== undefined && to !== undefined)
      const seen = new Set([from]), queue = [from]
      while (queue.length) for (const [next] of original.adjacency[queue.pop()]) if (!seen.has(next)) { seen.add(next); queue.push(next) }
      assert(!seen.has(to), 'Topology join no longer connects distinct components')
    }
    return [key, { graph: lineGraph([...group.features, ...applicable.map(j => j.feature)]), sourceFeatures: group.sourceFeatures, joins: applicable }]
  })) }
}

export function matchZugPair(candidate, from, to, limits) {
  if (!candidate) return { reason: 'missing-reviewed-line-geometry' }
  const result = matchBaselSegment(candidate.graph, from, to, limits)
  const edges = new Set(result.path?.slice(1).map((p, i) => edgeKey(result.path[i], p)) ?? [])
  const joins = candidate.joins?.filter(j => edges.has(j.edge)) ?? []
  return { ...result, sourceFeatures: candidate.sourceFeatures, ...(joins.length ? { geometryRepairIds: joins.map(j => j.id), inferredJoinMetres: joins.reduce((n, j) => n + j.metres, 0) } : {}) }
}
