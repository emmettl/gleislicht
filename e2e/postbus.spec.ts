import { expect, test, type Page } from '@playwright/test'

async function openPostbus(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.locator('.mobile-study-picker button').first().click()
    await page.getByRole('option', { name: /PA/ }).click()
  } else {
    await page.getByRole('button', { name: 'PostBus · all Switzerland · 24 hours', exact: true }).click()
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Switzerland by PostBus')
}

test('national PostBus stays lazy, renders the full network and follows the 24-hour clock', async ({ page, isMobile }) => {
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().includes('postbus-national')) requests.push(request.url()) })
  await page.goto('/?perf=1')
  await expect(page.locator('.scene canvas')).toBeVisible()
  expect(requests).toEqual([])
  await openPostbus(page, isMobile)
  await expect(page.locator('.network-card .between')).toContainText('Scheduled PostBus')
  await expect(page.locator('.network-card .between')).toContainText('inferred road paths')
  await expect(page.locator('footer')).toContainText('© OpenStreetMap contributors')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  await expect(page.locator('.metric-grid')).toContainText('24h')
  expect(requests.some(url => url.endsWith('06-09.json'))).toBe(true)
  expect(requests.some(url => url.endsWith('15-18.json'))).toBe(false)
  // Assert playback directly. A fixed 180-frame benchmark can consume the
  // entire CI timeout on software WebGL; use scripts/benchmark-postbus.mjs for
  // renderer-qualified performance measurements outside the functional gate.
  const scrubber = page.locator('.scrubber input')
  const initialTime = Number(await scrubber.inputValue())
  await expect.poll(async () => Number(await scrubber.inputValue())).toBeGreaterThan(initialTime)
  await scrubber.fill('62100')
  await expect(page.locator('.network-card .between')).toContainText('Scheduled PostBus')
  await expect.poll(() => requests.some(url => url.endsWith('15-18.json'))).toBe(true)
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  await scrubber.fill('3600')
  await expect(page.locator('.network-count-row strong').first()).toHaveText('0')
  await expect(page.locator('.network-card .between')).toContainText('Scheduled PostBus')
  await scrubber.fill('27900')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('0')
  const search = page.locator('.train-search input')
  await search.fill('220')
  await expect(page.locator('.route-result .result-route').first()).toContainText(/Bahnhof|Griesalp|Reichenbach/)
  await page.locator('.route-result').first().click()
  await expect(page.locator('.route-card')).toBeVisible()
  expect(errors).toEqual([])
})

test('corrupt movement data enters an error state instead of rendering it', async ({ page, isMobile }) => {
  await page.route('**/postbus-national-day-chunks/06-09.json', route => route.fulfill({ json: { trains: [] } }))
  await page.goto('/')
  await openPostbus(page, isMobile)
  await expect(page.locator('.network-card')).toContainText('PostBus timetable unavailable')
  await expect(page.locator('.network-count-row strong').first()).toHaveText('—')
})

test('missing PostBus data is disclosed without showing rail counts as buses', async ({ page, isMobile }) => {
  await page.route('**/postbus-national-day-manifest.json', route => route.fulfill({ status: 503, body: '' }))
  await page.goto('/')
  await openPostbus(page, isMobile)
  await expect(page.locator('.network-card')).toContainText('PostBus timetable unavailable')
  await expect(page.locator('.network-count-row strong').first()).toHaveText('—')
})
