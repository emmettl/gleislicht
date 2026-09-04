import { describe, expect, it } from 'vitest'
import {
  buildStationIndex,
  formatServiceTime,
  positionForTrain,
  type NetworkSnapshot,
  type NetworkTrain,
} from './network.ts'

const train: NetworkTrain = {
  id: 'test',
  route: 'IC 1',
  headsign: 'St. Gallen',
  shortName: '701',
  category: 'intercity',
  start: 100,
  end: 400,
  stops: [
    [0, 100, 110],
    [1, 200, 220],
    [2, 400, 400],
  ],
}

describe('positionForTrain', () => {
  it('interpolates between timed stops', () => {
    expect(positionForTrain(train, 155)).toEqual({
      fromStop: 0,
      toStop: 1,
      progress: 0.5,
    })
  })

  it('holds a train at a station during dwell time', () => {
    expect(positionForTrain(train, 210)).toEqual({
      fromStop: 1,
      toStop: 1,
      progress: 0,
    })
  })

  it('omits inactive trains', () => {
    expect(positionForTrain(train, 99)).toBeUndefined()
    expect(positionForTrain(train, 401)).toBeUndefined()
  })
})

describe('formatServiceTime', () => {
  it('formats service-day seconds', () => {
    expect(formatServiceTime(7 * 3600 + 45 * 60)).toBe('07:45')
  })
})

describe('buildStationIndex', () => {
  it('combines platforms and collects every calling route', () => {
    const snapshot: NetworkSnapshot = {
      metadata: {
        publisher: 'test',
        feedVersion: 'test',
        serviceDate: '2026-09-04',
        windowStart: 0,
        windowEnd: 1000,
        focusTime: 500,
        sourceUrl: 'https://example.com',
        model: 'test',
        note: 'test',
      },
      bounds: {
        minLongitude: 7,
        minLatitude: 46,
        maxLongitude: 9,
        maxLatitude: 48,
      },
      stops: [
        [8.54, 47.38, 'Zürich HB'],
        [8.541, 47.379, 'Zürich HB'],
        [8.72, 47.5, 'Winterthur'],
      ],
      edges: [],
      trains: [
        train,
        {
          ...train,
          id: 's11',
          route: 'S 11',
          category: 's-bahn',
          stops: [
            [1, 100, 100],
            [2, 400, 400],
          ],
        },
      ],
    }

    const station = buildStationIndex(snapshot).find(
      (entry) => entry.name === 'Zürich HB',
    )
    expect(station?.stopIndexes).toEqual([0, 1])
    expect(station?.trainIds).toEqual(['test', 's11'])
    expect(station?.routes.map((route) => route.name)).toEqual(['IC 1', 'S 11'])
  })
})
