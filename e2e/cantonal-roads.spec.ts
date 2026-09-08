import { expect, test } from '@playwright/test'

test('cantonal roads load on demand, can be selected and disclose geometry-only coverage', async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  const cantonRequests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().includes('zurich-cantonal-road-topology.json')) cantonRequests.push(request.url()) })
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  expect(cantonRequests).toEqual([])
  await page.locator(isMobile ? '.mobile-road-toggle' : '.network-study-picker .road-toggle').click()
  await expect.poll(() => cantonRequests.length).toBe(1)
  const search = page.locator('.train-search input[type="search"]')
  await search.fill('ZH 17')
  await page.locator('.search-results .road-result').filter({ hasText: 'ZH 17' }).first().click()
  await expect(page.locator('.road-corridor-card')).toContainText('ZH 17')
  await expect(page.locator('.road-corridor-card')).toContainText('Road geometry only')
  await expect(page.locator('.road-corridor-card')).not.toContainText('≈0')
  await expect(page.locator('.road-corridor-card .metric-grid strong').first()).toHaveText(/≈[1-9]/)
  await expect(page.locator('.road-corridor-card a', { hasText: 'AUTO · Kanton Zürich' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cantonal-road-17.png') })
  expect(errors).toEqual([])
})

test('national roads remain available when the cantonal artifact is unavailable', async ({ page, isMobile }) => {
  await page.route('**/zurich-cantonal-road-topology.json', route => route.fulfill({ status: 404, body: '' }))
  await page.goto('/')
  await page.locator(isMobile ? '.mobile-road-toggle' : '.network-study-picker .road-toggle').click()
  const search = page.locator('.train-search input[type="search"]')
  await search.fill('Gotthard')
  await page.locator('.search-results .road-result').first().click()
  await expect(page.locator('.road-corridor-card')).toContainText('A2')
  await expect(page.locator('.road-corridor-card')).not.toContainText('Road geometry only')
})
