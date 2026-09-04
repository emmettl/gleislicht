import { describe, expect, it } from 'vitest'
import {
  localNetworkDetailAtZoom,
  regionalCameraHeight,
  vehicleIsVisibleAtZoom,
} from './regional-lod.ts'

describe('regional level of detail', () => {
  it('normalises the ZVV home view to the national camera scale', () => {
    expect(regionalCameraHeight(37 * 0.24, 'zvv')).toBeCloseTo(37)
    expect(regionalCameraHeight(12, 'switzerland')).toBe(12)
  })

  it('reveals trams before buses while descending into the region', () => {
    expect(vehicleIsVisibleAtZoom('s-bahn', 37 * 0.24, 'zvv')).toBe(true)
    expect(vehicleIsVisibleAtZoom('tram', 37 * 0.24, 'zvv')).toBe(false)
    expect(vehicleIsVisibleAtZoom('tram', 28 * 0.24, 'zvv')).toBe(true)
    expect(vehicleIsVisibleAtZoom('bus', 28 * 0.24, 'zvv')).toBe(false)
    expect(vehicleIsVisibleAtZoom('bus', 18 * 0.24, 'zvv')).toBe(true)
  })

  it('always reveals a focused local service', () => {
    expect(vehicleIsVisibleAtZoom('bus', 37 * 0.24, 'zvv', true)).toBe(true)
  })

  it('fades local street geometry in beneath the weighted corridor layer', () => {
    expect(localNetworkDetailAtZoom(37 * 0.24, 'zvv')).toBe(0)
    expect(localNetworkDetailAtZoom(26 * 0.24, 'zvv')).toBeCloseTo(0.5)
    expect(localNetworkDetailAtZoom(20 * 0.24, 'zvv')).toBe(1)
    expect(localNetworkDetailAtZoom(37, 'switzerland')).toBe(1)
  })
})
