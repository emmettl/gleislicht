import { describe, expect, it } from 'vitest'
import {
  createLakeAvoidingPathMap,
  lakeAvoidingPath,
  lakeAvoidingPathForStops,
} from './lake-aware-paths.ts'

const lake = [
  [-2, 0, -1],
  [2, 0, -1],
  [2, 0, 1],
  [-2, 0, 1],
] as const

describe('lake-aware fallback paths', () => {
  it('routes a long fallback chord along the shorter shoreline', () => {
    const path = lakeAvoidingPath([-3, 0, 0], [3, 0, 0], [lake])

    expect(path).toBeDefined()
    expect(path?.[0]).toEqual([-3, 0, 0])
    expect(path?.at(-1)).toEqual([3, 0, 0])
    expect(path?.some(([, , z]) => Math.abs(z) === 1)).toBe(true)
  })

  it('leaves clear and bridge-scale links alone', () => {
    expect(lakeAvoidingPath([-3, 0, 2], [3, 0, 2], [lake])).toBeUndefined()
    const narrowLake = [
      [-0.05, 0, -1],
      [0.05, 0, -1],
      [0.05, 0, 1],
      [-0.05, 0, 1],
    ] as const
    expect(
      lakeAvoidingPath([-1, 0, 0], [1, 0, 0], [narrowLake]),
    ).toBeUndefined()
  })

  it('indexes both travel directions and preserves supplied geometry', () => {
    const stops = [
      [-3, 0, 0],
      [3, 0, 0],
    ] as const
    const fallback = createLakeAvoidingPathMap([[0, 1]], undefined, stops, [lake])
    const forward = lakeAvoidingPathForStops(fallback, 0, 1)
    const reverse = lakeAvoidingPathForStops(fallback, 1, 0)

    expect(forward?.points[0]).toEqual(stops[0])
    expect(reverse?.points[0]).toEqual(stops[1])
    expect(createLakeAvoidingPathMap([[0, 1]], [0], stops, [lake]).size).toBe(0)
  })
})
