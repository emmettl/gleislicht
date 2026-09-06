import { describe, expect, it } from 'vitest'
import {
  localNetworkDetailAtZoom,
  regionalCameraHeight,
  vehicleIsVisibleAtZoom,
} from './regional-lod.ts'

const region = {
  homeDistanceScale: 0.24,
  minimumDistanceScale: 0.012,
  localDetailHierarchy: true,
}
const compactRegion = { ...region, homeDistanceScale: 0.13 }
const atlas = { homeDistanceScale: 1, minimumDistanceScale: 0.02 }

describe('regional level of detail', () => {
  it('normalises the ZVV home view to the national camera scale', () => {
    expect(regionalCameraHeight(37 * 0.24, region)).toBeCloseTo(37)
    expect(regionalCameraHeight(37 * 0.13, compactRegion)).toBeCloseTo(37)
    expect(regionalCameraHeight(12, atlas)).toBe(12)
  })

  it('reveals trams before buses while descending into the region', () => {
    expect(vehicleIsVisibleAtZoom('s-bahn', 37 * 0.24, region)).toBe(true)
    expect(vehicleIsVisibleAtZoom('tram', 37 * 0.24, region)).toBe(false)
    expect(vehicleIsVisibleAtZoom('tram', 28 * 0.24, region)).toBe(true)
    expect(vehicleIsVisibleAtZoom('bus', 28 * 0.24, region)).toBe(false)
    expect(vehicleIsVisibleAtZoom('bus', 18 * 0.24, region)).toBe(true)
  })

  it('always reveals a focused local service', () => {
    expect(vehicleIsVisibleAtZoom('bus', 37 * 0.24, region, true)).toBe(true)
  })

  it('fades local street geometry in beneath the weighted corridor layer', () => {
    expect(localNetworkDetailAtZoom(37 * 0.24, region)).toBe(0)
    expect(localNetworkDetailAtZoom(26 * 0.24, region)).toBeCloseTo(0.5)
    expect(localNetworkDetailAtZoom(20 * 0.24, region)).toBe(1)
    expect(localNetworkDetailAtZoom(37, atlas)).toBe(1)
  })
})
