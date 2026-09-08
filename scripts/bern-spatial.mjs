import assert from 'node:assert/strict'

// swisstopo approximate CH1903+/WGS84 formula, as used by the existing rail
// pipeline. Metre-level transformation, not CHENyx06 survey precision.
export function bernWgs84([east, north]) {
  const y = (east - 2600000) / 1000000, x = (north - 1200000) / 1000000
  return [(2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y ** 3) * 100 / 36,
    (16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x ** 3) * 100 / 36]
}

export function bernLv95([lon, lat]) {
  const x = (lat * 3600 - 169028.66) / 10000, y = (lon * 3600 - 26782.5) / 10000
  return [2600072.37 + 211455.93 * y - 10938.51 * y * x - 0.36 * y * x * x - 44.54 * y ** 3,
    1200147.07 + 308807.95 * x + 3745.25 * y * y + 76.63 * x * x - 194.56 * y * y * x + 119.79 * x ** 3]
}

function inRing([x, y], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

export function bernArea(geometry) {
  assert(['Polygon', 'MultiPolygon'].includes(geometry.type))
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const xs = polygons.flatMap(p => p[0].map(c => c[0])), ys = polygons.flatMap(p => p[0].map(c => c[1]))
  const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  return point => point[0] >= bounds[0] && point[0] <= bounds[2] && point[1] >= bounds[1] && point[1] <= bounds[3]
    && polygons.some(p => inRing(point, p[0]) && !p.slice(1).some(hole => inRing(point, hole)))
}

export function bernBoundaryGap(point, geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let nearest = Infinity
  for (const polygon of polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], dx = b[0] - a[0], dy = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
    nearest = Math.min(nearest, Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy))
  }
  return nearest
}
