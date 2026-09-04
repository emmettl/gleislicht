import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot, NetworkTrain } from '../domain/network.ts'
import { edgeTrafficWeights } from './traffic-weights.ts'

const train = (id: string, stopIndexes: readonly number[]): NetworkTrain => ({
  id,
  route: 'T',
  headsign: 'Test',
  shortName: id,
  category: 'regional',
  start: 0,
  end: 100,
  stops: stopIndexes.map((stopIndex, index) => [stopIndex, index, index]),
})

const snapshot: NetworkSnapshot = {
  metadata: {
    publisher: 'test',
    feedVersion: 'test',
    serviceDate: '2026-01-01',
    windowStart: 0,
    windowEnd: 100,
    focusTime: 50,
    sourceUrl: 'test',
    model: 'test',
    note: 'test',
  },
  bounds: {
    minLongitude: 0,
    minLatitude: 0,
    maxLongitude: 3,
    maxLatitude: 1,
  },
  stops: [
    [0, 0, 'A'],
    [1, 0, 'B'],
    [2, 0, 'C'],
    [3, 0, 'D'],
  ],
  edges: [[0, 1], [1, 2], [2, 3]],
  trains: [train('one', [0, 1, 2]), train('two', [1, 0]), train('three', [0, 1])],
}

describe('edge traffic weights', () => {
  it('counts scheduled traversals in either direction for every section', () => {
    const weights = edgeTrafficWeights(snapshot)

    expect(weights.counts).toEqual([3, 1, 0])
    expect(weights.referenceCount).toBe(3)
    expect(weights.strengths[0]).toBe(1)
    expect(weights.strengths[1]).toBeCloseTo(0.5)
    expect(weights.strengths[2]).toBe(0)
  })

  it('aggregates platform-level edges sharing the same stop names', () => {
    const withSecondPlatform: NetworkSnapshot = {
      ...snapshot,
      stops: [...snapshot.stops, [0, 0, 'A'], [1, 0, 'B']],
      edges: [...snapshot.edges, [4, 5]],
    }

    expect(edgeTrafficWeights(withSecondPlatform).counts).toEqual([3, 1, 0, 3])
  })
})
