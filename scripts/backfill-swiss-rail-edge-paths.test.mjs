import { describe, expect, it } from 'vitest'
import { backfillEquivalentEdgePaths } from './backfill-swiss-rail-edge-paths.mjs'

describe('Swiss rail equivalent edge path repair', () => {
  it('reuses measured geometry for duplicate platform edges at the same stations', () => {
    const snapshot = {
      stops: [
        [8.54, 47.38, 'Zürich HB'],
        [7.44, 46.95, 'Bern'],
        [8.539, 47.379, 'Zürich HB'],
        [7.439, 46.949, 'Bern'],
      ],
      paths: [[[7.44, 46.95], [8.1, 47.4], [8.54, 47.38]]],
      edges: [[0, 1], [2, 3]],
      edgePaths: [0, null],
    }

    const result = backfillEquivalentEdgePaths(snapshot)
    expect(result.filled).toBe(1)
    expect(result.edgePaths).toEqual([0, 0])
  })

  it('does not join identically named stops in different places', () => {
    const snapshot = {
      stops: [
        [8.54, 47.38, 'Central'],
        [8.55, 47.39, 'Station'],
        [6.14, 46.2, 'Central'],
        [6.15, 46.21, 'Station'],
      ],
      paths: [[[8.54, 47.38], [8.55, 47.39]]],
      edges: [[0, 1], [2, 3]],
      edgePaths: [0, null],
    }

    const result = backfillEquivalentEdgePaths(snapshot)
    expect(result.filled).toBe(0)
    expect(result.edgePaths).toEqual([0, null])
  })
})
