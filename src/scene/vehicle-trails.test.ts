import { describe, expect, it } from 'vitest'
import {
  VEHICLE_TRAIL_SEGMENTS,
  VEHICLE_TRAIL_STEP_SECONDS,
  vehicleTrailSampleTimes,
} from './vehicle-trails.ts'

describe('vehicle trail samples', () => {
  it('builds a short, evenly spaced history behind the current time', () => {
    expect(vehicleTrailSampleTimes(1000)).toEqual([1000, 955, 910, 865])
    expect(VEHICLE_TRAIL_SEGMENTS).toBe(3)
    expect(VEHICLE_TRAIL_STEP_SECONDS).toBe(45)
  })
})
