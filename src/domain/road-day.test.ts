import { describe, expect, it } from 'vitest'
import {
  adjacentRoadChunks,
  nationalRoadConditionsAtTime,
  roadChunkForTime,
  roadSnapshotForChunk,
  type NationalRoadStudyManifest,
} from './road-day.ts'

const manifest: NationalRoadStudyManifest = {
  metadata: {
    publisher: 'FEDRO',
    serviceDate: '2026-09-05',
    windowStart: 0,
    windowEnd: 7_200,
    sourceUrl: 'https://example.com',
    measurementSiteTableVersion: 23,
    measurementKind: 'recorded',
    model: 'Section traffic-flow reconstruction / no vehicle tracking',
    sampleIntervalSeconds: 60,
    acceptedSites: 2,
    sections: 1,
    minimumSiteCoverage: 1,
    firstMeasurementTime: '2026-09-04T22:00:00Z',
    lastMeasurementTime: '2026-09-04T23:59:00Z',
    completeMinutes: 120,
  },
  siteIds: ['one', 'two'],
  sections: [
    {
      id: 'N1:positive:one:two',
      road: 'N1',
      direction: 'positive',
      fromSiteIndex: 0,
      toSiteIndex: 1,
      distanceKm: 3,
    },
  ],
  chunks: [
    { id: '00-01', windowStart: 0, windowEnd: 3_600, path: '00.json', minuteCount: 60, valueCount: 120 },
    { id: '01-02', windowStart: 3_600, windowEnd: 7_200, path: '01.json', minuteCount: 60, valueCount: 120 },
  ],
}

describe('progressive national road studies', () => {
  it('selects and prefetches the current road minute chunk', () => {
    const current = roadChunkForTime(manifest, 4_000)
    expect(current.id).toBe('01-02')
    expect(adjacentRoadChunks(manifest, current).map(({ id }) => id)).toEqual([
      '00-01',
      '01-02',
    ])
  })

  it('interpolates recorded site conditions between complete minutes', () => {
    const snapshot = roadSnapshotForChunk(manifest, {
      windowStart: 0,
      windowEnd: 120,
      minutes: [
        [0, [[0, 1_000, 80, 100, 70]]],
        [60, [[0, 1_200, 70, 120, 60]]],
      ],
    })
    expect(nationalRoadConditionsAtTime(snapshot, 0, 30)).toEqual({
      lightFlowPerHour: 1_100,
      lightSpeedKmh: 75,
      heavyFlowPerHour: 110,
      heavySpeedKmh: 65,
    })
  })
})
