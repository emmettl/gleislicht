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
  await expect(monitor).toContainText(/measuring|FPS/)
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

test('a Zürich–Chur train descends into measured terrain', async ({ page }) => {
  const search = page.locator('.train-search input[type="search"]')
  await search.fill('2355')
  await page.locator('.search-results button').filter({ hasText: '2355' }).click()

  const descent = page.getByRole('button', { name: /Descend into real terrain/i })
  await expect(descent).toBeVisible()
  await descent.click()

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Zürich → Chur')
  await expect(page.locator('.prototype-note')).toContainText('swissALTIRegio')
  await expect(page.locator('footer a[href*="swissaltiregio"]')).toBeAttached()
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

test('a Zürich tram line remains selectable at every layout', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'iphone-webkit') {
    const picker = page.locator('.mobile-study-picker')
    await picker.locator('.mobile-picker__trigger').click()
    await picker.getByRole('option').filter({ hasText: 'ZH' }).click()
  } else {
    await page.locator('.network-study-picker button').filter({ hasText: 'ZH' }).click()
  }

  const search = page.locator('.train-search input[type="search"]')
  await search.fill('Tram 10')
  await page.locator('.search-results .route-result').first().click()

  await expect(page.locator('.route-card')).toContainText('Tram 10')
  await expect(search).toHaveValue('Tram 10')
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

test('the mobile Takt chrome leaves the clock visible and usable', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit')

  const moreControls = page.locator('.mobile-more-controls')
  await moreControls.locator('summary').click()
  await moreControls.getByRole('button', { name: 'Takt hubs' }).click()
  await moreControls.locator('summary').click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Takt hubs')
  await expect(page.locator('.hub-picker-tabs')).toBeHidden()
  const hubPicker = page.locator('.mobile-hub-picker')
  await expect(hubPicker).toBeVisible()
  await hubPicker.locator('.mobile-picker__trigger').click()
  await hubPicker.getByRole('option', { name: 'Bern' }).click()
  await expect(hubPicker.locator('.mobile-picker__trigger')).toContainText('Bern')

  const viewport = page.viewportSize()
  const pickerBox = await page.locator('.hub-picker').boundingBox()
  const cardBox = await page.locator('.hub-card').boundingBox()
  const transportBox = await page.locator('.transport').boundingBox()
  expect(viewport).not.toBeNull()
  expect(pickerBox).not.toBeNull()
  expect(cardBox).not.toBeNull()
  expect(transportBox).not.toBeNull()
  if (!viewport || !pickerBox || !cardBox || !transportBox) return

  expect(cardBox.height).toBeLessThan(175)
  expect(cardBox.width).toBeGreaterThan(viewport.width - 30)
  expect(pickerBox.y + pickerBox.height).toBeLessThanOrEqual(cardBox.y + 1)
  expect(cardBox.y + cardBox.height).toBeLessThan(transportBox.y)
  expect(transportBox.y + transportBox.height).toBeLessThanOrEqual(
    viewport.height + 1,
  )
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
  const title = page.locator('.masthead h1')
  await expect(title).toHaveCSS('white-space', 'nowrap')
  const titleBox = await title.boundingBox()
  expect(titleBox, 'the national title should have a layout box').not.toBeNull()
  expect(titleBox?.height).toBeLessThan(28)
  const mastheadControlsBox = await page.locator('.masthead-meta').boundingBox()
  expect(
    titleBox && mastheadControlsBox
      ? titleBox.x + titleBox.width <= mastheadControlsBox.x
      : false,
    'the national title should clear the header controls',
  ).toBe(true)

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
