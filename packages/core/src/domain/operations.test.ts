import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot } from './network.ts'
import {
  operationsAgeSeconds,
  operationsServiceTime,
  projectOperationsOntoNetwork,
  type TransitOperationsSnapshot,
} from './operations.ts'

const network: NetworkSnapshot = {
  metadata: {
    publisher: 'Transport for London',
    feedVersion: 'test',
    serviceDate: '2026-09-07',
    windowStart: 0,
    windowEnd: 86_400,
    focusTime: 28_800,
    sourceUrl: 'https://example.test',
    model: 'scheduled',
    note: 'test',
  },
  bounds: {
    minLongitude: -0.2,
    minLatitude: 51.4,
    maxLongitude: 0,
    maxLatitude: 51.6,
  },
  stops: [
    [-0.15, 51.48, 'Victoria', '', '940GZZLUVIC'],
    [-0.14, 51.5, 'Green Park', '', '940GZZLUGPK'],
    [-0.12, 51.52, 'Oxford Circus', '', '940GZZLUOXC'],
  ],
  edges: [[0, 1], [1, 2]],
  paths: [
    [[-0.15, 51.48], [-0.14, 51.5]],
    [[-0.14, 51.5], [-0.12, 51.52]],
  ],
  edgePaths: [0, 1],
  trains: [
    {
      id: 'planned-victoria',
      route: 'Victoria',
      headsign: 'Walthamstow Central',
      shortName: 'Victoria',
      category: 'metro',
      mode: 'tube',
      start: 28_000,
      end: 28_600,
      stops: [
        [0, 28_000, 28_030],
        [1, 28_240, 28_270],
        [2, 28_480, 28_510],
      ],
      pathSegments: [0, 1],
    },
  ],
}

const operations: TransitOperationsSnapshot = {
  metadata: {
    kind: 'observed-operations',
    publisher: 'Transport for London',
    sourceUrl: 'https://api.tfl.gov.uk',
    collectedAt: '2026-09-07T07:59:45.000Z',
    scheduledAt: '2026-09-07T07:59:40.000Z',
    lineIds: ['victoria'],
    model: 'prediction-derived',
  },
  vehicles: [
    {
      id: 'victoria:vehicle-1',
      lineId: 'victoria',
      lineName: 'Victoria',
      modeName: 'tube',
      destinationName: 'Walthamstow Central Underground Station',
      observedAt: '2026-09-07T07:59:39.000Z',
      predictions: [
        {
          stopId: '940GZZLUGPK',
          stopName: 'Green Park Underground Station',
          expectedArrival: '2026-09-07T08:00:40.000Z',
          secondsToStop: 60,
        },
        {
          stopId: '940GZZLUOXC',
          stopName: 'Oxford Circus Underground Station',
          expectedArrival: '2026-09-07T08:04:40.000Z',
          secondsToStop: 300,
        },
      ],
    },
  ],
  lineStatuses: [],
}

describe('observed transit operations', () => {
  it('uses the study timezone when deriving the live clock', () => {
    expect(operationsServiceTime(operations, 'Europe/London')).toBe(9 * 3600 - 20)
  })

  it('reports snapshot age without allowing a negative result', () => {
    expect(
      operationsAgeSeconds(operations, Date.parse('2026-09-07T08:00:00.000Z')),
    ).toBe(15)
    expect(
      operationsAgeSeconds(operations, Date.parse('2026-09-07T07:00:00.000Z')),
    ).toBe(0)
  })

  it('projects observed predictions onto matched static route geometry', () => {
    const result = projectOperationsOntoNetwork(network, operations, 28_800)

    expect(result.matchedVehicleCount).toBe(1)
    expect(result.unmatchedVehicleCount).toBe(0)
    expect(result.snapshot.trains).toHaveLength(1)
    expect(result.snapshot.trains[0]).toMatchObject({
      id: 'observed:victoria:vehicle-1',
      route: 'Victoria',
      category: 'metro',
      pathSegments: [0, 1],
      operations: {
        kind: 'prediction-derived',
        vehicleId: 'victoria:vehicle-1',
      },
    })
    expect(result.snapshot.trains[0].stops).toEqual([
      [0, 28_650, 28_650],
      [1, 28_860, 28_860],
      [2, 29_100, 29_100],
    ])
  })

  it('keeps unmatched predictions explicit rather than inventing a path', () => {
    const result = projectOperationsOntoNetwork(network, {
      ...operations,
      vehicles: [
        {
          ...operations.vehicles[0],
          lineId: 'northern',
          lineName: 'Northern',
        },
      ],
    }, 28_800)

    expect(result.matchedVehicleCount).toBe(0)
    expect(result.unmatchedVehicleCount).toBe(1)
    expect(result.snapshot.trains).toEqual([])
  })
})
