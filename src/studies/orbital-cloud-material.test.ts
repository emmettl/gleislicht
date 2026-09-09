import { describe, expect, it } from 'vitest'
import { createCloudMaterialResources, updateCloudMaterialResources, disposeCloudMaterialResources } from './orbital-cloud-material.ts'
import type { CloudField } from './orbital-clouds.ts'

const field: CloudField = {
  manifest: { version: 1, columns: 2, rows: 2, bounds: { west: 6, east: 10, south: 46, north: 48 }, intervalSeconds: 3600, missingValue: 255, days: [] },
  day: { date: '2026-09-04', available: true, frames: 25 },
  values: Uint8Array.from({ length: 25 * 4 }, (_, index) => Math.floor(index / 4) * 4),
}

describe('cloud shading shared with land', () => {
  it('keeps shadows subtle by day and removes them at night or with sunlight off', () => {
    const resources = createCloudMaterialResources(field)
    try {
      updateCloudMaterialResources(resources, 13 * 3600, 0.65, true)
      expect(resources.uniforms.orbitalCloudShadow.value).toBeCloseTo(0.117)
      expect(resources.uniforms.illumination.value).toBe(1)
      updateCloudMaterialResources(resources, 0, 0.65, true)
      expect(resources.uniforms.orbitalCloudShadow.value).toBe(0)
      expect(resources.uniforms.illumination.value).toBe(0.25)
      updateCloudMaterialResources(resources, 13 * 3600, 0.65, false)
      expect(resources.uniforms.orbitalCloudShadow.value).toBe(0)
      expect(resources.uniforms.illumination.value).toBe(1)
      updateCloudMaterialResources(resources, 13 * 3600, 0, true)
      expect(resources.uniforms.orbitalCloudShadow.value).toBe(0)
    } finally { disposeCloudMaterialResources(resources) }
  })
  it('projects towards the morning and evening sun, with finite rays at midnight', () => {
    const resources = createCloudMaterialResources(field)
    try {
      updateCloudMaterialResources(resources, 8 * 3600, 0.65, true)
      expect(resources.uniforms.orbitalCloudSunSlope.value.x).toBeGreaterThan(0)
      updateCloudMaterialResources(resources, 18 * 3600, 0.65, true)
      expect(resources.uniforms.orbitalCloudSunSlope.value.x).toBeLessThan(0)
      updateCloudMaterialResources(resources, 0, 0.65, true)
      expect(resources.uniforms.orbitalCloudSunSlope.value.toArray().every(Number.isFinite)).toBe(true)
    } finally { disposeCloudMaterialResources(resources) }
  })
  it('shares two textures across seeks and retains the final observation at midnight', () => {
    const resources = createCloudMaterialResources(field), a = resources.a, b = resources.b
    try {
      updateCloudMaterialResources(resources, 5400, 0.65, true)
      expect(resources.uniforms.orbitalCloudBlend.value).toBe(0.5)
      expect(a.image.data![0]).toBe(10)
      expect(b.image.data![0]).toBe(20)
      updateCloudMaterialResources(resources, 86400, 0.65, true)
      expect(resources.uniforms.orbitalCloudBlend.value).toBe(1)
      expect(b.image.data![0]).toBe(245)
      expect(resources.uniforms.orbitalCloudA.value).toBe(a)
      expect(resources.uniforms.orbitalCloudB.value).toBe(b)
    } finally { disposeCloudMaterialResources(resources) }
  })
})
