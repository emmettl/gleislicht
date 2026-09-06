import { describe, expect, it } from 'vitest'
import {
  compileOperationsDay,
  londonDateAndTime,
} from './compile-london-operations-day.mjs'

function snapshot(scheduledAt, vehicleId) {
  return {
    metadata: {
      kind: 'observed-operations',
      publisher: 'Transport for London',
      sourceUrl: 'https://api.tfl.gov.uk',
      collectedAt: scheduledAt,
      scheduledAt,
      lineIds: ['victoria'],
      model: 'prediction-derived',
    },
    vehicles: [
      {
        id: vehicleId,
        lineId: 'victoria',
        lineName: 'Victoria',
        observedAt: scheduledAt,
        predictions: [],
      },
    ],
    lineStatuses: [],
  }
}

describe('London operations day compiler', () => {
  it('assigns UTC observations to the London civil day', () => {
    expect(londonDateAndTime('2026-09-06T23:01:00.000Z')).toEqual({
      date: '2026-09-07',
      seconds: 60,
    })
  })

  it('deduplicates minutes and emits progressive integrity descriptors', () => {
    const result = compileOperationsDay(
      [
        snapshot('2026-09-06T23:01:00.000Z', 'first'),
        snapshot('2026-09-06T23:01:00.000Z', 'replacement'),
        snapshot('2026-09-07T01:05:00.000Z', 'second'),
        snapshot('2026-09-08T01:05:00.000Z', 'other-day'),
      ],
      { serviceDate: '2026-09-07', minimumSamples: 2 },
    )

    expect(result.manifest.metadata).toMatchObject({
      kind: 'observed-operations-day',
      serviceDate: '2026-09-07',
      completeMinutes: 2,
      longestGapSeconds: 7_440,
      lineIds: ['victoria'],
    })
    expect(result.manifest.chunks.map(({ id }) => id)).toEqual([
      '00-02',
      '02-04',
    ])
    expect(result.chunks[0].artifact.frames[0].vehicles[0].id).toBe(
      'replacement',
    )
    expect(result.manifest.chunks[0].sha256).toHaveLength(64)
    expect(result.manifest.chunks[0].bytes).toBeGreaterThan(100)
  })
})
