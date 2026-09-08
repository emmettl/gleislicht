import * as THREE from 'three'
import type { RoadTopologySnapshot } from '@motionstudies/core/domain/road'

type Coordinate = readonly [number, number]
const metric = ([lon, lat]: Coordinate) => new THREE.Vector2(lon * 75_800, lat * 111_200)

/** Arc-length interpolation on the actual polyline: no spline corner cutting. */
export class RoadPolyline {
  private lengths: number[] = [0]
  readonly points: THREE.Vector3[]
  constructor(points: THREE.Vector3[]) {
    this.points = points
    for (let i = 1; i < points.length; i++) this.lengths.push(this.lengths[i - 1] + points[i].distanceTo(points[i - 1]))
  }
  getPointAt(t: number, target = new THREE.Vector3()) {
    const distance = THREE.MathUtils.clamp(t, 0, 1) * this.lengths.at(-1)!
    let lo = 1, hi = this.lengths.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.lengths[mid] < distance) lo = mid + 1
      else hi = mid
    }
    const length = this.lengths[lo] - this.lengths[lo - 1]
    return target.copy(this.points[lo - 1]).lerp(this.points[lo], length ? (distance - this.lengths[lo - 1]) / length : 0)
  }
  getPoints() { return this.points }
}

interface Node { coordinate: Coordinate; point: THREE.Vector2; edges: Map<number, number> }
const cache = new WeakMap<RoadTopologySnapshot, Map<string, ReturnType<typeof roadGraph>>>()
function roadGraph(topology: RoadTopologySnapshot, road: string) {
  const nodes: Node[] = []
  const cells = new Map<string, number[]>()
  const segments: [number, number, string][] = []
  // Join only coincident official vertices (allowing coordinate rounding).
  const nodeFor = (coordinate: Coordinate) => {
    const point = metric(coordinate), x = Math.floor(point.x / 2), y = Math.floor(point.y / 2)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const index of cells.get(`${x + dx}:${y + dy}`) ?? []) {
        if (nodes[index].point.distanceTo(point) <= 2) return index
      }
    }
    const key = `${x}:${y}`, index = nodes.length
    cells.set(key, [...cells.get(key) ?? [], index])
    nodes.push({ coordinate, point, edges: new Map() })
    return index
  }
  for (const path of topology.paths.filter(path => path.road === road)) {
    const indexes = path.points.map(nodeFor)
    for (let i = 1; i < indexes.length; i++) {
      const a = indexes[i - 1], b = indexes[i]
      if (a === b) continue
      const length = nodes[a].point.distanceTo(nodes[b].point)
      nodes[a].edges.set(b, length); nodes[b].edges.set(a, length)
      segments.push([a, b, path.id])
    }
  }
  const snap = (coordinate: Coordinate, segmentId?: string) => {
    const point = metric(coordinate)
    let best: { a: number; b: number; t: number; coordinate: Coordinate; distance: number } | undefined
    for (const [a, b, pathId] of segments) {
      if (segmentId && segmentId !== pathId) continue
      const start = nodes[a].point, delta = nodes[b].point.clone().sub(start)
      const t = THREE.MathUtils.clamp(point.clone().sub(start).dot(delta) / delta.lengthSq(), 0, 1)
      const distance = start.clone().addScaledVector(delta, t).distanceTo(point)
      if (!best || distance < best.distance) best = { a, b, t, distance, coordinate: [
        nodes[a].coordinate[0] + t * (nodes[b].coordinate[0] - nodes[a].coordinate[0]),
        nodes[a].coordinate[1] + t * (nodes[b].coordinate[1] - nodes[a].coordinate[1]),
      ] }
    }
    return best && best.distance <= 120 ? best : undefined
  }
  return { nodes, snap }
}

/** Recover missing counter paths from connected official axes; never bridge a gap. */
export function roadPathOnTopology(topology: RoadTopologySnapshot, road: string, from: Coordinate, to: Coordinate, fromSegment?: string, toSegment?: string): Coordinate[] | undefined {
  let graphs = cache.get(topology)
  if (!graphs) { graphs = new Map(); cache.set(topology, graphs) }
  let graph = graphs.get(road)
  if (!graph) { graph = roadGraph(topology, road); graphs.set(road, graph) }
  const { nodes, snap } = graph, start = snap(from, fromSegment), end = snap(to, toSegment)
  if (!start || !end) return
  if (start.a === end.a && start.b === end.b) return [start.coordinate, end.coordinate]
  const distances = new Map<number, number>(), previous = new Map<number, number>()
  const queue: [number, number][] = []
  const push = (id: number, distance: number) => {
    if (distance >= (distances.get(id) ?? Infinity)) return
    distances.set(id, distance)
    let i = queue.length; queue.push([id, distance])
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (queue[parent][1] <= distance) break
      queue[i] = queue[parent]; i = parent
    }
    queue[i] = [id, distance]
  }
  const startLength = nodes[start.a].edges.get(start.b)!
  push(start.a, startLength * start.t); push(start.b, startLength * (1 - start.t))
  const endLength = nodes[end.a].edges.get(end.b)!
  let finish: number | undefined, best = Infinity
  while (queue.length) {
    const [id, distance] = queue[0], last = queue.pop()!
    if (queue.length) {
      let i = 0
      while (i * 2 + 1 < queue.length) {
        let child = i * 2 + 1
        if (child + 1 < queue.length && queue[child + 1][1] < queue[child][1]) child++
        if (queue[child][1] >= last[1]) break
        queue[i] = queue[child]; i = child
      }
      queue[i] = last
    }
    if (distance !== distances.get(id)) continue
    if (distance >= best || distance > 35_000) break
    const tail = id === end.a ? endLength * end.t : id === end.b ? endLength * (1 - end.t) : Infinity
    if (distance + tail < best) { best = distance + tail; finish = id }
    for (const [next, length] of nodes[id].edges) {
      if (distance + length < (distances.get(next) ?? Infinity)) {
        previous.set(next, id); push(next, distance + length)
      }
    }
  }
  if (finish === undefined || best > Math.max(1000, metric(from).distanceTo(metric(to)) * 3)) return
  const path: Coordinate[] = [end.coordinate]
  for (let id: number | undefined = finish; id !== undefined; id = previous.get(id)) path.push(nodes[id].coordinate)
  path.push(start.coordinate)
  return path.reverse()
}
