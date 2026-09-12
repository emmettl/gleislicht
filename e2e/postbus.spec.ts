import { expect, test, type Page } from '@playwright/test'

async function openPostbus(page: Page, isMobile: boolean) {
  const control = page.locator(isMobile ? '.mobile-postbus-toggle' : '.postbus-toggle')
  await control.click()
  await expect(control).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.experience')).toHaveAttribute('data-sbb-enabled', 'true')
}

test('national PostBus stays lazy, renders the full network and follows the 24-hour clock', async ({ page, isMobile }) => {
  // CI's software WebGL completes the full scenario in roughly 95 seconds.
  // Keep per-assertion timeouts unchanged while allowing the sequential work.
  test.setTimeout(120_000)
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().includes('postbus-national')) requests.push(request.url()) })
  await page.goto('/?perf=1')
  await expect(page.locator('.scene canvas')).toBeVisible()
  expect(requests).toEqual([])
  await page.goto('/?study=national&range=day&time=27900&perf=1')
  await openPostbus(page, isMobile)
  await page.locator(isMobile ? '.mobile-sbb-toggle' : '.sbb-toggle').click()
  await expect(page.locator('.experience')).toHaveAttribute('data-sbb-enabled', 'false')
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
  await page.getByRole('button', { name: /Resume motion/i }).click()
  const initialTime = Number(await scrubber.inputValue())
  await expect.poll(async () => Number(await scrubber.inputValue())).toBeGreaterThan(initialTime)
  // Stop the clock before deterministic seeks and route selection.
  await page.getByRole('button', { name: /Pause motion/i }).click()
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
  await expect(page.locator('.experience')).toHaveAttribute('data-sbb-enabled', 'false')
  await page.locator(isMobile ? '.mobile-postbus-toggle' : '.postbus-toggle').click()
  await expect(page.locator('.experience')).toHaveAttribute('data-postbus-enabled', 'false')
  await expect(page.locator('.route-card')).toHaveCount(0)
  await page.locator(isMobile ? '.mobile-sbb-toggle' : '.sbb-toggle').click()
  await expect(page.locator('.experience')).toHaveAttribute('data-sbb-enabled', 'true')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('0')
  expect(errors).toEqual([])
})
