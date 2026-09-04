import { describe, expect, it } from 'vitest'
import {
  applyMapZoom,
  homeMapDistanceScale,
  mapCameraFieldOfView,
  mapCameraDampingRate,
  mapPanScale,
  mapWheelZoomMultiplier,
  MAX_MAP_DISTANCE_SCALE,
  MIN_MAP_DISTANCE_SCALE,
} from './map-camera.ts'

describe('map camera zoom', () => {
  it('widens portrait framing without changing landscape framing', () => {
    expect(mapCameraFieldOfView(16 / 9)).toBe(44)
    expect(mapCameraFieldOfView(1)).toBe(44)
    expect(mapCameraFieldOfView(9 / 16)).toBeGreaterThan(70)
    expect(mapCameraFieldOfView(9 / 16)).toBeLessThanOrEqual(82)
  })

  it('caps extreme portrait framing and handles invalid measurements', () => {
    expect(mapCameraFieldOfView(0.25)).toBe(82)
    expect(mapCameraFieldOfView(Number.NaN)).toBe(44)
  })

  it('uses a closer home framing for the Zürich study', () => {
    expect(homeMapDistanceScale('switzerland')).toBe(1)
    expect(homeMapDistanceScale('zvv')).toBeCloseTo(0.24)
    expect(homeMapDistanceScale('geneva')).toBeCloseTo(0.13)
    expect(homeMapDistanceScale('zurich')).toBeCloseTo(0.06)
    expect(homeMapDistanceScale('zurich')).toBeGreaterThan(MIN_MAP_DISTANCE_SCALE)
  })

  it('preserves direct movement inside the useful zoom range', () => {
    expect(applyMapZoom(1, 0.9)).toBeCloseTo(0.9)
    expect(applyMapZoom(0.8, 1.1)).toBeCloseTo(0.88)
  })

  it('eases toward the outer boundary without entering the fog', () => {
    const first = applyMapZoom(1, 1.4)
    const second = applyMapZoom(first, 1.4)

    expect(first).toBeGreaterThan(1)
    expect(second).toBeGreaterThan(first)
    expect(second).toBeLessThan(MAX_MAP_DISTANCE_SCALE)
  })

  it('also softens the closest zoom boundary', () => {
    const result = applyMapZoom(0.025, 0.5)

    expect(result).toBeGreaterThan(MIN_MAP_DISTANCE_SCALE)
    expect(result).toBeLessThan(0.025)
  })

  it('provides several close-range steps below the previous limit', () => {
    const first = applyMapZoom(0.3, 0.78)
    const second = applyMapZoom(first, 0.78)
    const third = applyMapZoom(second, 0.78)

    expect(first).toBeLessThan(0.3)
    expect(second).toBeLessThan(first)
    expect(third).toBeLessThan(second)
    expect(third).toBeGreaterThan(MIN_MAP_DISTANCE_SCALE)
  })

  it('keeps finger and mouse drags responsive at the same zoom', () => {
    expect(mapPanScale(1, 'touch')).toBeCloseTo(0.078)
    expect(mapPanScale(1, 'mouse')).toBeCloseTo(0.064)
    expect(mapPanScale(1, 'touch')).toBeGreaterThan(mapPanScale(1, 'mouse'))
    expect(mapPanScale(0.2, 'touch')).toBeCloseTo(0.0156)
  })

  it('catches the camera up quickly during pointer manipulation', () => {
    expect(mapCameraDampingRate(false, true)).toBe(11)
    expect(mapCameraDampingRate(false, false)).toBe(8)
    expect(mapCameraDampingRate(true, true)).toBe(1.7)
  })

  it('turns wheel movement into a brisk zoom multiplier', () => {
    expect(mapWheelZoomMultiplier(100)).toBeCloseTo(Math.exp(0.2))
    expect(mapWheelZoomMultiplier(-100)).toBeCloseTo(Math.exp(-0.2))
    expect(mapWheelZoomMultiplier(3, 1)).toBeCloseTo(Math.exp(0.096))
  })
})
