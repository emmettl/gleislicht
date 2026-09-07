/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { RootState } from '@react-three/fiber'
import type * as THREE from 'three'

async function renderedRoads(page: Page) {
  return page.evaluate(async () => {
    const fiberUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/@react-three_fiber.js'))?.name
    if (!fiberUrl) return
    const { _roots } = await import(fiberUrl)
    const root = [..._roots.values()][0]
    if (!root) return
    const { scene, camera } = root.store.getState() as RootState
    const group = scene.getObjectByName('motorway-labels')
    if (!group) return
    const lines: { vertices: number; opacity: number; depthTest: boolean }[] = []
    scene.traverseVisible(object => {
      const line = object as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
      if (line.isLineSegments && line.material.color.getHexString() === 'a0a6b2') {
        lines.push({ vertices: line.geometry.getAttribute('position').count, opacity: line.material.opacity, depthTest: line.material.depthTest })
      }
    })
    return {
      lines,
      camera: camera.matrixWorld.toArray(),
      anchors: group.children.map(sprite => ({ id: sprite.name, position: sprite.position.toArray() })),
      visible: group.children.filter(sprite => sprite.visible).map(sprite => sprite.name),
    }
  })
}

test('motorway geometry and fixed labels survive empty traffic and road selection', async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/data/swiss-road-morning.json', async route => {
    const response = await route.fetch()
    const snapshot = await response.json()
    await route.fulfill({ json: { ...snapshot, corridors: [] } })
  })
  await page.route('**/data/swiss-road-national-manifest.json', route => route.fulfill({ status: 404, body: '' }))
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await page.locator(isMobile ? '.mobile-road-toggle' : '.network-study-picker .road-toggle').click()
  await expect(page.locator('.network-card .road-count')).toHaveAttribute('aria-label', /^0 estimated road vehicles/)
  await expect.poll(async () => (await renderedRoads(page))?.visible.length ?? 0).toBeGreaterThan(0)
  const overview = (await renderedRoads(page))!
  expect(overview.lines).toHaveLength(2)
  for (const line of overview.lines) {
    expect(line.vertices).toBeGreaterThan(0)
    expect(line.opacity).toBeGreaterThanOrEqual(0.2)
    expect(line.depthTest).toBe(false)
  }

  const search = page.locator('.train-search input[type="search"]')
  await search.fill('Gotthard')
  await page.locator('.search-results .road-result').first().click()
  await expect(page.locator('.road-corridor-card')).toContainText('A2')
  await expect.poll(async () => (await renderedRoads(page))?.lines.length).toBe(3)
  const selected = (await renderedRoads(page))!
  const original = new Map(overview.anchors.map(anchor => [anchor.id, anchor.position]))
  expect(selected.anchors).toHaveLength(overview.anchors.length)
  for (const anchor of selected.anchors) expect(anchor.position).toEqual(original.get(anchor.id))
  for (const line of selected.lines) {
    expect(line.vertices).toBeGreaterThan(0)
    expect(line.opacity).toBeGreaterThanOrEqual(0.15)
    expect(line.depthTest).toBe(false)
  }
  // The road focus animates the camera; label world coordinates stay fixed.
  await expect.poll(async () => (await renderedRoads(page))?.camera).not.toEqual(overview.camera)
  await expect.poll(async () => (await renderedRoads(page))?.visible.length ?? 0).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath('empty-traffic-roads.png') })
  expect(errors).toEqual([])
})
