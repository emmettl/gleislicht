import { describe, expect, it } from 'vitest'
import {
  compileNationalRoadStudy,
  splitNationalRoadStudy,
} from './compile-astra-national-study.mjs'

const topology = {
  sites: [
    {
      id: 'CH:0001:positive',
      detectorIds: ['CH:0001.01'],
      match: { confidence: 'high' },
    },
    {
      id: 'CH:0002:positive',
      detectorIds: ['CH:0002.01'],
      match: { confidence: 'continuity' },
    },
    {
      id: 'CH:0003:positive',
      detectorIds: ['CH:0003.01'],
      match: { confidence: 'authoritative' },
    },
    {
      id: 'CH:0004:positive',
      detectorIds: ['CH:0004.01'],
      match: { confidence: 'review' },
    },
  ],
  sections: [
    {
      id: 'N1:positive:CH:0001:CH:0002',
      road: 'N1',
      direction: 'positive',
      fromSiteId: 'CH:0001:positive',
      toSiteId: 'CH:0002:positive',
      distanceKm: 4.2,
    },
  ],
}

function snapshot(minute) {
  const measurementTime = `2026-09-05T06:${minute}:00.000Z`
  return {
    metadata: {
      measurementKind: 'recorded',
      measurementSiteTableVersion: 23,
      recordingScope: 'national',
    },
    measurements: ['CH:0001.01', 'CH:0002.01', 'CH:0003.01'].map((siteId, index) => ({
      siteId,
      measurementTime,
      lightFlowPerHour: 1_000 + index * 100,
      lightSpeedKmh: 80 - index * 5,
      heavyFlowPerHour: 70 + index * 10,
      heavySpeedKmh: 70 - index * 5,
    })),
  }
}

describe('national ASTRA study compilation', () => {
  it('compiles accepted sites and section references without unresolved records', () => {
    const result = compileNationalRoadStudy(
      [snapshot('45'), snapshot('46')],
      topology,
      { minimumSamples: 2 },
    )
    expect(result.metadata).toMatchObject({
      serviceDate: '2026-09-05',
      acceptedSites: 3,
      sections: 1,
      completeMinutes: 2,
      minimumSiteCoverage: 1,
    })
    expect(result.siteIds).toEqual([
      'CH:0001:positive',
      'CH:0002:positive',
      'CH:0003:positive',
    ])
    expect(result.sections[0]).toMatchObject({
      fromSiteIndex: 0,
      toSiteIndex: 1,
    })
    expect(result.minutes).toHaveLength(2)
    expect(result.minutes[0][1]).toHaveLength(3)
  })

  it('splits a compiled study into progressively loadable time chunks', () => {
    const study = compileNationalRoadStudy(
      [snapshot('45'), snapshot('46')],
      topology,
      { minimumSamples: 2 },
    )
    const split = splitNationalRoadStudy(study, { chunkSeconds: 900 })
    expect(split.manifest.chunks).toEqual([
      expect.objectContaining({
        id: '0845-0846',
        path: 'swiss-road-national/0845-0846.json',
        minuteCount: 2,
        valueCount: 6,
      }),
    ])
    expect(split.chunks[0].body.minutes).toHaveLength(2)
  })
})
