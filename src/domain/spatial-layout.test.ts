import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot } from './network.ts'
import {
  spatialLayoutCoverage,
  type SpatialLayoutSnapshot,
} from './spatial-layout.ts'

const network = {
  metadata: {
    publisher: 'Test',
    feedVersion: '1',
    serviceDate: '2026-09-04',
    windowStart: 0,
    windowEnd: 1,
    focusTime: 0,
    sourceUrl: 'test',
    model: 'test',
    note: 'test',
  },
  bounds: {
    minLongitude: 0,
    minLatitude: 0,
    maxLongitude: 1,
    maxLatitude: 1,
  },
  stops: [
    [0, 0, 'A', '', 'a'],
    [1, 1, 'B', '', 'b'],
  ],
  edges: [[0, 1]],
  paths: [[[0, 0], [1, 1]]],
  edgePaths: [0],
  trains: [],
} satisfies NetworkSnapshot

const layout = {
  metadata: {
    id: 'diagram',
    label: 'Diagram',
    kind: 'topological',
    coordinateSpace: 'normalized',
    sourceNetwork: 'test.json',
    sourceSha256: 'abc',
    feedVersion: '1',
    model: 'test',
    note: 'test',
  },
  bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
  stops: [['a', 0, 0]],
  paths: [[[0, 0], [1, 1]]],
} satisfies SpatialLayoutSnapshot

describe('spatial layout contract', () => {
  it('reports identity and path coverage without relying on stop order', () => {
    expect(spatialLayoutCoverage(network, layout)).toEqual({
      matchedStops: 1,
      totalStops: 2,
      matchedPaths: 1,
      totalPaths: 1,
    })
  })
})
