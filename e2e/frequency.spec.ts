import { expect, test, type Page } from '@playwright/test'

async function openZvv(page: Page, mobile: boolean) {
  if (mobile) {
    await page.locator('.mobile-study-picker .mobile-picker__trigger').click()
    await page.getByRole('option', { name: /ZVV/ }).click()
  } else await page.getByRole('button', { name: 'Show the ZVV regional multimodal network', exact: true }).click()
}

test('real ZVV headway ferries remain lazy and show their approximate motion model', async ({ page, isMobile }, testInfo) => {
  const requests: string[] = [], errors: string[] = []
  page.on('request', request => { if (request.url().includes('zvv-region')) requests.push(request.url()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  expect(requests).toEqual([])
  await openZvv(page, isMobile)
  await expect(page.locator('.network-card .between')).toContainText('Includes illustrative headway motion')
  const search = page.locator('.train-search input')
  await search.fill('3735')
  const result = page.getByRole('option').filter({ hasText: 'Headway model' }).first()
  await expect(result).toContainText('≈')
  await result.click()
  await expect(page.locator('.selected-card .frequency-note')).toContainText('Illustrative motion · published interval:')
  await expect(page.locator('.selected-card')).toContainText('Illustrated arrival')
  await expect(page.locator('.selected-card')).toContainText('≈')
  await page.screenshot({ path: testInfo.outputPath('headway-ferry.png') })
  expect(errors).toEqual([])
})

test('exact repeating departures retain scheduled labels', async ({ page, isMobile }) => {
  await page.route('**/zvv-region-morning.json', route => route.fulfill({ json: {
    metadata: { publisher: 'Fixture', feedVersion: 'fixture', serviceDate: '2026-09-04', windowStart: 24300, windowEnd: 31500, focusTime: 27900, sourceUrl: '', model: 'schedule', note: 'Synthetic exact-frequency test fixture' },
    bounds: { minLongitude: 8.55, maxLongitude: 8.65, minLatitude: 47.25, maxLatitude: 47.28 },
    stops: [[8.6, 47.27, 'Exact Valley'], [8.61, 47.28, 'Exact Summit']], edges: [[0, 1]],
    trains: [{ id: 'frequency:fixture:27900', route: 'ExactLift', category: 'cableway', headsign: 'Exact Summit', shortName: '', start: 27900, end: 28500, stops: [[0, 27900, 27900], [1, 28500, 28500]], frequency: { sourceTripId: 'fixture', startTime: 24300, endTime: 31500, headwaySeconds: 600, exactTimes: 1 } }],
  } }))
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await openZvv(page, isMobile)
  await page.locator('.train-search input').fill('ExactLift')
  await page.getByRole('option', { name: /ExactLift 07:45 · Exact Valley → Exact Summit/ }).click()
  await expect(page.locator('.selected-card')).toBeVisible()
  await expect(page.locator('.selected-card')).not.toContainText('≈')
  await expect(page.locator('.selected-card .frequency-note')).toHaveCount(0)
  await expect(page.locator('.selected-card')).toContainText('Plan')
})
