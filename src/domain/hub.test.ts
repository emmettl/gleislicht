import { describe, expect, it } from 'vitest'
import {
  callsAtHub,
  callsNearTime,
  nextHubCall,
  platformCodeForCall,
  platformTrackForCall,
  platformsForCalls,
  stationMotionForCall,
} from './hub.ts'
import type { NetworkSnapshot } from './network.ts'

const TEST_HUB = {
  id: 'central',
  name: 'Zürich HB',
  displayName: 'Central',
  character: 'test interchange',
} as const

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
    [8.5, 47.3, 'Zürich HB', '7'],
    [8.6, 47.4, 'Zürich HB', '31'],
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
    const calls = callsAtHub(snapshot, TEST_HUB)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      previousStop: [8, 47, 'Winterthur'],
      nextStop: [9, 47, 'Chur'],
    })
  })

  it('includes explicitly declared station-name aliases', () => {
    const aliasedSnapshot: NetworkSnapshot = {
      ...snapshot,
      stops: snapshot.stops.map((stop, index) =>
        index === 2
          ? [stop[0], stop[1], 'Zürich HB (Rail)', stop[3], stop[4]]
          : stop,
      ),
    }

    const calls = callsAtHub(aliasedSnapshot, {
      ...TEST_HUB,
      aliases: ['Zürich HB (Rail)'],
    })
    expect(calls).toHaveLength(2)
  })

  it('selects the calls participating in the current pulse window', () => {
    const calls = callsAtHub(snapshot, TEST_HUB)
    expect(callsNearTime(calls, 900, 5 * 60).map((call) => call.id)).toEqual([
      'one:1',
      'two:2',
    ])
    expect(nextHubCall(calls, 700)?.train.id).toBe('two')
    expect(nextHubCall(calls, 1300)?.train.id).toBe('one')
  })

  it('orders real platform assignments naturally', () => {
    const calls = callsAtHub(snapshot, TEST_HUB)
    expect(platformCodeForCall(calls[0])).toBe('7')
    expect(platformsForCalls(calls)).toEqual(['7', '31'])
  })

  it('groups platform sectors onto their physical track', () => {
    const call = {
      ...callsAtHub(snapshot, TEST_HUB)[0],
      hubStop: [8.5, 47.3, 'Zürich HB', '7A-D'],
    } as const
    expect(platformTrackForCall(call)).toBe('7')
  })

  it('moves a call through approach, dwell and departure phases', () => {
    const call = callsAtHub(snapshot, TEST_HUB)[0]
    expect(stationMotionForCall(call, 300, 300)).toEqual({
      phase: 'approaching',
      progress: 0,
    })
    expect(stationMotionForCall(call, 600, 300)).toEqual({
      phase: 'dwelling',
      progress: 1,
    })
    expect(stationMotionForCall(call, 810, 300)).toEqual({
      phase: 'departing',
      progress: 0.5,
    })
    expect(stationMotionForCall(call, 1200, 300)).toBeUndefined()
  })
})
