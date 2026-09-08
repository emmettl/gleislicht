import { expect, test, type Page } from '@playwright/test'
import catalogue from '../public/data/swiss-cogwheel-catalogue.json' with { type: 'json' }

const fullDayTrips = Object.keys(catalogue.trips).length

async function chooseCogwheel(page: Page, mobile: boolean, enable = true) {
  if (mobile) {
    const tools = page.locator('.mobile-map-tools details')
    if (!(await tools.evaluate(element => (element as HTMLDetailsElement).open))) await tools.locator('summary').click()
    const picker = tools.locator('.mobile-tool-field').first().locator('.mobile-picker')
    await picker.locator('.mobile-picker__trigger').click()
    await picker.getByRole('option', { name: enable ? 'Cogwheel' : 'All services', exact: true }).click()
    await tools.locator('summary').click()
  } else await page.locator('.service-legend').getByRole('button', { name: 'Cogwheel', exact: true }).click()
  await expect(page.locator('main')).toHaveAttribute('data-cogwheel-enabled', String(enable))
}

test('cogwheel discovery is lazy, source-backed, searchable and survives day changes', async ({ page, isMobile }, testInfo) => {
  const requests: string[] = [], errors: string[] = []
  page.on('request', request => { if (request.url().includes('swiss-cogwheel')) requests.push(request.url()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  expect(requests).toEqual([])
  await chooseCogwheel(page, isMobile)
  await expect(page.locator('.network-card .between')).toContainText('Cogwheel railways')
  expect(requests.length).toBeGreaterThan(0)
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  if (isMobile) {
    await page.locator('.mobile-study-picker .mobile-picker__trigger').click()
    await page.getByRole('option').filter({ hasText: '24H' }).click()
  } else await page.locator('.network-study-picker').getByRole('button', { name: /24-hour/ }).click()
  await expect(page.locator('main')).toHaveAttribute('data-cogwheel-enabled', 'true')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  await page.getByRole('button', { name: /Pause motion/i }).click()
  await page.locator('.scrubber input').fill('36000')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  await expect(page.locator('.scrubber input')).toHaveValue('36000')
  await expect(page.locator('.network-card .metric-grid strong').first()).toHaveText(String(fullDayTrips))
  const search = page.locator('.train-search input')
  await search.fill('Rigi Bahnen')
  await expect(page.locator('.result-service b').first()).toBeVisible()
  await page.locator('.result-service b').first().click()
  await expect(page.locator('.selected-card')).toContainText('Rigi Bahnen AG')
  await expect(page.locator('.selected-card')).toContainText('Cogwheel')
  await expect.poll(async () => Number(await page.locator('.scrubber input').inputValue())).toBeGreaterThanOrEqual(36000)
  await page.screenshot({ path: testInfo.outputPath('cogwheel-selected.png') })
  expect(errors).toEqual([])
})

for (const failure of ['missing', 'mismatch']) test(`cogwheel ${failure} catalogue is disclosed and the national view can be restored`, async ({ page, isMobile }) => {
  await page.route('**/swiss-cogwheel-catalogue.json', route => failure === 'missing'
    ? route.fulfill({ status: 503, body: '' })
    : route.fulfill({ json: { metadata: { feedVersion: 'wrong', serviceDate: '2020-01-01' }, routes: {}, trips: {} } }))
  await page.goto('/')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  await chooseCogwheel(page, isMobile)
  await expect(page.locator('.network-card')).toContainText('Cogwheel catalogue unavailable')
  await expect(page.locator('.network-count-row strong').first()).toHaveText('—')
  await chooseCogwheel(page, isMobile, false)
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('0')
})
