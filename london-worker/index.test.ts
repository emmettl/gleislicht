import { describe, expect, it } from 'vitest'
import {
  normalizePredictions,
  normalizeStatuses,
  operationsObjectKey,
} from './index.ts'

describe('London operations worker', () => {
  it('groups successive stop predictions into one observed vehicle', () => {
    const predictions = normalizePredictions([
      {
        vehicleId: '234',
        lineId: 'victoria',
        lineName: 'Victoria',
        modeName: 'tube',
        naptanId: '940GZZLUEUS',
        stationName: 'Euston Underground Station',
        destinationNaptanId: '940GZZLUWWL',
        destinationName: 'Walthamstow Central Underground Station',
        direction: 'inbound',
        timestamp: '2026-09-07T07:45:00Z',
        expectedArrival: '2026-09-07T07:46:00Z',
        timeToStation: 60,
      },
      {
        vehicleId: '234',
        lineId: 'victoria',
        lineName: 'Victoria',
        naptanId: '940GZZLUWRR',
        stationName: 'Warren Street Underground Station',
        timestamp: '2026-09-07T07:45:00Z',
        expectedArrival: '2026-09-07T07:48:00Z',
        timeToStation: 180,
      },
    ])

    expect(predictions).toHaveLength(1)
    expect(predictions[0]).toMatchObject({
      id: 'victoria:234',
      lineId: 'victoria',
      destinationName: 'Walthamstow Central Underground Station',
    })
    expect(predictions[0].predictions.map(({ stopId }) => stopId)).toEqual([
      '940GZZLUEUS',
      '940GZZLUWRR',
    ])
  })

  it('keeps the most severe current status for each line', () => {
    expect(
      normalizeStatuses([
        {
          id: 'jubilee',
          name: 'Jubilee',
          lineStatuses: [
            { statusSeverity: 10, statusSeverityDescription: 'Good Service' },
            {
              statusSeverity: 6,
              statusSeverityDescription: 'Severe Delays',
              reason: 'Signal failure',
            },
          ],
        },
      ]),
    ).toEqual([
      {
        lineId: 'jubilee',
        lineName: 'Jubilee',
        severity: 6,
        severityDescription: 'Severe Delays',
        reason: 'Signal failure',
      },
    ])
  })

  it('partitions immutable observations by scheduled UTC minute', () => {
    expect(operationsObjectKey('2026-09-07T07:45:00.000Z')).toBe(
      'london/tfl-operations/2026-09-07/2026-09-07T07-45-00-000Z.json.gz',
    )
  })
})
