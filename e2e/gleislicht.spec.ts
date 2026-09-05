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

test('the operations demo is explicit and returns cleanly to the schedule', async ({
  page,
}) => {
  const operations = page.getByRole('button', {
    name: 'Toggle scheduled and operations view',
  })
  await expect(operations).toHaveText('DEMO')
  await expect(page.locator('.network-card')).toContainText('Operations demo')
  await operations.click()
  await expect(operations).toHaveText('PLAN')
  await expect(page.locator('.network-card')).toContainText('Scheduled rail')
})

test('LUFTRAUM stays lazy and matches the national morning window', async ({
  page,
}, testInfo) => {
  const airRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('swiss-air-morning.json')) {
      airRequests.push(request.url())
    }
  })

  await page.waitForTimeout(150)
  expect(airRequests).toEqual([])

  const toggle = page.locator(
    testInfo.project.name === 'iphone-webkit'
      ? '.mobile-air-toggle'
      : '.network-study-picker .air-toggle',
  )
  await expect(toggle).toBeVisible()
  const response = page.waitForResponse((candidate) =>
    candidate.url().includes('swiss-air-morning.json'),
  )
  await toggle.click()
  await response

  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.network-card .air-count')).toContainText('LUFT')
  await expect(page.locator('.network-card .air-count')).toHaveAttribute(
    'aria-label',
    /Aircraft aloft/,
  )
  await expect(page.locator('.prototype-note')).toContainText(
    'Observed airspace · 06:45–08:45',
  )
  expect(airRequests).toHaveLength(1)

  if (testInfo.project.name === 'iphone-webkit') {
    const viewport = page.viewportSize()
    const toggleBox = await toggle.boundingBox()
    expect(viewport).not.toBeNull()
    expect(toggleBox).not.toBeNull()
    if (viewport && toggleBox) {
      expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(viewport.width + 1)
    }
  }

  const search = page.locator('.train-search input[type="search"]')
  await search.fill('010205')
  const aircraftResult = page.locator('.search-results .air-result').first()
  await expect(aircraftResult).toContainText('MSR783')
  await expect(aircraftResult).toContainText('010205')
  await search.press('Enter')
  await expect(page.locator('.air-card')).toContainText('MSR783')
})

test('LUFT can be isolated like a rail service category', async ({
  page,
}, testInfo) => {
  const toggle = page.locator(
    testInfo.project.name === 'iphone-webkit'
      ? '.mobile-air-toggle'
      : '.network-study-picker .air-toggle',
  )
  await toggle.click()
  await expect(page.locator('.network-card .air-count')).toHaveAttribute(
    'aria-label',
    /Aircraft aloft/,
  )

  if (testInfo.project.name === 'iphone-webkit') {
    const tools = page.locator('.mobile-map-tools details')
    await tools.locator('summary').click()
    const services = tools.locator('.mobile-tool-field').first().locator('.mobile-picker')
    await services.locator('.mobile-picker__trigger').click()
    await services.getByRole('option', { name: 'LUFT' }).click()
    await expect(services.locator('.mobile-picker__trigger')).toContainText('LUFT')
    await services.locator('.mobile-picker__trigger').click()
    await services.getByRole('option', { name: 'IC', exact: true }).click()
    await expect(services.locator('.mobile-picker__trigger')).toContainText('IC')
  } else {
    const legend = page.locator('.service-legend')
    const airCategory = legend.getByRole('button', { name: 'LUFT' })
    const intercity = legend.getByRole('button', { name: 'IC', exact: true })
    await airCategory.click()
    await expect(airCategory).toHaveAttribute('aria-pressed', 'true')
    await expect(legend).toHaveClass(/has-filter/)
    await expect(intercity).toHaveCSS('opacity', '0.14')
    await intercity.click()
    await expect(intercity).toHaveAttribute('aria-pressed', 'true')
    await expect(airCategory).toHaveAttribute('aria-pressed', 'false')
  }
})

test('AUTO stays lazy, discloses reconstruction, and can be isolated', async ({
  page,
}, testInfo) => {
  const roadRequests: string[] = []
  page.on('request', (request) => {
    if (
      request.url().includes('swiss-road-morning.json') ||
      request.url().includes('swiss-road-topology.json')
    ) {
      roadRequests.push(request.url())
    }
  })

  await page.waitForTimeout(150)
  expect(roadRequests).toEqual([])

  const toggle = page.locator(
    testInfo.project.name === 'iphone-webkit'
      ? '.mobile-road-toggle'
      : '.network-study-picker .road-toggle',
  )
  const response = page.waitForResponse((candidate) =>
    candidate.url().includes('swiss-road-morning.json'),
  )
  await toggle.click()
  await response

  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.network-card .road-count')).toContainText('AUTO')
  await expect(page.locator('.network-card .road-count')).toHaveAttribute(
    'aria-label',
    /estimated road vehicles/i,
  )
  await expect(page.locator('.prototype-note')).toContainText(
    'Traffic-flow reconstruction / no vehicle tracking',
  )
  await expect(page.locator('.prototype-note')).toContainText(
    'representative calibration',
  )
  await expect(page.locator('.prototype-note')).toContainText(
    '379/458 federal sites aligned',
  )
  expect(roadRequests).toHaveLength(2)

  if (testInfo.project.name === 'iphone-webkit') {
    const tools = page.locator('.mobile-map-tools details')
    await tools.locator('summary').click()
    const services = tools.locator('.mobile-tool-field').first().locator('.mobile-picker')
    await services.locator('.mobile-picker__trigger').click()
    await services.getByRole('option', { name: 'AUTO' }).click()
    await expect(services.locator('.mobile-picker__trigger')).toContainText('AUTO')
  } else {
    const autoCategory = page.locator('.service-legend').getByRole('button', {
      name: 'AUTO',
    })
    await autoCategory.click()
    await expect(autoCategory).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.service-legend')).toHaveClass(/has-filter/)
  }

  const search = page.locator('.train-search input[type="search"]')
  await search.fill('Gotthard')
  const roadResult = page.locator('.search-results .road-result').first()
  await expect(roadResult).toContainText('A2')
  await roadResult.click()
  await expect(page.locator('.road-corridor-card')).toContainText('A2')
  await expect(page.locator('.road-corridor-card')).toContainText(
    'measurement-ready',
  )
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
  await expect(page.locator('.search-results .station-result').first()).toContainText(
    'Basel SBB',
  )
  await search.press('ArrowDown')
  await search.press('Enter')

  await expect(page.locator('.station-card')).toContainText('Basel SBB')
})

test('typing in search never triggers global keyboard shortcuts', async ({ page }) => {
  const search = page.locator('.train-search input[type="search"]')
  await search.pressSequentially('c p')

  await expect(search).toBeVisible()
  await expect(search).toHaveValue('c p')
  await expect(page.getByRole('button', { name: /Pause motion/i })).toBeVisible()
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
  await expect(page.getByRole('navigation', { name: 'Measured journeys' })).toBeVisible()
  await page.locator('.scrubber input[type="range"]').fill('0.04')
  await expect(page.locator('.journey-card')).toContainText('Zimmerberg Basistunnel')
  await expect(page.locator('footer a[href*="dataset/tunnel"]')).toBeAttached()
})

test('the iPhone journey chrome leaves the landscape dominant', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit')

  const search = page.locator('.train-search input[type="search"]')
  await search.fill('2355')
  await page.locator('.search-results button').filter({ hasText: '2355' }).click()
  await page.getByRole('button', { name: /Descend into real terrain/i }).click()

  const pickerBox = await page.locator('.journey-picker').boundingBox()
  const cardBox = await page.locator('.journey-card').boundingBox()
  const transportBox = await page.locator('.transport').boundingBox()

  expect(pickerBox?.height).toBeLessThanOrEqual(50)
  expect(cardBox?.height).toBeLessThanOrEqual(96)
  expect(transportBox?.height).toBeLessThanOrEqual(96)
  expect(
    cardBox && transportBox
      ? transportBox.y - (cardBox.y + cardBox.height)
      : 0,
  ).toBeGreaterThan(250)
})

test('the city–valley comparison opens the measured Kiental road journey', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'iphone-webkit') {
    const picker = page.locator('.mobile-study-picker')
    await picker.locator('.mobile-picker__trigger').click()
    await picker.getByRole('option').filter({ hasText: '↔' }).click()
  } else {
    await page.getByRole('button', { name: /synchronized city.+valley comparison/i }).click()
  }

  const descent = page.getByRole('button', { name: /Kiental–Griesalp/i })
  await expect(descent).toBeVisible()
  await descent.click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kiental → Griesalp')
  await expect(page.locator('.prototype-note')).toContainText('swissALTI3D')
  await expect(page.locator('footer a[href*="openstreetmap.org/copyright"]')).toBeAttached()
  await expect(
    page.getByRole('button', { name: /220 Kiental → Griesalp/i }),
  ).toHaveAttribute('aria-pressed', 'true')
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

test('24-hour LUFT streams hourly motion and searches the complete day', async ({
  page,
}, testInfo) => {
  const requested: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('swiss-air-')) requested.push(request.url())
  })

  if (testInfo.project.name === 'iphone-webkit') {
    const picker = page.locator('.mobile-study-picker')
    await picker.locator('.mobile-picker__trigger').click()
    await picker.getByRole('option').filter({ hasText: '24H' }).click()
  } else {
    await page.getByRole('button', { name: /24-hour Switzerland study/i }).click()
  }
  const manifestResponse = page.waitForResponse((response) =>
    response.url().includes('swiss-air-day-manifest.json'),
  )
  const currentHourResponse = page.waitForResponse((response) =>
    /swiss-air-day-\d\d\.json$/.test(response.url()),
  )
  await page.locator(
    testInfo.project.name === 'iphone-webkit'
      ? '.mobile-air-toggle'
      : '.network-study-picker .air-toggle',
  ).click()
  await Promise.all([manifestResponse, currentHourResponse])
  await expect(page.locator('.network-card .air-count')).toContainText('LUFT')
  expect(requested.some((url) => url.includes('swiss-air-morning.json'))).toBe(false)

  const search = page.locator('.train-search input[type="search"]')
  await search.fill('ETH501')
  const earlyFlight = page.locator('.search-results .air-result').first()
  await expect(earlyFlight).toContainText('ETH501')
  const earlyHourResponse = page.waitForResponse((response) =>
    response.url().includes('swiss-air-day-00.json'),
  )
  await earlyFlight.click()
  await earlyHourResponse
  await expect(page.locator('.air-card')).toContainText('ETH501')
  await expect.poll(async () => Number(await page.locator('.scrubber input').inputValue())).toBeLessThan(3_600)
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

  expect(cardBox.height).toBeLessThanOrEqual(110)
  expect(cardBox.width).toBeGreaterThan(viewport.width - 30)
  expect(pickerBox.y).toBeGreaterThanOrEqual(cardBox.y - 1)
  expect(pickerBox.y + pickerBox.height).toBeLessThanOrEqual(
    cardBox.y + cardBox.height + 1,
  )
  expect(transportBox.height).toBeLessThanOrEqual(68)
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
