import { test, expect } from '@playwright/test'

test('Basel loads on selection, searches rail and foreign stops, seeks and shares', async ({ page }, testInfo) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  expect(requests.some(url => url.includes('/data/basel-core'))).toBe(false)
  await page.getByRole('button', { name: 'Explore studies', exact: true }).click()
  await page.getByRole('button', { name: /Basel · BVB\/BLT and regional rail/ }).click()
  await expect(page.locator('.network-card .between')).toContainText('Full day')
  await expect(page.locator('.scrubber input')).toHaveAttribute('max', '86400')
  await expect(page.getByRole('link', { name: '© OpenStreetMap contributors · ODbL', exact: true })).toHaveAttribute('href', /openstreetmap.org/)
  const search = page.locator('.train-search input[type=search]')
  expect((await search.boundingBox())!.width).toBeGreaterThan(150)
  await search.fill('S3')
  await page.locator('.search-results .route-result').first().click()
  await expect(page.locator('.route-card')).toContainText('S3')
  await search.fill('Weil am Rhein')
  await page.locator('.search-results .station-result').first().click()
  await expect(page.locator('.station-card')).toContainText('Weil am Rhein')
  await page.locator('.scrubber input').fill('62100')
  await expect.poll(() => requests.some(url => url.includes('basel-core-day-chunks/16-18'))).toBe(true)
  await page.getByRole('button', { name: 'Share study', exact: true }).click()
  const url = await page.getByRole('textbox', { name: 'Copy this link', exact: true }).inputValue()
  expect(url).toContain('study=basel-core'); expect(url).toContain('range=day')
  await page.goto(url)
  await expect(page.locator('.scrubber input')).toHaveAttribute('max', '86400')
  await expect(page.locator('.station-card')).toContainText('Weil am Rhein')
  await expect.poll(async () => Math.abs(Number(await page.locator('.scrubber input').inputValue()) - 62100)).toBeLessThan(500)
  await page.screenshot({ path: testInfo.outputPath('basel-selection.png') })
})

test('Basel retries a midnight chunk and includes preceding service-day movements', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-09-07T22:10:00Z'))
  let fail = true
  await page.route('**/basel-core-day-chunks/00-02.json', route => fail ? route.fulfill({ status: 503, body: '' }) : route.continue())
  await page.goto('/?study=basel-core&time=600')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.network-card .between')).toContainText('Full day')
  await page.getByRole('button', { name: 'Now', exact: true }).click()
  await expect(page.locator('.scrubber input')).toHaveValue('600')
  await expect.poll(async () => Number((await page.locator('.network-count-row > strong').innerText()).replace(/[^0-9]/g, ''))).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath('basel-midnight.png') })
})

test('Basel recovers a morning snapshot and translates labels without overflow', async ({ page, isMobile }, testInfo) => {
  let fail = true
  await page.route('**/basel-core-morning.json', route => fail ? route.fulfill({ status: 503, body: '' }) : route.continue())
  await page.goto('/?study=basel-core&range=morning')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.network-card .between')).toContainText('Swiss-side regional rail')
  for (const [code, placeholder] of [['FR', /Rechercher/], ['DE', /suchen/], ['IT', /Cerca/]] as const) {
    if (isMobile) {
      await page.locator('.mobile-language-picker .mobile-picker__trigger').click()
      await page.getByRole('option', { name: new RegExp(`^${code} `) }).click()
    } else await page.locator('.language-picker').getByRole('button', { name: code, exact: true }).click()
    await expect(page.locator('.train-search input[type=search]')).toHaveAttribute('placeholder', placeholder)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('basel-language.png') })
})
