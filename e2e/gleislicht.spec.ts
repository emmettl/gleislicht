import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Switzerland in motion',
  )
  await expect(page.locator('.scene canvas')).toBeVisible()
})

test('search selects a station and exposes its serving routes', async ({ page }) => {
  const search = page.locator('.train-search input[type="search"]')
  await search.fill('Bern')
  const result = page.locator('.search-results .station-result').first()
  await expect(result).toContainText('Bern')
  await result.click()

  await expect(page.locator('.station-card')).toContainText('Bern')
  await expect(page.locator('.station-route-strip > span').first()).toBeVisible()
})

test('keyboard search selection remains complete', async ({ page }) => {
  const search = page.locator('.train-search input[type="search"]')
  await search.fill('Basel SBB')
  await search.press('ArrowDown')
  await search.press('Enter')

  await expect(page.locator('.station-card')).toContainText('Basel SBB')
})

test('region selection changes the active study', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'iphone-webkit') {
    const picker = page.locator('.mobile-study-picker')
    await picker.locator('.mobile-picker__trigger').click()
    await picker.getByRole('option').filter({ hasText: 'ZH' }).click()
  } else {
    await page.locator('.network-study-picker button').filter({ hasText: 'ZH' }).click()
  }

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Zürich in motion',
  )
  await expect(page.locator('.network-card')).toContainText('Vehicles in motion')
})

test('the mobile shell keeps header, search and timeline in one viewport', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit')

  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  const selectors = [
    '.masthead h1',
    '.train-search',
    '.network-card',
    '.transport',
  ]
  for (const selector of selectors) {
    const box = await page.locator(selector).boundingBox()
    expect(box, `${selector} should have a layout box`).not.toBeNull()
    if (!box || !viewport) continue
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
  }

  await expect(page.locator('.train-search input[type="search"]')).toHaveCSS(
    'font-size',
    '16px',
  )
})
