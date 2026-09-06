import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot } from '../domain/network.ts'
import type { SpatialLayoutSnapshot } from '../domain/spatial-layout.ts'
import { prepareProjectedPath } from './network-paths.ts'
import {
  blendProjectedSpatialLayout,
  projectSpatialLayout,
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
const geographicStops = [[-10, 0, 0], [10, 0, 0]] as const
const geographicPaths = [prepareProjectedPath(geographicStops)]
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
  stops: [['b', 1, 1], ['a', 0, 0]],
  paths: [[[0, 0], [0, 1], [1, 1]]],
  context: { waterPaths: [[[0, 0.5], [1, 0.5]]] },
} satisfies SpatialLayoutSnapshot

describe('projected spatial layouts', () => {
  it('matches stops by stable source identity and preserves path indexes', () => {
    const projected = projectSpatialLayout(
      network,
      layout,
      geographicStops,
      geographicPaths,
      20,
    )
    expect(projected.stops[0]).toEqual([-10, 0, 10])
    expect(projected.stops[1]).toEqual([10, 0, -10])
    expect(projected.paths).toHaveLength(1)
    expect(projected.context?.waterPaths[0].points).toHaveLength(2)
    expect(projected.context?.waterPaths[0].points[0][0]).toBeCloseTo(-10)
    expect(projected.context?.waterPaths[0].points[1][0]).toBeCloseTo(10)
    expect(projected.context?.waterPaths[0].points[0][2]).toBeCloseTo(0)
  })

  it('blends timetable geometry without changing array identity at the ends', () => {
    const alternate = projectSpatialLayout(
      network,
      layout,
      geographicStops,
      geographicPaths,
      20,
    )
    expect(
      blendProjectedSpatialLayout(
        geographicStops,
        geographicPaths,
        alternate,
        0,
      ).stops,
    ).toBe(geographicStops)
    const middle = blendProjectedSpatialLayout(
      geographicStops,
      geographicPaths,
      alternate,
      0.5,
    )
    expect(middle.stops[0]).toEqual([-10, 0, 5])
    expect(middle.paths[0].points).toHaveLength(3)
    expect(middle.context).toBe(alternate.context)
    expect(
      blendProjectedSpatialLayout(
        geographicStops,
        geographicPaths,
        alternate,
        1,
      ),
    ).toBe(alternate)
  })
})
