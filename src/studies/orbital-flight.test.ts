import { describe, expect, it } from 'vitest'
import { fromOrbit, toOrbit, type MapProjection, type Point3 } from './orbital-flight.ts'
import { flightOpacity, flightPose, initialOrbitPose } from './orbital-flight-path.ts'

describe('atlas to orbital camera handover', () => {
  const projection: MapProjection = { centreLongitude: 8.17, centreLatitude: 46.85, longitudeScale: Math.cos(46.85 * Math.PI / 180), scale: 18.6 }
  it('round trips the saved camera and focus without losing a street-scale position', () => {
    for (const point of [[4.712, 0.74, -3.512], [-21, 37, 26], [0, 0, 0]] as Point3[]) {
      fromOrbit(toOrbit(point, projection), projection).forEach((value, i) => expect(value).toBeCloseTo(point[i], 10))
    }
  })
  it('aligns a known geographic landmark in both map coordinate systems', () => {
    const lon = 8.5417, lat = 47.3769
    const atlas: Point3 = [(lon - projection.centreLongitude) * projection.longitudeScale * projection.scale, 0, -(lat - projection.centreLatitude) * projection.scale]
    const orbit = toOrbit(atlas, projection)
    expect(orbit[0]).toBeCloseTo((lon - 8.23) * Math.cos(46.8 * Math.PI / 180) * 12, 10)
    expect(orbit[2]).toBeCloseTo(-(lat - 46.8) * 12, 10)
  })
  it('has exact endpoints and a reversible continuous camera and lens path', () => {
    const from = { position: [4, 1, -3] as Point3, target: [4, 0, -4] as Point3, fov: 72 }
    const to = initialOrbitPose(390, 844)
    expect(flightPose(from, to, 0)).toEqual(from)
    expect(flightPose(from, to, 1)).toEqual(to)
    expect(flightPose(from, to, 0.5)).toEqual(flightPose(to, from, 0.5))
    expect(to.position[1]).toBeGreaterThan(39)
    expect(flightPose(from, to, -1)).toEqual(from)
    expect(flightPose(from, to, 2)).toEqual(to)
  })
  it('keeps the old geometry intact during launch, then smoothly hands over', () => {
    expect(flightOpacity(0.2)).toBe(0)
    expect(flightOpacity(0.525)).toBeCloseTo(0.5)
    expect(flightOpacity(0.85)).toBeCloseTo(1)
    expect(flightOpacity(1)).toBe(1)
  })
})
