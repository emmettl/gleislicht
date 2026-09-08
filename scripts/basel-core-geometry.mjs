import assert from 'node:assert/strict'
import { projectedRailGraph } from './lausanne-rail-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export const BASEL_CORE_RAIL_LIMITS = { snapMetres: 120, detourRatio: 4.5, detourFloorMetres: 3000 }
const lengthOf = points => points.slice(1).reduce((sum, point, i) => sum + distanceMetres(points[i], point), 0)

export function coreShortest(graph, start, end, maximum = Infinity) {
  const distances = new Map([[start, 0]]), previous = new Map(), queue = [[0, start]]
  while (queue.length) {
    queue.sort((a, b) => b[0] - a[0])
    const [distance, node] = queue.pop()
    if (distance !== distances.get(node)) continue
    if (distance > maximum) return undefined
    if (node === end) {
      const result = []
      for (let key = end; key !== start;) { const step = previous.get(key); result.unshift(step.edge); key = step.node }
      return result
    }
    for (const edge of graph.get(node) ?? []) {
      const next = distance + edge.length
      if (next >= (distances.get(edge.to) ?? Infinity) || next > maximum) continue
      distances.set(edge.to, next); previous.set(edge.to, { node, edge }); queue.push([next, edge.to])
    }
  }
}

export function coreInfrastructure(network, policy) {
  const graph = new Map()
  for (const segment of network.segments) for (const [from, to] of [[segment.start, segment.end], [segment.end, segment.start]]) {
    const list = graph.get(from) ?? []
    list.push({ to, segmentId: segment.id, length: lengthOf(segment.points) }); graph.set(from, list)
  }
  const anchor = number => {
    const found = [...network.nodes.values()].filter(node => node.number === number)
    assert.equal(found.length, 1, `Expected one FOT operating point ${number}`)
    return found[0].id
  }
  const railIds = new Set(), corridors = []
  for (const numbers of policy.railCorridors) {
    const segmentIds = new Set()
    for (let i = 1; i < numbers.length; i++) {
      const a = anchor(numbers[i - 1]), b = anchor(numbers[i])
      const maximum = Math.max(3000, distanceMetres(network.nodes.get(a).coordinate, network.nodes.get(b).coordinate) * 4.5)
      const route = coreShortest(graph, a, b, maximum)
      assert(route?.length, `Disconnected FOT rail corridor ${numbers[i - 1]}–${numbers[i]}`)
      for (const edge of route) segmentIds.add(edge.segmentId)
    }
    // Operating points lie within stations. Include their real incident
    // segments so platforms beyond a terminal's centre can still project.
    for (const number of [numbers[0], numbers.at(-1)]) for (const edge of graph.get(anchor(number)) ?? []) segmentIds.add(edge.segmentId)
    for (const id of segmentIds) railIds.add(id)
    corridors.push({ operatingPoints: numbers, segmentIds: [...segmentIds].sort() })
  }
  const tramNodes = new Set([anchor('8578143')])
  for (const node of tramNodes) for (const edge of graph.get(node) ?? []) tramNodes.add(edge.to)
  const tram = network.segments.filter(segment => tramNodes.has(segment.start) && tramNodes.has(segment.end))
  assert(tram.every(segment => !railIds.has(segment.id)), 'FOT tram and mainline components unexpectedly overlap')
  return { rail: network.segments.filter(segment => railIds.has(segment.id)), tram,
    provenance: { corridors, tramSegmentIds: tram.map(segment => segment.id).sort(), inference: 'Undirected physical centreline corridors through exact FOT operating-point identities. Running tracks are not resolved.' } }
}

export function coreGeometryMatcher(segments, stops, indices, limits) {
  const { graph, projections } = projectedRailGraph(segments, stops, indices, { snapMetres: limits.snapMetres })
  const pairs = new Map()
  return (from, to) => {
    const key = `${from}:${to}`
    if (pairs.has(key)) return pairs.get(key)
    const a = projections.get(from), b = projections.get(to), start = stops[from], end = stops[to]
    const direct = distanceMetres(start, end), maximum = Math.max(limits.detourFloorMetres, direct * limits.detourRatio)
    const edges = a && b ? coreShortest(graph, a.key, b.key, maximum) : undefined
    const points = edges?.length ? [start.slice(0, 2), ...edges.flatMap(edge => edge.points), end.slice(0, 2)]
      .map(point => point.map(value => Number(value.toFixed(7))))
      .filter((point, i, all) => !i || distanceMetres(all[i - 1], point) > 0.01) : undefined
    const networkLength = edges?.reduce((sum, edge) => sum + edge.length, 0) ?? 0
    const accepted = points?.length >= 2 && lengthOf(points) <= maximum && networkLength >= Math.max(1, direct > 30 ? direct * 0.5 : 1)
    const result = { points: accepted ? points : null, segmentIds: [...new Set(edges?.map(edge => edge.segmentId) ?? [])],
      maximumSnapMetres: a && b ? Math.max(a.snapMetres, b.snapMetres) : null, pathMetres: networkLength,
      reason: accepted ? null : !a || !b ? 'endpoint-gap' : !edges ? 'disconnected-or-excessive-detour' : 'collapsed-or-excessive-path' }
    pairs.set(key, result); return result
  }
}

export function coreEdgePaths(snapshot) {
  const counts = new Map()
  for (const train of snapshot.trains) train.stops.slice(1).forEach(([to], i) => {
    const path = train.pathSegments[i]
    if (path === null) return
    const key = [train.stops[i][0], to].sort((a, b) => a - b).join(':')
    const paths = counts.get(key) ?? new Map()
    paths.set(path, (paths.get(path) ?? 0) + 1); counts.set(key, paths)
  })
  return snapshot.edges.map(([a, b]) => {
    const paths = counts.get([a, b].sort((x, y) => x - y).join(':'))
    return paths ? [...paths].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0] : null
  })
}
