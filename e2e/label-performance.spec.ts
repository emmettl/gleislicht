import { expect, test, type Page } from '@playwright/test'
import type { RootState } from '@react-three/fiber'
import type * as THREE from 'three'

async function sceneSample(page: Page) {
  return page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').find(entry => entry.name.includes('/@react-three_fiber.js'))?.name
    if (!url) return
    const { _roots } = await import(url)
    const root = [..._roots.values()][0]
    if (!root) return
    const { scene } = root.store.getState() as RootState
    const markers: { id: string; version: number; count: number; positions: number[] }[] = []
    const labels: { id: string; position: number[] }[] = []
    const trails: { id: string; version: number; count: number }[] = []
    const seen = new Set<string>()
    scene.traverseVisible(object => {
      const point = object as THREE.Points
      if (point.isPoints && object.renderOrder === 11 && !seen.has(point.geometry.uuid)) {
        seen.add(point.geometry.uuid)
        const position = point.geometry.getAttribute('position') as THREE.BufferAttribute
        markers.push({ id: point.geometry.uuid, version: position.version, count: point.geometry.drawRange.count,
          positions: Array.from(position.array.slice(0, point.geometry.drawRange.count * 3)) })
      }
      const line = object as THREE.LineSegments
      if (line.isLineSegments && object.renderOrder >= 3 && object.renderOrder <= 5 && line.geometry.hasAttribute('color')) {
        trails.push({ id: line.geometry.uuid, version: (line.geometry.getAttribute('position') as THREE.BufferAttribute).version, count: line.geometry.drawRange.count })
      }
      const sprite = object as THREE.Sprite
      if (sprite.isSprite && object.renderOrder === 16) labels.push({ id: sprite.uuid, position: sprite.position.toArray() })
    })
    return { markers, labels, trails }
  })
}

for (const blockedWorker of [false, true]) {
test(`paused geometry stays unchanged and follows seeks (${blockedWorker ? 'synchronous trails' : 'worker trails'})`, async ({ page }) => {
  if (blockedWorker) await page.addInitScript(() => { window.Worker = class { constructor() { throw new Error('Worker blocked for fallback test') } } as unknown as typeof Worker })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await page.getByRole('button', { name: /Pause motion/i }).click()
  await page.locator('.scrubber input').fill('27900')
  await expect.poll(async () => (await sceneSample(page))?.labels.length ?? 0).toBeGreaterThan(0)
  // Let the initial camera spring settle before checking unchanged buffers.
  await expect(async () => {
    const before = await sceneSample(page)
    expect(before?.markers.some(marker => marker.count > 0)).toBe(true)
    expect(before?.trails.some(trail => trail.count > 0)).toBe(true)
    await page.waitForTimeout(250)
    expect(await sceneSample(page)).toEqual(before)
  }).toPass({ timeout: 15000 })
  const paused = await sceneSample(page)
  await page.locator('.scrubber input').fill('27960')
  await expect.poll(async () => JSON.stringify((await sceneSample(page))?.markers)).not.toBe(JSON.stringify(paused?.markers))
  await expect.poll(async () => JSON.stringify((await sceneSample(page))?.labels)).not.toBe(JSON.stringify(paused?.labels))
  const sought = await sceneSample(page)
  await page.getByRole('button', { name: /Resume motion/i }).click()
  await expect.poll(async () => JSON.stringify((await sceneSample(page))?.markers)).not.toBe(JSON.stringify(sought?.markers))
  await expect.poll(async () => JSON.stringify((await sceneSample(page))?.labels)).not.toBe(JSON.stringify(sought?.labels))
  expect(errors).toEqual([])
})
}
