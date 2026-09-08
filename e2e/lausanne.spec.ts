import { test, expect } from '@playwright/test'

test('Lausanne loads lazily, supports métro search, day seeking and share reload', async ({ page }, testInfo) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  expect(requests.some(url => url.includes('/data/lausanne-region'))).toBe(false)
  await page.getByRole('button', { name: 'Explore studies', exact: true }).click()
  await page.getByRole('button', { name: /Lausanne · métro and region/ }).click()
  await expect(page.locator('.network-card .between')).toContainText('Full day')
  await expect(page.locator('.scrubber input')).toHaveAttribute('max', '86400')
  await expect(page.getByRole('link', { name: '© OpenStreetMap contributors · ODbL', exact: true })).toHaveAttribute('href', /openstreetmap.org/)
  const search = page.locator('.train-search input[type=search]')
  expect((await search.boundingBox())!.width).toBeGreaterThan(150)
  await search.fill('m2')
  await page.locator('.search-results .route-result').first().click()
  await expect(page.locator('.route-card')).toContainText('m2')
  await search.fill('Lausanne')
  await page.locator('.search-results .station-result').first().click()
  await expect(page.locator('.station-route-strip > span').first()).toBeVisible()
  await expect(page.locator('.station-card')).toContainText('Full-day study')
  await page.locator('.scrubber input').fill('62100')
  await expect.poll(() => requests.some(url => url.includes('lausanne-region-day-chunks/16-18'))).toBe(true)
  await page.getByRole('button', { name: 'Share study', exact: true }).click()
  const url = await page.getByRole('textbox', { name: 'Copy this link', exact: true }).inputValue()
  expect(url).toContain('study=lausanne-region')
  expect(url).toContain('range=day')
  await page.goto(url)
  await expect(page.locator('.scrubber input')).toHaveAttribute('max', '86400')
  await expect.poll(async () => Math.abs(Number(await page.locator('.scrubber input').inputValue()) - 62100)).toBeLessThan(500)
  await expect(page.locator('.scene canvas')).toBeVisible()
  await expect(page.locator('.station-route-strip > span').first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('lausanne.png') })
})

test('Lausanne Now includes the preceding service day after midnight and retries failed chunks', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-07T22:10:00Z'))
  let fail = true
  await page.route('**/lausanne-region-day-chunks/00-02.json', route => fail ? route.fulfill({ status: 503, body: '' }) : route.continue())
  await page.goto('/?study=lausanne-region&time=600')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.network-card .between')).toContainText('Full day')
  await page.getByRole('button', { name: 'Now', exact: true }).click()
  await expect(page.locator('.scrubber input')).toHaveValue('600')
  await expect.poll(async () => Number((await page.locator('.network-count-row > strong').innerText()).replace(/[^0-9]/g, ''))).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: 'Now', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('Lausanne labels switch languages on desktop and phone', async ({ page, isMobile }) => {
  await page.goto('/?study=lausanne-region&range=morning')
  await expect(page.locator('.train-search input[type=search]')).toHaveAttribute('placeholder', /Find m2/)
  for (const [code, placeholder] of [['FR', /Rechercher/], ['DE', /suchen/], ['IT', /Cerca/]] as const) {
    if (isMobile) {
      await page.locator('.mobile-language-picker .mobile-picker__trigger').click()
      await page.getByRole('option', { name: new RegExp(`^${code} `) }).click()
    } else await page.locator('.language-picker').getByRole('button', { name: code, exact: true }).click()
    await expect(page.locator('.train-search input[type=search]')).toHaveAttribute('placeholder', placeholder)
  }
})
