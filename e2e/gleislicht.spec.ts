import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Switzerland in motion',
  )
  await expect(page.locator('.scene canvas')).toBeVisible()
})

test('methodology and provenance remain available without the visual client', async ({
  page,
}) => {
  await page.goto('/methodology.html')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Data in.')
  await expect(page.getByRole('heading', { name: 'Sources and packaging' })).toBeVisible()
  await expect(page.getByText(/no analytics, advertising, accounts/i)).toBeVisible()
})

test('local performance telemetry is opt-in and remains on-device', async ({ page }) => {
  await page.goto('/?perf=1')
  const monitor = page.getByLabel('Local performance monitor')
  await expect(monitor).toContainText('Local only · no analytics')
  await expect(monitor).toContainText(/FPS/, { timeout: 5_000 })
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

test('the 24-hour study exposes authored day moments and a director loop', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'iphone-webkit',
    'Desktop controls are covered directly; mobile uses the same actions',
  )
  await page.getByRole('button', { name: /24-hour Switzerland study/i }).click()
  const evening = page.getByRole('button', { name: /Evening rush · 17:15/i })
  await expect(evening).toBeVisible()
  await evening.click()
  const scrubber = page.locator('.scrubber input[type="range"]')
  await expect.poll(async () => Number(await scrubber.inputValue())).toBeGreaterThanOrEqual(17 * 3600 + 15 * 60)
  await expect.poll(async () => Number(await scrubber.inputValue())).toBeLessThan(17 * 3600 + 30 * 60)
  const director = page.locator('.director-toggle')
  await expect(director).toHaveAccessibleName('Director loop')
  await director.click()
  await expect(director).toHaveAttribute('aria-pressed', 'true')
  await expect(director).toHaveAccessibleName('Stop director')
})

test('the hub clock exposes its quarter-hour structure', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'iphone-webkit')
  await page.getByRole('button', { name: 'Takt hubs' }).click()
  const quarterGrid = page.getByRole('button', { name: '¼ grid' })
  await expect(quarterGrid).toHaveAttribute('aria-pressed', 'true')
  await quarterGrid.click()
  await expect(quarterGrid).toHaveAttribute('aria-pressed', 'false')
})

test('wide and compact desktop layouts keep primary overlays separated', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'iphone-webkit')
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 640 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport)
    await page.reload()
    const title = await page.locator('.masthead h1').boundingBox()
    const card = await page.locator('.network-card').boundingBox()
    const search = await page.locator('.train-search').boundingBox()
    const transport = await page.locator('.transport').boundingBox()
    for (const box of [title, card, search, transport]) {
      expect(box).not.toBeNull()
      if (!box) continue
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
    }
    if (title && card) {
      const separated =
        title.x + title.width <= card.x ||
        card.x + card.width <= title.x ||
        title.y + title.height <= card.y ||
        card.y + card.height <= title.y
      expect(separated, `${viewport.width}×${viewport.height} title/card collision`).toBe(true)
    }
  }
  await expect(page.getByRole('button', { name: 'Record 12s' })).toBeVisible()
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
