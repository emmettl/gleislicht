import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot } from './network.ts'
import { mergeNetworkLayers } from './network-layers.ts'

const layer = (
  route: string,
  stopOffset: number,
  serviceDate = '2026-09-04',
): NetworkSnapshot => ({
  metadata: {
    publisher: 'test',
    feedVersion: route,
    serviceDate,
    windowStart: 25_200,
    windowEnd: 32_400,
    focusTime: 28_800,
    sourceUrl: 'https://example.com',
    sourceSha256: 'same-source',
    model: route,
    note: route,
    modes: ['rail'],
    localRouteIds: [route],
  },
  bounds: {
    minLongitude: 2 + stopOffset,
    minLatitude: 48,
    maxLongitude: 2.2 + stopOffset,
    maxLatitude: 48.2,
  },
  stops: [
    [2, 48, 'Shared', '', 'shared'],
    [2.1 + stopOffset, 48.1, `${route} terminus`, '', `${route}-end`],
  ],
  edges: [[0, 1]],
  paths: [[[2, 48], [2.1 + stopOffset, 48.1]]],
  edgePaths: [0],
  trains: [{
    id: `${route}-1`,
    route,
    headsign: `${route} terminus`,
    shortName: route,
    category: 'metro',
    start: 25_200,
    end: 25_800,
    stops: [[0, 25_200, 25_200], [1, 25_800, 25_800]],
    pathSegments: [0],
  }],
})

describe('mergeNetworkLayers', () => {
  it('remaps independently loaded stops, paths and journeys', () => {
    const merged = mergeNetworkLayers([layer('Métro 1', 0), layer('RER B', 1)])

    expect(merged.stops).toHaveLength(3)
    expect(merged.paths).toHaveLength(2)
    expect(merged.trains).toHaveLength(2)
    expect(merged.trains[1].stops.map(([stopIndex]) => stopIndex)).toEqual([0, 2])
    expect(merged.trains[1].pathSegments).toEqual([1])
    expect(merged.metadata.localRouteIds).toEqual(['Métro 1', 'RER B'])
    expect(merged.bounds.maxLongitude).toBe(3.2)
  })

  it('rejects layers from a different service day', () => {
    expect(() =>
      mergeNetworkLayers([
        layer('Métro 1', 0),
        layer('RER B', 1, '2026-09-05'),
      ]),
    ).toThrow('share a service date and study window')
  })
})
