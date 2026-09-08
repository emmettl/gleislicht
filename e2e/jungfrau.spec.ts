import { expect, test, type Page } from '@playwright/test'
async function openJungfrau(page: Page, mobile: boolean) {
  if (mobile) { await page.locator('.mobile-study-picker .mobile-picker__trigger').click(); await page.getByRole('option', { name: /^JUNG / }).click() }
  else await page.getByRole('button', { name: 'Explore the Jungfrau railways', exact: true }).click()
}
test('Jungfrau loads on entry with both valley branches, cogwheel services and disclosed Eiger Express motion', async ({ page, isMobile }, info) => {
  const requests: string[] = [], errors: string[] = []
  page.on('request', r => { if (r.url().includes('jungfrau-day.json')) requests.push(r.url()) })
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  expect(requests).toHaveLength(0)
  await openJungfrau(page, isMobile)
  await expect(page.locator('h1')).toHaveText('Valleys → Jungfrau')
  const card = page.locator('.network-card'), scrubber = page.locator('.scrubber input')
  await expect(card).toContainText('valley railways, cogwheel trains and Eiger Express')
  await expect(card).toContainText('not tracked cabins')
  await expect(scrubber).toHaveAttribute('max', '86400')
  await page.getByRole('button', { name: /Pause motion/i }).click()
  await scrubber.fill('0')
  await expect(card.locator('.network-count-row strong')).toHaveText('0')
  await scrubber.fill('43200')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: info.outputPath('jungfrau-overview.png') })
  await card.locator('.jungfrau-places summary').click()
  await card.getByRole('button', { name: 'Lauterbrunnen ↗', exact: true }).click()
  await expect(page.locator('.station-card .service')).toHaveText('Lauterbrunnen')
  await expect(scrubber).toHaveValue('43200')
  await page.locator('.train-search input').fill('Eiger Express')
  await page.getByRole('option').filter({ has: page.locator('.result-service b') }).first().click()
  await expect(page.locator('.selected-card')).toContainText('Eiger Express timetable records · not tracked cabins')
  await expect(page.locator('.jungfrau-model')).toBeVisible()
  await page.screenshot({ path: info.outputPath('jungfrau-eiger-express.png') })
  for (const operator of ['Jungfraubahn', 'Wengernalpbahn', 'Berner Oberland-Bahnen']) {
    await page.locator('.train-search input').fill(operator)
    await page.getByRole('option').filter({ has: page.locator('.result-service b') }).first().click()
    await expect(page.locator('.selected-card')).toContainText(operator)
  }
  await openJungfrau(page, isMobile)
  if (isMobile) {
    const tools = page.locator('.mobile-map-tools details'); await tools.locator('summary').click()
    const picker = tools.locator('.mobile-tool-field').first().locator('.mobile-picker'); await picker.locator('.mobile-picker__trigger').click()
    await picker.getByRole('option', { name: 'Cogwheel', exact: true }).click()
    await expect(picker.locator('.mobile-picker__trigger')).toContainText('Cogwheel')
    await tools.locator('summary').click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  } else {
    const filter = page.locator('.service-legend').getByRole('button', { name: 'Cogwheel', exact: true }); await filter.click(); await expect(filter).toHaveAttribute('aria-pressed', 'true')
  }
  await page.getByRole('button', { name: 'Explore studies', exact: true }).click()
  await page.getByRole('button', { name: /Jungfrau · valleys to summit/ }).click()
  await expect(page.locator('h1')).toHaveText('Valleys → Jungfrau')
  expect(requests).toHaveLength(1)
  expect(errors).toEqual([])
})
test('Jungfrau retries a failed request and restores a dated station link', async ({ page }) => {
  let fail = true
  await page.route('**/jungfrau-day.json', route => fail ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue())
  await page.goto('/?study=jungfrau&time=50000&date=2026-09-04&station=Jungfraujoch')
  await expect(page.locator('.network-card')).toContainText('Jungfrau is unavailable')
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.station-card .service')).toHaveText('Jungfraujoch')
  // Pause immediately; the normal map clock is free to advance after loading.
  const pause = page.getByRole('button', { name: /Pause motion/i }); if (await pause.isVisible()) await pause.click()
  expect(Number(await page.locator('.scrubber input').inputValue())).toBeGreaterThanOrEqual(50000)
  await expect(page.locator('h1')).toHaveText('Valleys → Jungfrau')
})
