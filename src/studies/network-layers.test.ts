import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import { networkWithRailVisibility } from './network-layers.ts'

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
