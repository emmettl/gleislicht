import { describe, expect, it } from 'vitest'
import { pointAlongProjectedPath, prepareProjectedPath } from './network-paths.ts'

describe('projected network paths', () => {
  it('interpolates by distance rather than point count', () => {
    const path = prepareProjectedPath([
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 3],
    ])

    expect(pointAlongProjectedPath(path, 0.5)).toEqual([1, 0, 1])
  })

  it('clamps progress to the ends of a path', () => {
    const path = prepareProjectedPath([
      [2, 0, 4],
      [5, 0, 4],
    ])

    expect(pointAlongProjectedPath(path, -1)).toEqual([2, 0, 4])
    expect(pointAlongProjectedPath(path, 2)).toEqual([5, 0, 4])
  })
})
