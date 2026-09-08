import { describe, expect, it } from 'vitest'
import { orbitalSun, ORBITAL_SOLAR_MIDNIGHT, solarPosition } from './orbital-sun.ts'

describe('orbital sunlight', () => {
  it('interprets the study clock as CEST, independent of the host time zone', () => {
    expect(new Date(ORBITAL_SOLAR_MIDNIGHT).toISOString()).toBe('2026-09-07T22:00:00.000Z')
    expect(orbitalSun(12 * 3600)).toEqual(solarPosition(Date.parse('2026-09-08T10:00:00Z')))
  })
  it('rises in the east, culminates south after civil noon, and sets in the west', () => {
    const morning = orbitalSun(8 * 3600), noon = orbitalSun((13 * 60 + 25) * 60), evening = orbitalSun(19 * 3600)
    expect(morning.azimuth).toBeGreaterThan(80); expect(morning.azimuth).toBeLessThan(110)
    expect(morning.direction[0]).toBeGreaterThan(0)
    expect(noon.azimuth).toBeGreaterThan(177); expect(noon.azimuth).toBeLessThan(183)
    expect(noon.altitude).toBeGreaterThan(48); expect(noon.altitude).toBeLessThan(50)
    expect(noon.direction[2]).toBeGreaterThan(0)
    expect(evening.azimuth).toBeGreaterThan(260); expect(evening.azimuth).toBeLessThan(280)
    expect(evening.direction[0]).toBeLessThan(0)
    expect(orbitalSun(6 * 3600).altitude).toBeLessThan(0)
    expect(orbitalSun(7 * 3600).altitude).toBeGreaterThan(0)
    expect(orbitalSun(20 * 3600).altitude).toBeLessThan(0)
  })
  it('keeps finite unit vectors all day, including below the horizon and across midnight', () => {
    for (let t = 0; t <= 86400; t += 300) {
      const sun = orbitalSun(t)
      expect(Math.hypot(...sun.direction)).toBeCloseTo(1, 10)
      expect(sun.azimuth).toBeGreaterThanOrEqual(0); expect(sun.azimuth).toBeLessThan(360)
    }
    expect(orbitalSun(0).altitude).toBeLessThan(-30)
    expect(Math.abs(orbitalSun(86400).altitude - orbitalSun(0).altitude)).toBeLessThan(0.5)
  })
})
