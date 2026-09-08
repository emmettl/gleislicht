import { test, expect } from '@playwright/test'

test('Solothurn loads on selection, searches rail and out-of-canton stops, seeks and shares', async ({ page, isMobile }, testInfo) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  expect(requests.some(url => url.includes('/data/solothurn-region'))).toBe(false)
  await page.getByRole('button', { name: 'Explore studies', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Solothurn · canton and connections/ }).click()
  await expect(page.locator('.network-card .between')).toContainText('Full day')
  await expect(page.locator('.scrubber input')).toHaveAttribute('max', '86400')
  if (isMobile) { const title = (await page.locator('.masthead h1').boundingBox())!; const search = (await page.locator('.train-search').boundingBox())!; expect(title.y + title.height).toBeLessThanOrEqual(search.y) }
  await expect(page.getByRole('link', { name: 'Kanton Solothurn · © OpenStreetMap contributors · FOT · Kantone Bern / Basel-Stadt', exact: true }).last()).toHaveAttribute('href', /solothurn-region\/sources.json/)
  const search = page.locator('.train-search input[type=search]')
  expect((await search.boundingBox())!.width).toBeGreaterThan(150)
  await search.fill('IC5')
  await page.locator('.search-results .route-result').first().click()
  await expect(page.locator('.route-card')).toContainText('IC5')
  await search.fill('Biel/Bienne')
  await page.locator('.search-results .station-result').first().click()
  await expect(page.locator('.station-card')).toContainText('Biel/Bienne')
  await page.locator('.scrubber input').fill('62100')
  await expect.poll(() => requests.some(url => url.includes('solothurn-region-day-chunks/16-18'))).toBe(true)
  await page.getByRole('button', { name: 'Share study', exact: true }).click()
  const url = await page.getByRole('textbox', { name: 'Copy this link', exact: true }).inputValue()
  expect(url).toContain('study=solothurn-region'); expect(url).toContain('range=day')
  await page.goto(url)
  await expect(page.locator('.scrubber input')).toHaveAttribute('max', '86400')
  await expect(page.locator('.station-card')).toContainText('Biel/Bienne')
  await expect.poll(async () => Math.abs(Number(await page.locator('.scrubber input').inputValue()) - 62100)).toBeLessThan(500)
  await expect(page.locator('.scene canvas')).toBeVisible()
  // Shared links restore the controls before the lazy scene and camera settle.
  await page.waitForTimeout(1500)
  await page.screenshot({ path: testInfo.outputPath('solothurn-selection.png') })
})

test('Solothurn retries a midnight chunk and includes preceding service-day movements', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-09-07T22:10:00Z'))
  let fail = true
  await page.route('**/solothurn-region-day-chunks/00-02.json', route => fail ? route.fulfill({ status: 503, body: '' }) : route.continue())
  await page.goto('/?study=solothurn-region&time=600')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.network-card .between')).toContainText('Full day')
  await page.getByRole('button', { name: 'Now', exact: true }).click()
  await expect(page.locator('.scrubber input')).toHaveValue('600')
  await expect.poll(async () => Number((await page.locator('.network-count-row > strong').innerText()).replace(/[^0-9]/g, ''))).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath('solothurn-midnight.png') })
})

test('Solothurn recovers a morning snapshot and translates labels without overflow', async ({ page, isMobile }, testInfo) => {
  let fail = true
  await page.route('**/solothurn-region-morning.json', route => fail ? route.fulfill({ status: 503, body: '' }) : route.continue())
  await page.goto('/?study=solothurn-region&range=morning')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.network-card .between')).toContainText('Selected')
  for (const [code, placeholder] of [['FR', /Rechercher/], ['DE', /suchen/], ['IT', /Cerca/]] as const) {
    if (isMobile) {
      await page.locator('.mobile-language-picker .mobile-picker__trigger').click()
      await page.getByRole('option', { name: new RegExp(`^${code} `) }).click()
    } else await page.locator('.language-picker').getByRole('button', { name: code, exact: true }).click()
    await expect(page.locator('.train-search input[type=search]')).toHaveAttribute('placeholder', placeholder)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('solothurn-language.png') })
})
