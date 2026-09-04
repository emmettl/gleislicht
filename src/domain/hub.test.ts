import { describe, expect, it } from 'vitest'
import { callsAtHub, callsNearTime, HUBS, nextHubCall } from './hub.ts'
import type { NetworkSnapshot } from './network.ts'

const snapshot: NetworkSnapshot = {
  metadata: {
    publisher: 'test',
    feedVersion: 'test',
    serviceDate: '2026-09-04',
    windowStart: 0,
    windowEnd: 3600,
    focusTime: 900,
    sourceUrl: 'https://example.com',
    model: 'schedule',
    note: 'test',
  },
  bounds: {
    minLongitude: 7,
    minLatitude: 46,
    maxLongitude: 9,
    maxLatitude: 48,
  },
  stops: [
    [8, 47, 'Winterthur'],
    [8.5, 47.3, 'Zürich HB'],
    [8.6, 47.4, 'Zürich HB'],
    [9, 47, 'Chur'],
  ],
  edges: [],
  trains: [
    {
      id: 'one',
      route: 'IC 3',
      headsign: 'Chur',
      shortName: '501',
      category: 'intercity',
      start: 0,
      end: 1800,
      stops: [
        [0, 0, 0],
        [1, 600, 660],
        [3, 1800, 1800],
      ],
    },
    {
      id: 'two',
      route: 'S 11',
      headsign: 'Zürich HB',
      shortName: '19111',
      category: 's-bahn',
      start: 0,
      end: 1200,
      stops: [
        [0, 0, 0],
        [2, 1200, 1200],
      ],
    },
  ],
}

describe('hub calls', () => {
  it('combines platform stop ids under one named station', () => {
    const calls = callsAtHub(snapshot, HUBS[0])
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({ previousStop: 0, nextStop: 3 })
  })

  it('selects the calls participating in the current pulse window', () => {
    const calls = callsAtHub(snapshot, HUBS[0])
    expect(callsNearTime(calls, 900, 5 * 60).map((call) => call.id)).toEqual([
      'one:1',
      'two:2',
    ])
    expect(nextHubCall(calls, 700)?.train.id).toBe('two')
  })
})
