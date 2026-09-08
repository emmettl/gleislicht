import { describe, expect, it } from 'vitest'
import type { NationalRoadStudySnapshot } from '@motionstudies/core/domain/road-day'
import type { RoadTrafficSnapshot } from '@motionstudies/core/domain/road'
import { roadTrafficSummary } from './road-traffic-summary.ts'

const metadata: NationalRoadStudySnapshot['metadata'] = {
  publisher: 'test', serviceDate: '2026-09-04', windowStart: 0, windowEnd: 120,
  sourceUrl: '', measurementSiteTableVersion: 1, measurementKind: 'recorded',
  model: '', sampleIntervalSeconds: 60, acceptedSites: 2, sections: 1,
  minimumSiteCoverage: 1, firstMeasurementTime: '', lastMeasurementTime: '', completeMinutes: 2,
}
function snapshot(flow = 600, speed = 60): NationalRoadStudySnapshot {
  return {
    metadata, siteIds: ['a', 'b'],
    sections: [{ id: 'a-b', road: 'N12', direction: 'positive', fromSiteIndex: 0, toSiteIndex: 1, distanceKm: 10 }],
    minutes: [0, 60].map(time => [time, [[0, flow, speed, 0, 0], [1, flow, speed, 0, 0]]]),
  }
}

describe('motorway traffic summaries', () => {
  it('estimates the selected road using covered directional distance', () => {
    const data = snapshot()
    const other = { ...data.sections[0], id: 'other', road: 'N1', distanceKm: 100 }
    expect(roadTrafficSummary('N12', 30, { ...data, sections: [...data.sections, other] })).toEqual({
      vehicles: 100, density: 10, carriagewayKm: 10, representative: false,
    })
    const reverse = { ...data.sections[0], id: 'reverse', direction: 'negative' as const }
    expect(roadTrafficSummary('N12', 30, { ...data, sections: [...data.sections, reverse] })).toEqual({
      vehicles: 200, density: 10, carriagewayKm: 20, representative: false,
    })
  })

  it('distinguishes observed zero flow from missing or unusable observations', () => {
    expect(roadTrafficSummary('N12', 30, snapshot(0, 0))?.vehicles).toBe(0)
    expect(roadTrafficSummary('N12', 30, snapshot(600, 0))).toBeUndefined()
    const data = snapshot()
    expect(roadTrafficSummary('N12', 30, { ...data, minutes: [[0, data.minutes[0][1]], [60, []]] })).toBeUndefined()
    expect(roadTrafficSummary('N1', 30, data)).toBeUndefined()
    expect(roadTrafficSummary('N12', 121, data)).toBeUndefined()
  })

  it('does not interpolate over missing minutes', () => {
    const data = snapshot()
    expect(roadTrafficSummary('N12', 30, { ...data, minutes: [[0, data.minutes[0][1]], [120, data.minutes[1][1]]] })).toBeUndefined()
  })

  it('uses a representative corridor only for its own motorway', () => {
    const fallback = {
      metadata: { windowStart: 0, windowEnd: 120, measurementKind: 'representative-calibration' },
      corridors: [{ id: 'a1', name: 'A1', road: 'A1', distanceKm: 5, path: [], directions: [
        { id: 'east', label: '', reverse: false, detectorIds: [], samples: [[0, 600, 60, 0, 0], [60, 600, 60, 0, 0]] },
      ] }],
    } as unknown as RoadTrafficSnapshot
    expect(roadTrafficSummary('N12', 30, undefined, fallback)).toBeUndefined()
    expect(roadTrafficSummary('N1', 30, undefined, fallback)).toEqual({
      vehicles: 50, density: 10, carriagewayKm: 5, representative: true,
    })
  })
})
