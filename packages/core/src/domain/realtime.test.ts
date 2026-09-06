import { describe, expect, it } from 'vitest'
import { positionForTrain, type NetworkSnapshot } from './network.ts'
import { applyRealtimeSnapshot, type RealtimeSnapshot } from './realtime.ts'

const network: NetworkSnapshot = {
  metadata: {
    publisher: 'test', feedVersion: '20260902', serviceDate: '2026-09-04',
    windowStart: 0, windowEnd: 3600, focusTime: 0, sourceUrl: '', model: '', note: '',
  },
  bounds: { minLongitude: 0, minLatitude: 0, maxLongitude: 3, maxLatitude: 3 },
  stops: [[0, 0, 'A', '', 'a'], [1, 1, 'B', '', 'b'], [2, 2, 'C', '', 'c']],
  edges: [[0, 1], [1, 2]], paths: [[[0, 0], [1, 1]], [[1, 1], [2, 2]]],
  edgePaths: [0, 1],
  trains: [{
    id: 'trip', route: 'IC 1', headsign: 'C', shortName: '1', category: 'intercity',
    start: 100, end: 500, stops: [[0, 100, 110], [1, 290, 300], [2, 490, 500]],
    pathSegments: [0, 1],
  }],
}

const snapshot = (updates: RealtimeSnapshot['updates']): RealtimeSnapshot => ({
  metadata: {
    kind: 'fixture', generatedAt: '2026-09-04T06:00:00Z',
    staticFeedVersion: '20260902', serviceDate: '2026-09-04', sourceUrl: '', model: '',
  },
  updates,
})

describe('applyRealtimeSnapshot', () => {
  it('propagates delays and exact stop updates', () => {
    const result = applyRealtimeSnapshot(network, snapshot([{ tripId: 'trip', delaySeconds: 60,
      stopTimeUpdates: [{ stopId: 'b', arrivalDelay: 120, departureDelay: 180 }] }]))
    expect(result.compatible).toBe(true)
    expect(result.network.trains[0].stops).toEqual([[0, 160, 170], [1, 410, 480], [2, 670, 680]])
    expect(result.summary.adjusted).toBe(1)
  })

  it('hides cancelled trains', () => {
    const result = applyRealtimeSnapshot(network, snapshot([{ tripId: 'trip', scheduleRelationship: 'cancelled' }]))
    expect(positionForTrain(result.network.trains[0], 200)).toBeUndefined()
    expect(result.summary.cancelled).toBe(1)
  })

  it('skips only exactly matched stops and breaks non-adjacent geometry', () => {
    const result = applyRealtimeSnapshot(network, snapshot([{ tripId: 'trip',
      stopTimeUpdates: [{ stopPosition: 1, scheduleRelationship: 'skipped' }] }]))
    expect(result.network.trains[0].stops).toHaveLength(2)
    expect(result.network.trains[0].pathSegments).toEqual([null])
    expect(result.summary.skippedStops).toBe(1)
  })

  it('falls back safely when the static feed differs', () => {
    const incompatible = { ...snapshot([]), metadata: { ...snapshot([]).metadata, staticFeedVersion: 'other' } }
    const result = applyRealtimeSnapshot(network, incompatible)
    expect(result.compatible).toBe(false)
    expect(result.network).toBe(network)
  })

  it('reports unmatched trip ids', () => {
    const result = applyRealtimeSnapshot(network, snapshot([{ tripId: 'missing' }]))
    expect(result.summary.unmatched).toBe(1)
  })
})
