import { describe, expect, it } from 'vitest'
import {
  applyMapZoom,
  MAX_MAP_DISTANCE_SCALE,
  MIN_MAP_DISTANCE_SCALE,
} from './map-camera.ts'

describe('map camera zoom', () => {
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
    const result = applyMapZoom(0.34, 0.5)

    expect(result).toBeGreaterThan(MIN_MAP_DISTANCE_SCALE)
    expect(result).toBeLessThan(0.34)
  })
})
