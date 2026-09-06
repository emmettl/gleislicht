import { describe, expect, it } from 'vitest'
import {
  applyMapZoom,
  homeMapDistanceScale,
  mapCameraFieldOfView,
  mapCameraDampingRate,
  mapPanScale,
  mapSelectionNeedsReveal,
  mapWheelZoomMultiplier,
  MAX_MAP_DISTANCE_SCALE,
  MIN_MAP_DISTANCE_SCALE,
  minimumMapDistanceScale,
  STATION_SELECTION_PULSE_COUNT,
  stationSelectionPulseFrame,
} from './map-camera.ts'

const atlas = { homeDistanceScale: 1, minimumDistanceScale: 0.02 }
const wideRegion = { homeDistanceScale: 0.24, minimumDistanceScale: 0.012 }
const compactRegion = {
  homeDistanceScale: 0.13,
  minimumDistanceScale: 0.01,
  portraitMinimumDistanceScale: 0.008,
}
const city = {
  homeDistanceScale: 0.06,
  minimumDistanceScale: 0.01,
  portraitMinimumDistanceScale: 0.008,
}

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
    expect(homeMapDistanceScale(atlas)).toBe(1)
    expect(homeMapDistanceScale(wideRegion)).toBeCloseTo(0.24)
    expect(homeMapDistanceScale(compactRegion)).toBeCloseTo(0.13)
    expect(homeMapDistanceScale(city)).toBeCloseTo(0.06)
    expect(homeMapDistanceScale(city)).toBeGreaterThan(MIN_MAP_DISTANCE_SCALE)
  })

  it('allows a substantially tighter close zoom in portrait city studies', () => {
    expect(minimumMapDistanceScale(atlas, 390 / 844)).toBe(0.02)
    expect(minimumMapDistanceScale(wideRegion, 390 / 844)).toBe(0.012)
    expect(minimumMapDistanceScale(compactRegion, 390 / 844)).toBe(0.008)
    expect(minimumMapDistanceScale(city, 390 / 844)).toBe(0.008)
    expect(minimumMapDistanceScale(city, 16 / 9)).toBe(0.01)

    const closeCityZoom = applyMapZoom(0.011, 0.5, 0.008)
    expect(closeCityZoom).toBeGreaterThan(0.008)
    expect(closeCityZoom).toBeLessThan(0.011)
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

  it('only reveals selections outside the safe viewport', () => {
    expect(mapSelectionNeedsReveal({ x: 0, y: 0, z: 0 })).toBe(false)
    expect(mapSelectionNeedsReveal({ x: 0.89, y: 0.85, z: 0 })).toBe(false)
    expect(mapSelectionNeedsReveal({ x: 0.91, y: 0, z: 0 })).toBe(true)
    expect(mapSelectionNeedsReveal({ x: 0, y: -0.87, z: 0 })).toBe(true)
    expect(mapSelectionNeedsReveal({ x: 0, y: 0, z: 1.01 })).toBe(true)
    expect(mapSelectionNeedsReveal({ x: Number.NaN, y: 0, z: 0 })).toBe(true)
  })

  it('staggers expanding station-selection rings and fades each one out', () => {
    const first = stationSelectionPulseFrame(0, 0)
    const later = stationSelectionPulseFrame(1, 0)
    const staggered = stationSelectionPulseFrame(0, 1)

    expect(STATION_SELECTION_PULSE_COUNT).toBe(3)
    expect(first.radiusPixels).toBe(14)
    expect(first.opacity).toBeCloseTo(0.64)
    expect(later.radiusPixels).toBeGreaterThan(first.radiusPixels)
    expect(later.opacity).toBeLessThan(first.opacity)
    expect(staggered.radiusPixels).toBeGreaterThan(first.radiusPixels)
  })

  it('turns wheel movement into a brisk zoom multiplier', () => {
    expect(mapWheelZoomMultiplier(100)).toBeCloseTo(Math.exp(0.2))
    expect(mapWheelZoomMultiplier(-100)).toBeCloseTo(Math.exp(-0.2))
    expect(mapWheelZoomMultiplier(3, 1)).toBeCloseTo(Math.exp(0.096))
  })
})
