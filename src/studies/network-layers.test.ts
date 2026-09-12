import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import { networkWithRailVisibility, networkWithTimetableLayer } from './network-layers.ts'

const snapshot: NetworkSnapshot = {
  metadata: {
    publisher: 'SBB', feedVersion: 'test', serviceDate: '2026-09-08',
    windowStart: 0, windowEnd: 86400, focusTime: 36000,
    sourceUrl: '', model: 'test', note: '',
  },
  bounds: { minLongitude: 6, maxLongitude: 10, minLatitude: 46, maxLatitude: 48 },
  stops: [[8.54, 47.38, 'Zürich HB'], [7.44, 46.95, 'Bern']],
  edges: [[0, 1]], paths: [[[8.54, 47.38], [7.44, 46.95]]], edgePaths: [0],
  trains: [{ id: 'ic', route: 'IC1', shortName: '1', headsign: 'Bern',
    category: 'intercity', start: 35000, end: 39000,
    stops: [[0, 35000, 35000], [1, 39000, 39000]], pathSegments: [0] }],
}

describe('SBB layer visibility', () => {
  it('removes all rail geometry and pick targets while retaining the shared map bounds and clock', () => {
    const hidden = networkWithRailVisibility(snapshot, false)
    expect(hidden.bounds).toBe(snapshot.bounds)
    expect(hidden.metadata).toBe(snapshot.metadata)
    for (const field of ['stops', 'edges', 'paths', 'edgePaths', 'trains'] as const) {
      expect(hidden[field]).toEqual([])
      expect(snapshot[field]?.length).toBeGreaterThan(0)
    }
  })

  it('restores the original snapshot, including train geometry, without a reload', () => {
    networkWithRailVisibility(snapshot, false)
    const restored = networkWithRailVisibility(snapshot, true)
    expect(restored).toBe(snapshot)
    expect(restored.trains[0].pathSegments).toEqual([0])
  })
})


describe('PostBus timetable layer', () => {
  const bus: NetworkSnapshot = {
    ...snapshot,
    stops: [[7.69, 46.62, 'Reichenbach'], [7.76, 46.55, 'Griesalp']],
    trains: [{ ...snapshot.trains[0], id: 'bus', category: 'bus', pathSegments: [0, null] }],
  }
  it('remaps stop, edge and path references without changing the shared clock or inputs', () => {
    const combined = networkWithTimetableLayer(snapshot, bus)
    expect(combined.metadata).toBe(snapshot.metadata)
    expect(combined.bounds).toBe(snapshot.bounds)
    expect(combined.trains[0]).toBe(snapshot.trains[0])
    expect(combined.trains[1].stops).toEqual([[2, 35000, 35000], [3, 39000, 39000]])
    expect(combined.trains[1].pathSegments).toEqual([1, null])
    expect(combined.edges).toEqual([[0, 1], [2, 3]])
    expect(combined.edgePaths).toEqual([0, 1])
    expect(combined.stops[combined.trains[1].stops[1][0]][2]).toBe('Griesalp')
    expect(bus.trains[0].pathSegments).toEqual([0, null])
  })
  it('keeps buses and pick targets when SBB is hidden and restores rail when buses are removed', () => {
    const busOnly = networkWithTimetableLayer(networkWithRailVisibility(snapshot, false), bus)
    expect(busOnly.trains.map(train => train.id)).toEqual(['bus'])
    expect(busOnly.stops).toEqual(bus.stops)
    expect(busOnly.trains[0].pathSegments).toEqual([0, null])
    expect(networkWithTimetableLayer(snapshot)).toBe(snapshot)
  })
  it('aligns missing edge paths rather than shifting the bus paths into rail edges', () => {
    const combined = networkWithTimetableLayer({ ...snapshot, paths: undefined, edgePaths: undefined }, bus)
    expect(combined.edgePaths).toEqual([null, 0])
    expect(combined.trains[1].pathSegments).toEqual([0, null])
  })
})
