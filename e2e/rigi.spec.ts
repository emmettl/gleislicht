import { expect, test, type Page } from '@playwright/test'

async function openRigi(page: Page, mobile: boolean) {
  if (mobile) {
    await page.locator('.mobile-study-picker .mobile-picker__trigger').click()
    await page.getByRole('option', { name: /RIGI/ }).click()
  } else await page.getByRole('button', { name: 'Explore Lake Lucerne and Rigi', exact: true }).click()
}

test('Rigi loads on demand with a full day, discoverable modes and disclosed boat paths', async ({ page, isMobile }, testInfo) => {
  const requests: string[] = [], errors: string[] = []
  page.on('request', request => { if (request.url().includes('rigi-day.json')) requests.push(request.url()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  expect(requests).toHaveLength(0)
  await openRigi(page, isMobile)
  await expect(page.locator('h1')).toHaveText('Lake → Rigi')
  await expect(page.locator('.network-card')).toContainText('190')
  await expect(page.locator('.network-card')).toContainText('24h')
  await expect(page.locator('.network-card .between')).toContainText('boats, cogwheel railways and cableway')
  await expect(page.locator('.scrubber input[type="range"]')).toHaveAttribute('max', '86400')
  if (isMobile) await expect(page.locator('.mobile-study-picker .mobile-picker__trigger')).toHaveText('RIGI')
  await page.getByRole('button', { name: /Pause motion/i }).click()
  await page.locator('.scrubber input').fill('0')
  await expect(page.locator('.network-count-row strong').first()).toHaveText('0')
  await page.locator('.scrubber input').fill('43200')
  if (isMobile) {
    const tools = page.locator('.mobile-map-tools details')
    await tools.locator('summary').click()
    const picker = tools.locator('.mobile-tool-field').first().locator('.mobile-picker')
    await picker.locator('.mobile-picker__trigger').click()
    await picker.getByRole('option', { name: 'Cogwheel', exact: true }).click()
    await expect(picker.locator('.mobile-picker__trigger')).toContainText('Cogwheel')
    await picker.locator('.mobile-picker__trigger').click()
    await picker.getByRole('option', { name: 'All services', exact: true }).click()
    await tools.locator('summary').click()
  } else {
    const filter = page.locator('.service-legend').getByRole('button', { name: 'Cogwheel', exact: true })
    await filter.click()
    await expect(filter).toHaveAttribute('aria-pressed', 'true')
    await filter.click()
  }
  await expect(page.locator('.scene canvas')).toBeVisible()
  await page.waitForTimeout(1000) // Allow the newly mounted map's camera to settle for visual review.
  await page.screenshot({ path: testInfo.outputPath('rigi-overview.png') })
  await page.locator('.train-search input').fill('Vierwaldstättersee')
  await page.getByRole('option').filter({ has: page.locator('.result-service b') }).first().click()
  await expect(page.locator('.selected-card')).toContainText('Boat paths modelled within the lake')
  await page.locator('.train-search input').fill('Weggis-Rigi Kaltbad')
  await page.getByRole('option').filter({ has: page.locator('.result-service b') }).first().click()
  await expect(page.locator('.selected-card')).toContainText('Mapped cableway alignment')
  await page.locator('.train-search input').fill('Rigi Bahnen')
  await page.getByRole('option').filter({ has: page.locator('.result-service b') }).first().click()
  await expect(page.locator('.selected-card')).toContainText('Cogwheel')
  await page.screenshot({ path: testInfo.outputPath('rigi-cogwheel.png') })
  expect(requests).toHaveLength(1)
  expect(errors).toEqual([])
})

test('Rigi failure is disclosed and a different study remains accessible', async ({ page, isMobile }) => {
  await page.route('**/rigi-day.json', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('/')
  await openRigi(page, isMobile)
  await expect(page.locator('.network-card')).toContainText('Lake Lucerne–Rigi is unavailable')
  if (isMobile) {
    await page.locator('.mobile-study-picker .mobile-picker__trigger').click()
    await page.getByRole('option', { name: /^CH / }).click()
  } else await page.locator('.network-study-picker button').filter({ hasText: /^CH$/ }).click()
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
})
