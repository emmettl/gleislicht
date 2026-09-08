import assert from 'node:assert/strict'
import { distanceMetres, sliceShape } from './enrich-postbus-roads.mjs'

export const LAUSANNE_RAIL_LIMITS = { snapMetres: 120, maxDetourRatio: 4.5, detourAllowanceMetres: 3000 }
const lengthOf = points => points.slice(1).reduce((sum, point, i) => sum + distanceMetres(points[i], point), 0)

function addEdge(graph, from, to, points, segmentId) {
  const edges = graph.get(from) ?? []
  edges.push({ to, points, length: lengthOf(points), segmentId })
  graph.set(from, edges)
}
function addBoth(graph, from, to, points, segmentId) {
  addEdge(graph, from, to, points, segmentId)
  addEdge(graph, to, from, [...points].reverse(), segmentId)
}
function shortest(graph, start, end, maximumDistance = Infinity) {
  const distances = new Map([[start, 0]]), previous = new Map(), queue = [[0, start]]
  while (queue.length) {
    queue.sort((a, b) => b[0] - a[0])
    const [distance, node] = queue.pop()
    if (distance !== distances.get(node)) continue
    if (distance > maximumDistance) return undefined
    if (node === end) {
      const edges = []
      for (let key = end; key !== start;) {
        const step = previous.get(key)
        edges.unshift(step.edge)
        key = step.node
      }
      return edges
    }
    for (const edge of graph.get(node) ?? []) {
      const next = distance + edge.length
      if (next >= (distances.get(edge.to) ?? Infinity) || next > maximumDistance) continue
      distances.set(edge.to, next)
      previous.set(edge.to, { node, edge })
      queue.push([next, edge.to])
    }
  }
}

// These are FOT operating-point numbers, not nearest geographic candidates.
// m1 joins the mainline graph at Renens, so isolate its Flon–Renens corridor.
export function lausanneRailNetworks(network) {
  const node = number => {
    const candidates = [...network.nodes.values()].filter(value => value.number === number)
    assert.equal(candidates.length, 1, `Expected one FOT anchor ${number}`)
    return candidates[0].id
  }
  const graph = new Map()
  for (const segment of network.segments) addBoth(graph, segment.start, segment.end, segment.points, segment.id)
  const component = anchor => {
    const visited = new Set([node(anchor)])
    for (const key of visited) for (const edge of graph.get(key) ?? []) visited.add(edge.to)
    return network.segments.filter(segment => visited.has(segment.start) && visited.has(segment.end))
  }
  const corridor = shortest(graph, node('8519588'), node('8501118'))
  assert(corridor?.length, 'Missing FOT m1 Flon–Renens corridor')
  const m1Ids = new Set(corridor.map(edge => edge.segmentId))
  return {
    m1: network.segments.filter(segment => m1Ids.has(segment.id)),
    m2: component('8519589'), leb: component('8519590'), mbc: component('8501054'),
    rail: component('8501120').filter(segment => !m1Ids.has(segment.id)),
  }
}

export function lausanneRailGroup(train, routes) {
  const route = routes.get(train.routeId)
  assert(route, `Missing source route ${train.routeId}`)
  if (route.agencyId === '151' && train.category === 'metro' && ['m1', 'm2'].includes(train.route)) return train.route
  if (train.category === 'metro' || train.category === 'bus') return undefined
  if (route.agencyId === '55') return 'leb'
  if (route.agencyId === '29') return 'mbc'
  return 'rail'
}

function measuredSegment(segment) {
  let distance = 0
  const shape = segment.points.map((point, i) => {
    if (i) distance += distanceMetres(segment.points[i - 1], point)
    return [...point, distance]
  })
  return { ...segment, shape, distance }
}

export function projectRailStop(stop, segments, maximumSnap = LAUSANNE_RAIL_LIMITS.snapMetres) {
  let best
  const scale = Math.cos(stop[1] * Math.PI / 180)
  for (const segment of segments) for (let i = 1; i < segment.shape.length; i++) {
    const a = segment.shape[i - 1], b = segment.shape[i]
    const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1]
    const denominator = dx * dx + dy * dy
    const t = denominator ? Math.max(0, Math.min(1, ((stop[0] - a[0]) * scale * dx + (stop[1] - a[1]) * dy) / denominator)) : 0
    const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    const snapMetres = distanceMetres(stop, point)
    if (snapMetres > maximumSnap || (best && snapMetres >= best.snapMetres)) continue
    best = { segmentId: segment.id, distance: a[2] + (b[2] - a[2]) * t, point, snapMetres }
  }
  return best
}

export function projectedRailGraph(sourceSegments, stops, indices, limits = LAUSANNE_RAIL_LIMITS) {
  const segments = sourceSegments.map(measuredSegment)
  const projections = new Map(), splits = new Map(), graph = new Map()
  for (const index of indices) {
    const projected = projectRailStop(stops[index], segments, limits.snapMetres)
    if (!projected) continue
    const segment = segments.find(value => value.id === projected.segmentId)
    // Merge numerically coincident cuts to avoid zero-length graph fragments.
    const at = Math.max(0, Math.min(segment.distance, Math.round(projected.distance * 1000) / 1000))
    const key = at <= 0.001 ? segment.start : segment.distance - at <= 0.001 ? segment.end : `projection:${segment.id}:${at}`
    projections.set(index, { ...projected, key, distance: at })
    const cuts = splits.get(segment.id) ?? new Map()
    cuts.set(at, key)
    splits.set(segment.id, cuts)
  }
  for (const segment of segments) {
    const cuts = new Map([[0, segment.start], [segment.distance, segment.end], ...(splits.get(segment.id) ?? [])])
    const ordered = [...cuts].sort((a, b) => a[0] - b[0])
    for (let i = 1; i < ordered.length; i++) {
      const [fromDistance, from] = ordered[i - 1], [toDistance, to] = ordered[i]
      if (from === to) continue
      const points = sliceShape(segment.shape, fromDistance, toDistance)
      if (points) addBoth(graph, from, to, points, segment.id)
    }
  }
  return { graph, projections }
}

export function applyLausanneRailGeometry(snapshot, network, routes, networks = lausanneRailNetworks(network)) {
  const paths = [], pathIndexes = new Map(), edgeCounts = new Map(), groups = new Map(), issues = [], snaps = []
  for (const train of snapshot.trains) {
    const group = lausanneRailGroup(train, routes)
    assert(group && networks[group], `Unsupported Lausanne rail service ${train.id}`)
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(train)
  }
  const updated = new Map()
  for (const [group, trains] of groups) {
    const indices = [...new Set(trains.flatMap(train => train.stops.map(([index]) => index)))]
    const { graph, projections } = projectedRailGraph(networks[group], snapshot.stops, indices)
    for (const index of indices) {
      const projection = projections.get(index)
      snaps.push({ group, stopId: snapshot.stops[index][4], stop: snapshot.stops[index][2], segmentId: projection?.segmentId ?? null, snapMetres: projection ? Number(projection.snapMetres.toFixed(2)) : null })
    }
    const pairs = new Map()
    for (const train of trains) {
      const pathSegments = train.stops.slice(1).map(([to], i) => {
        const from = train.stops[i][0], key = `${from}:${to}`
        if (!pairs.has(key)) {
          const a = projections.get(from), b = projections.get(to)
          const start = snapshot.stops[from], end = snapshot.stops[to]
          const maxDistance = Math.max(LAUSANNE_RAIL_LIMITS.detourAllowanceMetres, distanceMetres(start, end) * LAUSANNE_RAIL_LIMITS.maxDetourRatio)
          const edges = a && b ? shortest(graph, a.key, b.key, maxDistance) : undefined
          const points = edges?.length ? [start.slice(0, 2), ...edges.flatMap(edge => edge.points), end.slice(0, 2)]
            .map(point => point.map(value => Number(value.toFixed(6))))
            .filter((point, j, all) => !j || distanceMetres(all[j - 1], point) > 0.01) : undefined
          let index = null
          if (points?.length >= 2 && lengthOf(points) <= maxDistance) {
            const signature = JSON.stringify(points)
            if (!pathIndexes.has(signature)) { pathIndexes.set(signature, paths.length); paths.push(points) }
            index = pathIndexes.get(signature)
          } else issues.push({ group, fromId: start[4], toId: end[4], from: start[2], to: end[2], reason: !a || !b ? 'stop-outside-corridor' : a.key === b.key ? 'coincident-projections' : 'disconnected-or-excessive-detour' })
          pairs.set(key, index)
        }
        const index = pairs.get(key)
        if (index !== null) {
          const edgeKey = [from, to].sort((a, b) => a - b).join(':')
          const counts = edgeCounts.get(edgeKey) ?? new Map()
          counts.set(index, (counts.get(index) ?? 0) + 1)
          edgeCounts.set(edgeKey, counts)
        }
        return index
      })
      updated.set(train.id, { ...train, pathSegments })
    }
  }
  const trains = snapshot.trains.map(train => updated.get(train.id))
  return { paths, trains, edgePaths: snapshot.edges.map(([a, b]) => {
    const counts = edgeCounts.get([a, b].sort((a, b) => a - b).join(':'))
    return counts ? [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0] : null
  }), totalSegments: trains.reduce((sum, train) => sum + train.pathSegments.length, 0), matchedSegments: trains.reduce((sum, train) => sum + train.pathSegments.filter(index => index !== null).length, 0), projectionAudit: { limits: LAUSANNE_RAIL_LIMITS, snaps, issues } }
}
