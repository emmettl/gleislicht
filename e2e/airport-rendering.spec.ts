/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { RootState } from '@react-three/fiber'
import type * as THREE from 'three'

async function renderedAirports(page: Page) {
  return page.evaluate(async () => {
    const fiberUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/@react-three_fiber.js'))?.name
    if (!fiberUrl) return
    const { _roots } = await import(fiberUrl)
    const root = [..._roots.values()][0]
    if (!root) return
    const { scene } = root.store.getState() as RootState
    const airports: { name: string; order: number; opacity: number; depthTest: boolean; fog: boolean }[] = []
    let otherLabelOrder = 0
    scene.traverseVisible(object => {
      const sprite = object as THREE.Sprite
      if (!sprite.isSprite || sprite.material.opacity === 0) return
      if (sprite.name.startsWith('airport-label:')) {
        airports.push({ name: sprite.name, order: sprite.renderOrder, opacity: sprite.material.opacity, depthTest: sprite.material.depthTest, fog: sprite.material.fog })
      } else otherLabelOrder = Math.max(otherLabelOrder, sprite.renderOrder)
    })
    return { airports, otherLabelOrder }
  })
}

test('Air keeps airport labels above other labels through loading, filters and vehicle-label changes', async ({ page, isMobile }) => {
  const errors: string[] = []
  const rendererRequests: string[] = []
  page.on('request', request => { if (request.url().includes('/AirTrafficLayer.js')) rendererRequests.push(request.url()) })
  page.on('pageerror', error => errors.push(error.message))
  let releaseFlights!: () => void
  const flightsReady = new Promise<void>(resolve => { releaseFlights = resolve })
  await page.route('**/data/swiss-air-morning.json', async route => {
    await flightsReady
    await route.continue()
  })
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await expect.poll(async () => (await renderedAirports(page))?.airports.length).toBe(0)
  expect(rendererRequests).toHaveLength(0)
  const toggle = page.locator(isMobile ? '.mobile-air-toggle' : '.network-study-picker .air-toggle')
  await toggle.click()
  const assertAirports = async () => {
    await expect.poll(async () => (await renderedAirports(page))?.airports.length).toBe(3)
    const state = (await renderedAirports(page))!
    expect(state.airports.map(airport => airport.name).sort()).toEqual(['airport-label:basel', 'airport-label:geneva', 'airport-label:zurich'])
    for (const airport of state.airports) {
      expect(airport.order).toBeGreaterThan(state.otherLabelOrder)
      expect(airport.opacity).toBeGreaterThanOrEqual(0.9)
      expect(airport.depthTest).toBe(false)
      expect(airport.fog).toBe(false)
    }
  }
  // Airports appear before the flight snapshot arrives and never duplicate it.
  try { await assertAirports() } finally { releaseFlights() }
  expect(rendererRequests.length).toBeGreaterThan(0)
  await expect(page.locator('.network-card .air-count')).toHaveAttribute('aria-label', /Aircraft aloft/)
  await assertAirports()

  if (isMobile) {
    const tools = page.locator('.mobile-map-tools details')
    await tools.locator('summary').click()
    await expect(tools.locator(':scope > div')).toBeVisible()
    const toggleBox = (await tools.locator('summary').boundingBox())!
    const panelBox = (await tools.locator(':scope > div').boundingBox())!
    expect(panelBox.y).toBeGreaterThanOrEqual(toggleBox.y + toggleBox.height)
    const services = tools.locator('.mobile-tool-field').first().locator('.mobile-picker')
    await services.locator('.mobile-picker__trigger').click()
    await services.getByRole('option', { name: 'IC', exact: true }).click()
    const labels = tools.locator('.mobile-tool-field').nth(1).locator('.mobile-picker')
    await labels.locator('.mobile-picker__trigger').click()
    await labels.getByRole('option', { name: 'off', exact: true }).click()
    await tools.locator('summary').click()
  } else {
    await page.locator('.service-legend').getByRole('button', { name: 'IC', exact: true }).click()
    const labels = page.locator('.train-label-toggle')
    await labels.click()
    await labels.click()
    await expect(labels).toContainText('off')
  }
  await assertAirports()

  await toggle.click()
  await expect.poll(async () => (await renderedAirports(page))?.airports.length).toBe(0)
  await toggle.click()
  await assertAirports()
  expect(errors).toEqual([])
})
