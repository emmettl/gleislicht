import assert from 'node:assert/strict'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'

const pointKey = p => p.slice(0, 2).map(n => n.toFixed(7)).join(',')
export const featureKey = (layer, feature) => `${layer}:${feature.properties.BUL_ROUTE ?? feature.properties.BAHN_ROUTE ?? feature.properties.OBJECTID}`

export function featureIdentity(layer, feature, policy, domain) {
  const p = feature.properties, key = featureKey(layer, feature)
  if (layer === 'boat') return { key, reason: 'stale-boat-source' }
  assert.equal(p.FP_JAHR, policy.timetableYear, 'Unreviewed line timetable year')
  const operator = policy.operatorCrosswalk[p.TU]
  if (operator) assert.equal(domain.get(p.TU), operator.name, 'Changed TU enumeration')
  else assert.equal(p.TU, 0, 'Unknown TU code')
  const override = policy.featureOverrides[key]
  if (override) return { key, ...override }
  const mode = layer === 'bus' ? 'bus' : 'rail'
  const line = layer === 'bus' ? p.LINIENNR.replace(/^Linie\s+/, '').trim() : p.BAHN_ROUTE.replace(/_\d+$/, '')
  if (!operator?.[mode] || (mode === 'rail' && !/^(S[N]?\d+|RE\d+)$/.test(line))) return { key, reason: 'unresolved-source-identity' }
  return { key, mode, agencyIds: operator[mode], lines: [line], reason: 'Decoded TU plus exact passenger-facing line; full directed pattern must pass independently.' }
}

export function lineGraph(features) {
  const graph = { points: [], indexes: new Map(), adjacency: [], edges: [], parts: [] }
  const index = input => {
    const point = input.slice(0, 2)
    assert(point.length === 2 && point.every(Number.isFinite) && point[0] > 7 && point[0] < 10 && point[1] > 46 && point[1] < 48, 'Invalid WGS84 coordinate')
    const key = pointKey(point)
    if (!graph.indexes.has(key)) { graph.indexes.set(key, graph.points.length); graph.points.push(point); graph.adjacency.push([]) }
    return graph.indexes.get(key)
  }
  for (const feature of features) {
    assert(['LineString', 'MultiLineString'].includes(feature.geometry?.type))
    const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const line of lines) {
      assert(line.length >= 2)
      const part = []
      for (let i = 1; i < line.length; i++) {
        const a = index(line[i - 1]), b = index(line[i]); if (a === b) continue
        const length = distanceMetres(graph.points[a], graph.points[b]), edge = { a, b, length }
        graph.edges.push(edge); part.push(edge)
        // Exact shared vertices only. Crossings do not imply a connection.
        // The publisher does not provide direction; this is corridor inference.
        graph.adjacency[a].push([b, length]); graph.adjacency[b].push([a, length])
      }
      if (part.length) graph.parts.push(part)
    }
  }
  return graph
}

export function luzernGraphs(collections, layers, policy) {
  const groups = new Map(), inventory = []
  for (const [layer, collection] of Object.entries(collections)) {
    const domain = new Map(layers[layer].fields.find(f => f.name === 'TU')?.domain?.codedValues?.map(v => [v.code, v.name]))
    for (const feature of collection.features) {
      const identity = featureIdentity(layer, feature, policy, domain)
      inventory.push({ ...identity, layer, objectId: feature.properties.OBJECTID, properties: feature.properties })
      if (!identity.agencyIds) continue
      for (const agency of identity.agencyIds) for (const line of identity.lines) {
        const key = JSON.stringify([agency, identity.mode, line]), group = groups.get(key) ?? { features: [], sourceFeatures: [] }
        group.features.push(feature); group.sourceFeatures.push(identity.key); groups.set(key, group)
      }
    }
  }
  return { inventory, graphs: new Map([...groups].map(([key, group]) => [key, { graph: lineGraph(group.features), sourceFeatures: group.sourceFeatures }])) }
}

export function matchLuzernPair(candidate, from, to, limits) {
  if (!candidate) return { reason: 'missing-line' }
  return { ...matchBaselSegment(candidate.graph, from, to, limits), sourceFeatures: candidate.sourceFeatures }
}

export function directedPatternKey(train) {
  return JSON.stringify([train.routeId, train.directionId ?? '', train.calls.map(c => [c.id, c.pickupType ?? '0', c.dropOffType ?? '0'])])
}
