// Offline cartographic routing inside lake polygons. This is not a shipping-lane
// or navigational model; boundaries (including islands) are hard constraints.
const EPSILON = 1e-9
const cross = (a, b) => a[0] * b[1] - a[1] * b[0]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

export function distanceMetres(a, b) {
  return Math.hypot((a[0] - b[0]) * Math.cos((a[1] + b[1]) * Math.PI / 360) * 111320, (a[1] - b[1]) * 111320)
}

function onSegment(p, a, b) {
  const d = sub(b, a), q = sub(p, a)
  const length = Math.hypot(...d), tolerance = EPSILON * length
  return Math.abs(cross(d, q)) <= tolerance && q[0] * d[0] + q[1] * d[1] >= -tolerance && q[0] * d[0] + q[1] * d[1] <= length ** 2 + tolerance
}

function ringContains(p, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if (onSegment(p, a, b) && distanceMetres(a, b) > 0.001) return 0
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside ? 1 : -1
}

export function inWater(point, polygon) {
  return ringContains(point, polygon[0]) >= 0 && polygon.slice(1).every(ring => ringContains(point, ring) <= 0)
}

/** Split at every boundary intersection, then check each open interval. Unlike
 * fixed-step sampling this cannot skip a narrow island or a thin headland.
 */
export function segmentInWater(a, b, polygon) {
  if (!inWater(a, polygon) || !inWater(b, polygon)) return false
  const d = sub(b, a), cuts = [0, 1]
  for (const ring of polygon) for (let i = 0; i < ring.length; i++) {
    const c = ring[i], e = sub(ring[(i + 1) % ring.length], c), q = sub(c, a)
    const denominator = cross(d, e)
    if (Math.abs(denominator) < 1e-15) continue
    const t = cross(q, e) / denominator, u = cross(q, d) / denominator
    if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t)
  }
  cuts.sort((a, b) => a - b)
  return cuts.slice(1).every((t, i) => inWater(lerp(a, b, (t + cuts[i]) / 2), polygon))
}

function projectToWater(point, polygon, maxOffset) {
  if (inWater(point, polygon)) return { point: point.slice(0, 2), offset: 0 }
  let best
  const scale = Math.cos(point[1] * Math.PI / 180)
  for (const ring of polygon) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    const d = [(b[0] - a[0]) * scale, b[1] - a[1]], q = [(point[0] - a[0]) * scale, point[1] - a[1]]
    const norm = d[0] ** 2 + d[1] ** 2
    if (!norm) continue
    const p = lerp(a, b, Math.max(0, Math.min(1, (q[0] * d[0] + q[1] * d[1]) / norm)))
    const offset = distanceMetres(point, p)
    if (!best || offset < best.offset) best = { point: p, offset }
  }
  return best && best.offset <= maxOffset ? best : undefined
}

export function createWaterRouter(polygon, { maxDockOffsetMetres = 150 } = {}) {
  const vertices = polygon.flatMap(ring => ring.filter((p, i) => i === 0 || distanceMetres(p, ring[0]) > 0.001))
  const graph = vertices.map(() => [])
  for (let i = 0; i < vertices.length; i++) for (let j = 0; j < i; j++) {
    if (!segmentInWater(vertices[i], vertices[j], polygon)) continue
    const weight = distanceMetres(vertices[i], vertices[j])
    graph[i].push([j, weight]); graph[j].push([i, weight])
  }
  return (from, to) => {
    const a = projectToWater(from, polygon, maxDockOffsetMetres), b = projectToWater(to, polygon, maxDockOffsetMetres)
    if (!a || !b) return undefined
    const points = [...vertices, a.point, b.point], start = vertices.length, end = start + 1
    const links = [...graph.map(edges => [...edges]), [], []]
    for (const i of [start, end]) for (let j = 0; j < i; j++) {
      if (!segmentInWater(points[i], points[j], polygon)) continue
      const weight = distanceMetres(points[i], points[j])
      links[i].push([j, weight]); links[j].push([i, weight])
    }
    const distances = points.map(() => Infinity), previous = [], visited = new Set()
    distances[start] = 0
    while (!visited.has(end)) {
      let current = -1
      for (let i = 0; i < points.length; i++) if (!visited.has(i) && (current < 0 || distances[i] < distances[current])) current = i
      if (current < 0 || !Number.isFinite(distances[current])) return undefined
      visited.add(current)
      for (const [next, weight] of links[current]) if (distances[current] + weight < distances[next]) {
        distances[next] = distances[current] + weight; previous[next] = current
      }
    }
    const path = []
    for (let i = end; i !== undefined; i = previous[i]) { path.unshift(points[i]); if (i === start) break }
    if (!path.slice(1).every((p, i) => segmentInWater(path[i], p, polygon))) throw new Error('Water route escaped its polygon')
    return { path, lengthMetres: distances[end], dockOffsetsMetres: [a.offset, b.offset] }
  }
}
