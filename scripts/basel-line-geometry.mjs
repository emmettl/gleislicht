import assert from 'node:assert/strict'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export const BASEL_AGENCIES = { '823': 'BVB', '37': 'BLT' }
export const BASEL_PATH_LIMITS = { snapMetres: 120, detourRatio: 4.5, detourFloorMetres: 1200, alternativeSnapMetres: 5 }
const routeKey = (agency, mode, line) => `${agency}:${mode}:${String(line).trim()}`
const pointKey = point => point.map(value => value.toFixed(7)).join(',')

export function baselGraphs(collections) {
  const graphs = new Map()
  for (const collection of collections) {
    assert.equal(collection.type, 'FeatureCollection')
    for (const feature of collection.features) {
      const p = feature.properties
      const mode = { Tram: 'tram', Bus: 'bus' }[p?.ln_verkehrsmittel]
      assert(mode && p.ln_liniennr && p.ln_tu, 'Missing Basel line identity')
      assert(['LineString', 'MultiLineString'].includes(feature.geometry?.type), 'Invalid Basel geometry type')
      const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates
      const operators = p.ln_tu.split('/').map(value => value.trim())
      for (const [agency, operator] of Object.entries(BASEL_AGENCIES)) {
        if (!operators.includes(operator)) continue
        const key = routeKey(agency, mode, p.ln_liniennr)
        const graph = graphs.get(key) ?? { points: [], indexes: new Map(), adjacency: [], edges: [], parts: [] }
        const index = point => {
          assert(point.length === 2 && point.every(Number.isFinite), 'Invalid Basel coordinates')
          assert(point[0] >= 7 && point[0] <= 8.5 && point[1] >= 47 && point[1] <= 48, 'Basel source is not WGS84 longitude/latitude')
          const id = pointKey(point)
          if (!graph.indexes.has(id)) {
            graph.indexes.set(id, graph.points.length)
            graph.points.push(point)
            graph.adjacency.push([])
          }
          return graph.indexes.get(id)
        }
        for (const line of lines) {
          assert(line.length >= 2, 'Empty Basel line')
          const part = []
          for (let i = 1; i < line.length; i++) {
            const a = index(line[i - 1]), b = index(line[i])
            if (a === b) continue
            const length = distanceMetres(graph.points[a], graph.points[b])
            const edge = { a, b, length }
            graph.edges.push(edge); part.push(edge)
            // The source does not declare a directed routing graph. These
            // inferred candidates need separate one-way/track review.
            graph.adjacency[a].push([b, length])
            graph.adjacency[b].push([a, length])
          }
          graph.parts.push(part)
        }
        graphs.set(key, graph)
      }
    }
  }
  return graphs
}

function project(point, a, b) {
  const scale = Math.cos(point[1] * Math.PI / 180)
  const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, (((point[0] - a[0]) * scale) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)))
  const coordinate = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
  return { coordinate, t, gap: distanceMetres(point, coordinate) }
}

function snap(graph, stop) {
  const candidates = []
  for (const part of graph.parts) {
    let best
    for (const edge of part) {
      const candidate = { ...project(stop, graph.points[edge.a], graph.points[edge.b]), edge }
      if (!best || candidate.gap < best.gap) best = candidate
    }
    if (best) candidates.push(best)
  }
  return candidates.sort((a, b) => a.gap - b.gap)
}

class Heap {
  items = []
  push(item) {
    let i = this.items.length
    this.items.push(item)
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.items[parent][0] <= item[0]) break
      this.items[i] = this.items[parent]; i = parent
    }
    this.items[i] = item
  }
  pop() {
    const first = this.items[0], last = this.items.pop()
    if (this.items.length) {
      let i = 0
      while (i * 2 + 1 < this.items.length) {
        let child = i * 2 + 1
        if (child + 1 < this.items.length && this.items[child + 1][0] < this.items[child][0]) child++
        if (this.items[child][0] >= last[0]) break
        this.items[i] = this.items[child]; i = child
      }
      this.items[i] = last
    }
    return first
  }
}

export function matchBaselSegment(graph, from, to, limits = BASEL_PATH_LIMITS, { compareNearbyParts = false } = {}) {
  if (!graph?.edges.length) return { reason: 'missing-line' }
  const starts = snap(graph, from), ends = snap(graph, to)
  const initial = projectedPath(graph, from, to, starts[0], ends[0], limits)
  // Preserve successful nearest line matches. Only retry topology failures using
  // another source part's nearest projection, within five metres of the best
  // gap at each endpoint. This adds no edges or cross-track connections.
  // A shared infrastructure graph can contain many near-coincident source
  // lines. Diversions may compare their paths even when the nearest passes.
  if (!['disconnected-line', 'implausible-detour'].includes(initial.reason) && !(compareNearbyParts && initial.path)) return initial
  const allowance = limits.alternativeSnapMetres ?? BASEL_PATH_LIMITS.alternativeSnapMetres
  const near = candidates => candidates.filter(candidate => candidate.gap <= limits.snapMetres && candidate.gap <= candidates[0].gap + allowance)
  let best = compareNearbyParts && initial.path ? initial : undefined
  let score = best ? best.pathMetres : Infinity, bestGap = starts[0].gap + ends[0].gap
  for (const start of near(starts)) for (const end of near(ends)) {
    if (start === starts[0] && end === ends[0]) continue
    const result = projectedPath(graph, from, to, start, end, limits)
    const gap = start.gap + end.gap
    const nextScore = compareNearbyParts ? result.pathMetres : gap
    const tieBreak = compareNearbyParts ? gap : result.pathMetres
    const previousTieBreak = compareNearbyParts ? bestGap : best?.pathMetres
    if (!result.path || nextScore > score || (nextScore === score && tieBreak >= previousTieBreak)) continue
    score = nextScore; bestGap = gap
    best = { ...result, projectionChoice: {
      initialReason: initial.reason ?? 'longer-nearest-path', nearestMaximumSnapMetres: initial.maximumSnapMetres,
      maximumAdditionalSnapMetres: Math.max(start.gap - starts[0].gap, end.gap - ends[0].gap),
    } }
  }
  return best ?? initial
}

function projectedPath(graph, from, to, start, end, limits) {
  const maximumSnapMetres = Math.max(start.gap, end.gap)
  if (maximumSnapMetres > limits.snapMetres) return { reason: 'endpoint-gap', maximumSnapMetres }
  let best = Infinity, bestPoints
  if (start.edge === end.edge) {
    best = Math.abs(start.t - end.t) * start.edge.length
    bestPoints = [start.coordinate, end.coordinate]
  }
  const distances = new Map(), previous = new Map(), heap = new Heap()
  for (const [node, distance] of [[start.edge.a, start.t * start.edge.length], [start.edge.b, (1 - start.t) * start.edge.length]]) {
    distances.set(node, distance); previous.set(node, null); heap.push([distance, node])
  }
  let bestEnd
  const goals = new Map([[end.edge.a, end.t * end.edge.length], [end.edge.b, (1 - end.t) * end.edge.length]])
  while (heap.items.length) {
    const [distance, node] = heap.pop()
    if (distance !== distances.get(node)) continue
    if (distance >= best) break
    if (goals.has(node) && distance + goals.get(node) < best) {
      best = distance + goals.get(node); bestEnd = node
    }
    for (const [next, length] of graph.adjacency[node]) {
      const total = distance + length
      if (total >= (distances.get(next) ?? Infinity)) continue
      distances.set(next, total); previous.set(next, node); heap.push([total, next])
    }
  }
  if (bestEnd !== undefined) {
    const chain = []
    for (let node = bestEnd; node !== null; node = previous.get(node)) chain.push(graph.points[node])
    bestPoints = [start.coordinate, ...chain.reverse(), end.coordinate]
  }
  if (!bestPoints) return { reason: 'disconnected-line', maximumSnapMetres }
  const direct = distanceMetres(from, to)
  if (best > Math.max(limits.detourFloorMetres, direct * limits.detourRatio)) return { reason: 'implausible-detour', maximumSnapMetres, pathMetres: best }
  // Endpoint connectors must not conceal two different stops collapsing onto
  // one graph point, or a mostly off-network movement.
  if (best < 1 || (direct > 30 && best < direct * 0.5)) return { reason: 'collapsed-path', maximumSnapMetres, pathMetres: best }
  const path = [from.slice(0, 2), ...bestPoints, to.slice(0, 2)]
    .map(point => point.map(value => Number(value.toFixed(7))))
    .filter((point, i, points) => !i || pointKey(point) !== pointKey(points[i - 1]))
  return { path, maximumSnapMetres, pathMetres: best }
}

export function applyBaselGeometry(snapshot, routes, graphs, diversions) {
  const paths = [], signatures = new Map(), segments = new Map(), groups = new Map(), routeCoverage = new Map(), edges = new Map()
  const trains = snapshot.trains.map(train => {
    const route = routes.get(train.routeId)
    assert(route && BASEL_AGENCIES[route.agencyId] && ['bus', 'tram'].includes(train.category), 'Unexpected Basel candidate route')
    const groupKey = `${BASEL_AGENCIES[route.agencyId]}-${train.category}`
    const group = groups.get(groupKey) ?? { id: groupKey, trips: 0, matched: 0, total: 0 }
    const counts = routeCoverage.get(train.routeId) ?? { routeId: train.routeId, agencyId: route.agencyId, line: train.route, mode: train.category, trips: 0, matched: 0, total: 0 }
    group.trips++; counts.trips++
    const pathSegments = train.stops.slice(1).map(([toIndex], i) => {
      const fromIndex = train.stops[i][0], from = snapshot.stops[fromIndex], to = snapshot.stops[toIndex]
      const key = `${train.routeId}:${from[4]}:${to[4]}`
      if (!segments.has(key)) {
        let result = matchBaselSegment(graphs.get(routeKey(route.agencyId, train.category, train.route)), from, to)
        if (!result.path && diversions) {
          const candidate = diversions.match(route, train, from, to)
          if (candidate?.path) result = { ...candidate, lineGeometryReason: result.reason }
          else if (candidate) result = { ...result, diversionAttempt: candidate }
        }
        let pathIndex = null
        if (result.path) {
          const signature = JSON.stringify(result.path)
          if (!signatures.has(signature)) { signatures.set(signature, paths.length); paths.push(result.path) }
          pathIndex = signatures.get(signature)
        }
        const { path: _path, ...assessment } = result
        segments.set(key, { routeId: train.routeId, agencyId: route.agencyId, line: train.route, mode: train.category, from: from[2], to: to[2], fromId: from[4], toId: to[4], occurrences: 0, pathIndex, ...assessment })
      }
      const segment = segments.get(key); segment.occurrences++; group.total++; counts.total++
      if (segment.pathIndex !== null) {
        group.matched++; counts.matched++
        const edgeKey = [fromIndex, toIndex].sort((a, b) => a - b).join(':')
        const weights = edges.get(edgeKey) ?? new Map()
        weights.set(segment.pathIndex, (weights.get(segment.pathIndex) ?? 0) + 1); edges.set(edgeKey, weights)
      }
      return segment.pathIndex
    })
    groups.set(groupKey, group); routeCoverage.set(train.routeId, counts)
    return { ...train, pathSegments }
  })
  const edgePaths = snapshot.edges.map(pair => {
    const weights = edges.get([...pair].sort((a, b) => a - b).join(':'))
    return weights ? [...weights].sort((a, b) => b[1] - a[1])[0][0] : null
  })
  return { paths, trains, edgePaths,
    groups: [...groups.values()].map(group => ({ ...group, coverage: group.matched / group.total })),
    routes: [...routeCoverage.values()].map(route => ({ ...route, coverage: route.matched / route.total })),
    segments: [...segments.values()],
  }
}
