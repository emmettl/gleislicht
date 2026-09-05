import { describe, expect, it } from 'vitest'
import {
  aggregateDirection,
  compileRoadStudy,
} from './compile-astra-road-study.mjs'
import { A1_ZURICH_DIRECTIONS } from './astra-road-study-config.mjs'

function measurement(siteId, measurementTime, value = 1) {
  return {
    siteId,
    measurementTime,
    lightFlowPerHour: 100 * value,
    lightSpeedKmh: 80 - value,
    heavyFlowPerHour: 10 * value,
    heavySpeedKmh: 70 - value,
  }
}

function snapshot(measurementTime) {
  return {
    metadata: {
      measurementKind: 'recorded',
      measurementSiteTableVersion: 23,
    },
    measurements: A1_ZURICH_DIRECTIONS.flatMap((direction) =>
      direction.detectorGroups.flatMap((group, groupIndex) =>
        group.map((siteId) => measurement(siteId, measurementTime, groupIndex + 1)),
      ),
    ),
  }
}

describe('ASTRA recorded road-study compiler', () => {
  it('sums parallel lanes but takes a median across successive sites', () => {
    const groups = [['lane-a', 'lane-b'], ['lane-c']]
    const result = aggregateDirection(
      [
        measurement('lane-a', '2026-09-05T06:45:00Z', 1),
        measurement('lane-b', '2026-09-05T06:45:00Z', 2),
        measurement('lane-c', '2026-09-05T06:45:00Z', 5),
      ],
      groups,
    )
    expect(result.coverage).toBe(1)
    expect(result.lightFlowPerHour).toBe(400)
    expect(result.heavyFlowPerHour).toBe(40)
    expect(result.lightSpeedKmh).toBeCloseTo((78.333 + 75) / 2, 2)
  })

  it('builds the browser contract from continuous complete minutes', () => {
    const result = compileRoadStudy(
      [snapshot('2026-09-05T06:45:00Z'), snapshot('2026-09-05T06:46:00Z')],
      { minimumSamples: 2 },
    )
    expect(result.metadata).toMatchObject({
      serviceDate: '2026-09-05',
      windowStart: 31_500,
      windowEnd: 31_560,
      measurementKind: 'recorded',
      sampleIntervalSeconds: 60,
    })
    expect(result.corridors[0].directions).toHaveLength(2)
    expect(result.corridors[0].directions[0].samples).toHaveLength(2)
  })

  it('rejects a gap and an incomplete recording', () => {
    expect(() =>
      compileRoadStudy(
        [snapshot('2026-09-05T06:45:00Z'), snapshot('2026-09-05T06:47:00Z')],
        { minimumSamples: 2 },
      ),
    ).toThrow('not continuous')
    const sparse = snapshot('2026-09-05T06:45:00Z')
    sparse.measurements = sparse.measurements.slice(0, 1)
    expect(() => compileRoadStudy([sparse], { minimumSamples: 1 })).toThrow(
      'No complete ASTRA minutes',
    )
  })
})
