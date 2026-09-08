export interface OrbitalTerrain {
  version: number
  bounds: { west: number; east: number; south: number; north: number }
  columns: number
  rows: number
  elevations: number[]
  lakeElevations?: Record<string, number>
  metadata: { source: string; releaseDate: string; gridSpacingMetres: number[]; attribution: string }
}
export const ORBITAL_RELIEF = 4.5
export const ORBITAL_HEIGHT_SCALE = 12 / 111320 * ORBITAL_RELIEF
export const orbitalXZ = (lon: number, lat: number): [number, number] => [(lon - 8.23) * Math.cos(46.8 * Math.PI / 180) * 12, -(lat - 46.8) * 12]
export interface OrbitalSurface { height: (x: number, z: number) => number; positions: Float32Array; columns: number; rows: number }
export function createOrbitalSurface(terrain: OrbitalTerrain): OrbitalSurface {
  const { columns, rows, bounds, elevations } = terrain
  if (terrain.version !== 1 || columns < 2 || rows < 2 || !Number.isInteger(columns) || !Number.isInteger(rows) || columns * rows !== elevations.length || !elevations.every(v => Number.isFinite(v) && v >= 0 && v < 6000)) throw new Error('Invalid orbital terrain')
  const [west, north] = orbitalXZ(bounds.west, bounds.north), [east, south] = orbitalXZ(bounds.east, bounds.south)
  if (!(east > west && south > north)) throw new Error('Invalid orbital terrain bounds')
  const positions = new Float32Array(columns * rows * 3)
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const i = row * columns + col
    positions[i * 3] = west + col / (columns - 1) * (east - west)
    positions[i * 3 + 1] = elevations[i] * ORBITAL_HEIGHT_SCALE
    positions[i * 3 + 2] = north + row / (rows - 1) * (south - north)
  }
  return { positions, columns, rows, height(x, z) {
    if (x < west || x > east || z < north || z > south) return 0
    const gx = (x - west) / (east - west) * (columns - 1), gy = (z - north) / (south - north) * (rows - 1)
    const col = Math.min(columns - 2, Math.floor(gx)), row = Math.min(rows - 2, Math.floor(gy)), fx = gx - col, fy = gy - row
    const a = row * columns + col, b = a + 1, c = a + columns, d = c + 1
    const h = (i: number) => positions[i * 3 + 1]
    // Match the two actual mesh triangles rather than a bilinear patch, so
    // moving lights and trail samples cannot sink into a non-planar cell.
    return fx + fy <= 1 ? h(a) + (h(b) - h(a)) * fx + (h(c) - h(a)) * fy : h(d) + (h(b) - h(d)) * (1 - fy) + (h(c) - h(d)) * (1 - fx)
  } }
}
export function insideOrbitalRing(x: number, z: number, ring: readonly (readonly number[])[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

export function orbitalLandIndices(surface: OrbitalSurface, rings: number[][][], stride = 1): Uint32Array {
  const { columns, rows, positions } = surface, mask = new Uint8Array(columns * rows)
  // Scanline polygon fill avoids testing every terrain vertex against every
  // country-border segment on the browser's main thread.
  for (let row = 0; row < rows; row++) {
    const z = positions[row * columns * 3 + 2], crossings: number[] = []
    for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j]
      if ((a[1] > z) !== (b[1] > z)) crossings.push(a[0] + (z - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
    }
    crossings.sort((a, b) => a - b)
    let crossing = 0
    for (let col = 0; col < columns; col++) {
      while (crossing < crossings.length && crossings[crossing] <= positions[(row * columns + col) * 3]) crossing++
      mask[row * columns + col] = crossing % 2
    }
  }
  // Count first, then fill one exact GPU index buffer. A growing JavaScript
  // array plus Three's copy caused large temporary allocations on fine terrain.
  let count = 0
  const visit = (write: boolean, indices?: Uint32Array) => {
    for (let row = 0; row < rows - 1; row += stride) for (let col = 0; col < columns - 1; col += stride) {
      const nextRow = Math.min(rows - 1, row + stride), nextCol = Math.min(columns - 1, col + stride)
      const a = row * columns + col, b = row * columns + nextCol, c = nextRow * columns + col, d = nextRow * columns + nextCol
      if (mask[a] || mask[b] || mask[c]) { if (write) { indices![count] = a; indices![count + 1] = c; indices![count + 2] = b }; count += 3 }
      if (mask[b] || mask[c] || mask[d]) { if (write) { indices![count] = b; indices![count + 1] = c; indices![count + 2] = d }; count += 3 }
    }
  }
  visit(false)
  const indices = new Uint32Array(count)
  count = 0; visit(true, indices)
  return indices
}
