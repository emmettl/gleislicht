import { describe, expect, it } from 'vitest'
import { airAltitudeHeight, projectAirPosition } from './air-projection.ts'

const projection = {
  centreLongitude: 8,
  centreLatitude: 47,
  longitudeScale: 0.68,
  scale: 10,
}

describe('airspace projection', () => {
  it('uses the network coordinate frame and compressed observed altitude', () => {
    expect(
      projectAirPosition(
        { longitude: 8.5, latitude: 47.25, altitudeFeet: 10_000 },
        projection,
      ),
    ).toEqual([3.4000000000000004, airAltitudeHeight(10_000), -2.5])
  })

  it('keeps ground and high overflights inside the authored vertical range', () => {
    expect(airAltitudeHeight(-500)).toBe(0.42)
    expect(airAltitudeHeight(60_000)).toBe(8.4)
  })
})
