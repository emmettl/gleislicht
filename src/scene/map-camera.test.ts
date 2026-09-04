import { describe, expect, it } from 'vitest'
import {
  applyMapZoom,
  homeMapDistanceScale,
  MAX_MAP_DISTANCE_SCALE,
  MIN_MAP_DISTANCE_SCALE,
} from './map-camera.ts'

describe('map camera zoom', () => {
  it('uses a closer home framing for the Zürich study', () => {
    expect(homeMapDistanceScale('switzerland')).toBe(1)
    expect(homeMapDistanceScale('zvv')).toBeCloseTo(0.24)
    expect(homeMapDistanceScale('geneva')).toBeCloseTo(0.13)
    expect(homeMapDistanceScale('zurich')).toBeCloseTo(0.06)
    expect(homeMapDistanceScale('zurich')).toBeGreaterThan(MIN_MAP_DISTANCE_SCALE)
  })

  it('preserves direct movement inside the useful zoom range', () => {
    expect(applyMapZoom(1, 0.9)).toBeCloseTo(0.9)
    expect(applyMapZoom(0.8, 1.1)).toBeCloseTo(0.88)
  })

  it('eases toward the outer boundary without entering the fog', () => {
    const first = applyMapZoom(1, 1.4)
    const second = applyMapZoom(first, 1.4)

    expect(first).toBeGreaterThan(1)
    expect(second).toBeGreaterThan(first)
    expect(second).toBeLessThan(MAX_MAP_DISTANCE_SCALE)
  })

  it('also softens the closest zoom boundary', () => {
    const result = applyMapZoom(0.025, 0.5)

    expect(result).toBeGreaterThan(MIN_MAP_DISTANCE_SCALE)
    expect(result).toBeLessThan(0.025)
  })

  it('provides several close-range steps below the previous limit', () => {
    const first = applyMapZoom(0.3, 0.78)
    const second = applyMapZoom(first, 0.78)
    const third = applyMapZoom(second, 0.78)

    expect(first).toBeLessThan(0.3)
    expect(second).toBeLessThan(first)
    expect(third).toBeLessThan(second)
    expect(third).toBeGreaterThan(MIN_MAP_DISTANCE_SCALE)
  })
})
