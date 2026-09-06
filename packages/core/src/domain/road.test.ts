import { describe, expect, it } from 'vitest'
import {
  reconstructedVehicleCount,
  roadConditionsAtTime,
  roadDistanceTravelledKm,
  trafficDensity,
  visualVehicleCount,
  type RoadTrafficDirection,
  type RoadTrafficSnapshot,
} from './road.ts'

const direction: RoadTrafficDirection = {
  id: 'eastbound',
  label: 'eastbound',
  reverse: false,
  detectorIds: ['CH:0001.01'],
  samples: [
    [0, 1_200, 100, 120, 80],
    [60, 1_800, 80, 180, 70],
  ],
}

describe('road-flow reconstruction', () => {
  it('interpolates minute aggregates on the shared clock', () => {
    expect(roadConditionsAtTime(direction, 30)).toEqual({
      lightFlowPerHour: 1_500,
      lightSpeedKmh: 90,
      heavyFlowPerHour: 150,
      heavySpeedKmh: 75,
    })
  })

  it('derives density from flow and speed', () => {
    expect(trafficDensity(1_800, 90)).toBe(20)
    expect(trafficDensity(1_800, 0)).toBe(0)
  })

  it('turns density into a bounded visual sample', () => {
    expect(visualVehicleCount(1_800, 90, 40, 0.1, 200)).toBe(80)
    expect(visualVehicleCount(6_000, 20, 40, 0.1, 100)).toBe(100)
  })

  it('reports the approximate vehicles represented by the corridor', () => {
    const snapshot = {
      metadata: {},
      corridors: [
        {
          id: 'a1',
          name: 'A1',
          road: 'A1',
          distanceKm: 40,
          path: [],
          directions: [direction],
        },
      ],
    } as unknown as RoadTrafficSnapshot
    expect(reconstructedVehicleCount(snapshot, 30)).toBe(747)
  })

  it('integrates changing speed without a minute-boundary jump', () => {
    expect(roadDistanceTravelledKm(direction, 30, 'light')).toBeCloseTo(0.792)
    expect(roadDistanceTravelledKm(direction, 60, 'light')).toBeCloseTo(1.5)
  })
})
