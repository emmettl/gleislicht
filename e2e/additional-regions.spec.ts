import { test, expect } from '@playwright/test'

const regions = [
  ['luzern-region', 'Luzern', 'Luzern · city, lake and valleys'],
  ['zug-region', 'Zug', 'Zug · lake and regional connections'],
  ['thurgau-region', 'Frauenfeld', 'Thurgau · rail, buses and lake'],
  ['fribourg-region', 'Fribourg', 'Fribourg · city and regional connections'],
] as const

for (const [id, station, name] of regions) {
  test(`${id}: lazy discovery, Sunday, search, chunk seek and restored share`, async ({ page }, testInfo) => {
    const requests: string[] = []
    page.on('request', request => requests.push(request.url()))
    await page.goto('/')
    await expect(page.locator('.scene canvas')).toBeVisible()
    expect(requests.some(url => regions.some(([region]) => url.includes(`/${region}/`)))).toBe(false)
    await page.getByRole('button', { name: 'Explore studies', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(name.replace('·', '·')) }).click()
    await expect(page.locator('.network-card .between')).toContainText('Full day')
    await expect(page.locator('.scrubber input')).toHaveAttribute('max', '86400')
    const picker = page.getByRole('combobox', { name: /Timetable date/ })
    await expect(picker).toHaveValue('2026-09-04')
    expect(requests.some(url => url.includes(`/${id}/`) && url.includes('-morning.json'))).toBe(false)
    await picker.selectOption('2026-09-06')
    await expect(page.locator('.explore-status').filter({ hasText: 'Partial canton coverage' })).toContainText('2026-09-06')
    await page.locator('.train-search input[type=search]').fill(station)
    await page.locator('.search-results .station-result').first().click()
    await expect(page.locator('.station-card')).toContainText(station)
    await page.locator('.scrubber input').fill('62100')
    await expect.poll(() => requests.some(url => url.includes(`/${id}/2026-09-06/study/`) && url.includes('16-18.json'))).toBe(true)
    await page.getByRole('button', { name: 'Share study', exact: true }).click()
    const url = await page.getByRole('textbox', { name: 'Copy this link', exact: true }).inputValue()
    expect(url).toContain(`study=${id}`)
    expect(url).toContain('date=2026-09-06')
    await page.goto(url)
    await expect(picker).toHaveValue('2026-09-06')
    await expect(page.locator('.station-card')).toContainText(station)
    await expect(page.locator(`a[href$="${id}/study-sources.json"]`).first()).toContainText('ODbL')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    if (testInfo.project.name === 'iphone-webkit') {
      const title = await page.locator('.masthead h1').boundingBox()
      const search = await page.locator('.train-search').boundingBox()
      expect(title && search && title.y + title.height <= search.y, 'regional heading clears mobile search').toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath(`${id}-sunday.png`) })
  })
}

test('regional morning retry, unavailable date and switching studies retain the correct feed', async ({ page }) => {
  let fail = true
  await page.route('**/zug-region/2026-09-04/study/zug-region-morning.json', route => fail ? route.fulfill({ status: 503, body: '' }) : route.continue())
  await page.goto('/?study=zug-region&range=morning&date=2026-10-01')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.network-card .between')).toContainText('Selected trains, buses, boats and funicular journeys')
  await expect(page.locator('.explore-status').filter({ hasText: 'The linked date is unavailable' })).toBeVisible()
  await page.getByRole('button', { name: 'Explore studies', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Thurgau · rail, buses and lake/ }).click()
  await expect(page.getByRole('combobox', { name: 'Thurgau Timetable date' })).toHaveValue('2026-09-04')
  await expect(page.locator('.network-card .between')).toContainText('Full day')
  await page.getByRole('button', { name: 'Full day', exact: true }).click()
  await expect(page.locator('.network-card .between')).toContainText('Selected trains, buses and boats')
  await expect(page.getByRole('combobox', { name: 'Thurgau Timetable date' })).toBeVisible()
})
