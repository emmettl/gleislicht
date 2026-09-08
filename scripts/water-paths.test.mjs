import { describe, expect, it } from 'vitest'
import { createWaterRouter, segmentInWater } from './water-paths.mjs'

describe('cartographic water paths', () => {
  it('routes around a headland instead of crossing land', () => {
    const polygon = [[[8, 47], [8.04, 47], [8.04, 47.04], [8.025, 47.04], [8.025, 47.01], [8.015, 47.01], [8.015, 47.04], [8, 47.04], [8, 47]]]
    const a = [8.01, 47.03], b = [8.03, 47.03]
    expect(segmentInWater(a, b, polygon)).toBe(false)
    const result = createWaterRouter(polygon)(a, b)
    expect(result.path.length).toBeGreaterThan(2)
    expect(result.path.slice(1).every((p, i) => segmentInWater(result.path[i], p, polygon))).toBe(true)
  })
  it('detects narrow islands between sample points and routes around holes', () => {
    const polygon = [[[8, 47], [8.1, 47], [8.1, 47.1], [8, 47.1]], [[8.04999, 47.04], [8.05001, 47.04], [8.05001, 47.06], [8.04999, 47.06]]]
    const a = [8.01, 47.05], b = [8.09, 47.05]
    expect(segmentInWater(a, b, polygon)).toBe(false)
    const route = createWaterRouter(polygon)
    expect(route(a, b).path.length).toBeGreaterThan(2)
    expect(route(a, b).lengthMetres).toBeCloseTo(route(b, a).lengthMetres)
  })
  it('snaps only nearby dock coordinates and rejects far inland endpoints', () => {
    const polygon = [[[8, 47], [8.1, 47], [8.1, 47.1], [8, 47.1]]]
    const route = createWaterRouter(polygon)
    expect(route([7.999, 47.05], [8.05, 47.05]).dockOffsetsMetres[0]).toBeGreaterThan(50)
    expect(route([7.99, 47.05], [8.05, 47.05])).toBeUndefined()
    expect(route([8.01, 47.05], [8.09, 47.05]).path).toHaveLength(2)
  })
})
