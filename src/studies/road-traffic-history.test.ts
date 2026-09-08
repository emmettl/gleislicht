import { describe, expect, it } from 'vitest'
import type { NationalRoadStudySnapshot } from '@motionstudies/core/domain/road-day'
import { roadHistoryPath, roadTrafficHistory } from './road-traffic-history.ts'

const data = {
  metadata: { windowStart: 0, windowEnd: 180, sampleIntervalSeconds: 60 },
  sections: [{ id: 'a', road: 'N1', fromSiteIndex: 0, toSiteIndex: 1, distanceKm: 10 }],
  minutes: [
    [0, [[0, 0, 0, 0, 0], [1, 0, 0, 0, 0]]],
    [60, [[0, 600, 60, 0, 0], [1, 600, 60, 0, 0]]],
    [180, [[0, 1200, 60, 0, 0], [1, 1200, 60, 0, 0]]],
  ],
} as unknown as NationalRoadStudySnapshot

describe('road history', () => {
  it('preserves measured zero, absent minutes and full-window density', () => {
    const points = roadTrafficHistory('N1', data)
    expect(points.map(point => point.summary?.density)).toEqual([0, 10, undefined, 20])
    expect(roadHistoryPath(points, n => n, n => n)).toBe('M0.00,0.00 L60.00,10.00  M180.00,20.00')
  })
  it('does not invent observations for a different road', () => {
    expect(roadTrafficHistory('N2', data).every(point => !point.summary)).toBe(true)
    expect(roadTrafficHistory('N1')).toEqual([])
  })
})
