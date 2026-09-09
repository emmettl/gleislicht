/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { RootState } from '@react-three/fiber'
import type * as THREE from 'three'

async function hubLines(page: Page) {
  return page.evaluate(async () => {
    const fiberUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/@react-three_fiber.js'))?.name
    if (!fiberUrl) return
    const { _roots } = await import(fiberUrl)
    const root = [..._roots.values()][0]
    if (!root) return
    const { scene } = root.store.getState() as RootState
    const lines: { vertices: number; opacity: number }[] = []
    scene.traverseVisible(object => {
      const line = object as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
      if (line.isLineSegments) lines.push({ vertices: line.geometry.getAttribute('position').count, opacity: line.material.opacity })
    })
    return lines
  })
}

test('hub batches retain every clock tick and respond to category selection', async ({ page, isMobile }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  if (isMobile) await page.locator('.mobile-more-controls summary').click()
  await page.getByRole('button', { name: 'Takt hubs', exact: true }).click()
  if (isMobile) await page.locator('.mobile-more-controls summary').click()
  await expect(page.locator('.hub-card')).toBeVisible()
  const ticks = async () => (await hubLines(page))?.filter(line => [0.92, 0.5, 0.2].includes(line.opacity))
  await expect.poll(ticks).toEqual([
    { vertices: 8, opacity: 0.92 }, { vertices: 96, opacity: 0.2 }, { vertices: 16, opacity: 0.5 },
  ])
  const before = (await hubLines(page))!
  expect(before.some(line => line.opacity === 0.12)).toBe(true)
  if (!isMobile) {
    // Exercise keyboard activation too; the transport panel overlaps the legend
    // at the short desktop test viewport.
    const category = page.locator('.service-legend').getByRole('button', { name: 'IC', exact: true })
    await category.focus()
    await category.press('Enter')
    await expect.poll(async () => (await hubLines(page))?.some(line => line.opacity === 0.025)).toBe(true)
    expect((await hubLines(page))!.reduce((sum, line) => sum + line.vertices, 0)).toBe(before.reduce((sum, line) => sum + line.vertices, 0))
  }

  expect(errors).toEqual([])
})
