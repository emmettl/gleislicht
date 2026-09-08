import { describe, expect, it } from 'vitest'
import { createOrbitalSurface, insideOrbitalRing, orbitalLandIndices, orbitalXZ, ORBITAL_HEIGHT_SCALE, type OrbitalTerrain } from './orbital-terrain.ts'
const terrain: OrbitalTerrain = { version: 1, bounds: { west: 8, east: 9, south: 46, north: 47 }, columns: 2, rows: 2, elevations: [0, 1000, 2000, 0], metadata: { source: 'test', releaseDate: '2026-09-08', gridSpacingMetres: [100, 100], attribution: 'test' } }
describe('orbital relief', () => {
  it('samples the rendered triangular surface, including a non-planar saddle', () => {
    const surface = createOrbitalSurface(terrain)
    const point = (lon: number, lat: number) => surface.height(...orbitalXZ(lon, lat)) / ORBITAL_HEIGHT_SCALE
    expect(point(8, 47)).toBeCloseTo(0)
    expect(point(9, 47)).toBeCloseTo(1000)
    expect(point(8, 46)).toBeCloseTo(2000)
    expect(point(8.5, 46.5)).toBeCloseTo(1500)
    expect(point(8.25, 46.75)).toBeCloseTo(750)
    expect(point(8.75, 46.25)).toBeCloseTo(750)
    expect(surface.height(...orbitalXZ(11, 48))).toBe(0)
  })
  it('preserves flat lake cells and rejects missing source heights', () => {
    const lake = createOrbitalSurface({ ...terrain, elevations: [372, 372, 372, 372] })
    expect(lake.height(...orbitalXZ(8.6, 46.3)) / ORBITAL_HEIGHT_SCALE).toBeCloseTo(372)
    expect(() => createOrbitalSurface({ ...terrain, elevations: [1, 2, 3] })).toThrow()
    expect(() => createOrbitalSurface({ ...terrain, elevations: [1, -9999, 3, 4] })).toThrow()
  })
  it('clips the grid to the country and uses upward-facing triangle winding', () => {
    const surface = createOrbitalSurface(terrain)
    const ring = [[-10, -10], [10, -10], [10, 20], [-10, 20]]
    expect(insideOrbitalRing(0, 0, ring)).toBe(true)
    expect(insideOrbitalRing(11, 0, ring)).toBe(false)
    expect([...orbitalLandIndices(surface, [ring])]).toEqual([0, 2, 1, 1, 2, 3])
    expect([...orbitalLandIndices(surface, [[[40, 40], [50, 40], [50, 50], [40, 50]]])]).toEqual([])
  })
  it('uses a bounded coarse shadow mesh while preserving the full-resolution positions', () => {
    const surface = createOrbitalSurface({ ...terrain, columns: 5, rows: 5, elevations: Array(25).fill(400) })
    const ring = [[-10, -10], [10, -10], [10, 20], [-10, 20]]
    const full = orbitalLandIndices(surface, [ring]), coarse = orbitalLandIndices(surface, [ring], 3)
    expect(full).toBeInstanceOf(Uint32Array)
    expect(full.length).toBe(96); expect(coarse.length).toBe(24)
    expect(Math.max(...coarse)).toBe(24)
    expect(coarse.every(index => index >= 0 && index < surface.positions.length / 3)).toBe(true)
  })
})
