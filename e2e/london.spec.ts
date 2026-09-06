import { expect, test } from '@playwright/test'

const runningInCi = Boolean(
  (globalThis as { process?: { env?: { CI?: string } } }).process?.env?.CI,
)

test.beforeEach(async ({ page }) => {
  await page.goto('/london.html')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('All Change')
  await expect(page.locator('.scene canvas')).toBeVisible()
})

test('boots as a separate edition without loading Swiss network data', async ({
  page,
}) => {
  const resources = await page.evaluate(() => {
    const browser = globalThis as unknown as {
      performance: {
        getEntriesByType(type: string): readonly { readonly name: string }[]
      }
    }
    return browser.performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
  })
  expect(resources.some((url) => url.includes('all-change-rail-led-morning.json'))).toBe(true)
  expect(resources.some((url) => url.includes('all-change-geography.json'))).toBe(true)
  expect(resources.some((url) => url.includes('all-change-diagram.json'))).toBe(false)
  expect(resources.some((url) => url.includes('all-change-air-'))).toBe(false)
  expect(resources.some((url) => url.includes('all-change-road-'))).toBe(false)
  expect(resources.some((url) => url.includes('all-change-surface-'))).toBe(false)
  expect(resources.some((url) => url.includes('all-change-bus-'))).toBe(false)
  expect(resources.some((url) => url.includes('swiss-rail-morning.json'))).toBe(false)

  await expect(page.locator('.london-status-card')).toContainText('trains in motion')
  await expect(page.locator('.london-transport')).toContainText('06:45')
  await expect(page.locator('.london-transport')).toContainText('08:45')
  await expect(page.getByRole('button', { name: /Diagram/ })).toBeEnabled()
})

test('River Bus and cable car load as a separate 24-hour surface study', async ({
  page,
}) => {
  const surfaceResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-surface-day.json'),
  )
  await page.getByRole('button', { name: 'Show River Bus and cable car' }).click()
  expect((await surfaceResponse).ok()).toBe(true)

  const experience = page.locator('.london-experience')
  await expect(experience).toHaveAttribute('data-study-window', 'day')
  await expect(experience).toHaveAttribute('data-surface-enabled', 'true')
  await expect(page.getByRole('button', { name: 'Diagram layout' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'River', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cable', exact: true })).toBeVisible()
  await expect(page.locator('.london-status-card')).toContainText('vehicles in motion')

  const search = page.getByRole('searchbox', {
    name: 'Find a London station, line, service, airport, flight or motorway',
  })
  await search.fill('RB6')
  await expect(page.getByRole('option', { name: /RB6/ }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Morning study' }).click()
  await expect(experience).toHaveAttribute('data-study-window', 'morning')
  await expect(experience).toHaveAttribute('data-surface-enabled', 'false')
  await expect(page.getByRole('button', { name: 'Diagram layout' })).toBeEnabled()
})

test('route 26 buses load progressively as a separate street study', async ({
  page,
}) => {
  const manifestResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-bus-day-manifest.json'),
  )
  const chunkResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-bus-day-chunks/06-08.json'),
  )
  await page.getByRole('button', { name: 'Show route 26 buses' }).click()
  expect((await manifestResponse).ok()).toBe(true)
  expect((await chunkResponse).ok()).toBe(true)

  const experience = page.locator('.london-experience')
  await expect(experience).toHaveAttribute('data-study-window', 'day')
  await expect(experience).toHaveAttribute('data-bus-enabled', 'true')
  await expect(experience).toHaveAttribute('data-bus-loading', 'false')
  await expect(page.getByRole('button', { name: 'Diagram layout' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Bus 26', exact: true })).toBeVisible()
  await expect(page.locator('.london-status-card')).toContainText('vehicles in motion')
  await expect(page.locator('.london-status-card')).toContainText(
    '11,055 scheduled journeys',
  )
  await page.getByRole('button', { name: 'Pause motion' }).click()
  await page.getByRole('button', { name: 'Bus 26', exact: true }).click()
  await expect(experience).toHaveClass(/has-selection/)

  const search = page.getByRole('searchbox', {
    name: 'Find a London station, line, service, airport, flight or motorway',
  })
  await search.fill('route 26')
  const routeOption = page.getByRole('option', { name: /26/ }).first()
  await expect(routeOption).toBeVisible()
  await routeOption.click()
  await expect(page.locator('.london-status-card')).toContainText('26')
  await expect(page.locator('.london-status-card')).toContainText('30 journeys')

  const eveningChunkResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-bus-day-chunks/18-20.json'),
  )
  await page.locator('.london-transport input[type="range"]').fill('66600')
  expect((await eveningChunkResponse).ok()).toBe(true)
  await expect(page.locator('.london-status-card')).toContainText('36 journeys')

  await page.getByRole('button', { name: 'Morning study' }).click()
  await expect(experience).toHaveAttribute('data-study-window', 'morning')
  await expect(experience).toHaveAttribute('data-bus-enabled', 'false')
  await expect(page.getByRole('button', { name: 'Diagram layout' })).toBeEnabled()
})

test('station search selects and reveals a London interchange', async ({ page }) => {
  const search = page.getByRole('searchbox', {
    name: 'Find a London station, line, service, airport, flight or motorway',
  })
  await search.fill('Whitechapel')
  const result = page.getByRole('option', { name: /Whitechapel/ }).first()
  await expect(result).toBeVisible()
  await search.press('Enter')

  await expect(page.locator('.london-status-card')).toContainText('Whitechapel')
  await expect(search).toHaveValue('Whitechapel')
})

test('the complete Friday loads progressively without changing the opening payload', async ({
  page,
}) => {
  const initialResources = await page.evaluate(() => {
    const browser = globalThis as unknown as {
      performance: {
        getEntriesByType(type: string): readonly { readonly name: string }[]
      }
    }
    return browser.performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
  })
  expect(initialResources.some((url: string) => url.includes('all-change-day-'))).toBe(false)

  const manifestResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-day-manifest.json'),
  )
  const morningChunkResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-day-chunks/06-08.json'),
  )
  await page.getByRole('button', { name: '24-hour study' }).click()
  expect((await manifestResponse).ok()).toBe(true)
  expect((await morningChunkResponse).ok()).toBe(true)

  const experience = page.locator('.london-experience')
  await expect(experience).toHaveAttribute('data-study-window', 'day')
  await expect(experience).toHaveAttribute('data-day-loading', 'false')
  await expect(page.locator('.london-transport')).toContainText('00:00')
  await expect(page.locator('.london-transport')).toContainText('24:00')
  await expect(page.locator('.london-status-card')).toContainText('10,825 scheduled journeys')

  await page.getByRole('button', { name: 'Pause motion' }).click()
  await expect(page.getByRole('button', { name: 'Resume motion' })).toBeVisible()
  const eveningChunkResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-day-chunks/18-20.json'),
  )
  await page.locator('.london-transport input[type="range"]').fill('66600')
  expect((await eveningChunkResponse).ok()).toBe(true)
  await expect(page.locator('.london-time-copy')).toContainText('18:30')

  const diagramResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-diagram.json'),
  )
  await page
    .getByRole('button', { name: 'Diagram layout' })
    .evaluate((button) => (button as { click(): void }).click())
  expect((await diagramResponse).ok()).toBe(true)
  await expect(experience).toHaveAttribute('data-layout-mix', '1.000', {
    timeout: 5_000,
  })
})

test('diagram geometry loads lazily and preserves the current station', async ({
  page,
}) => {
  const search = page.getByRole('searchbox', {
    name: 'Find a London station, line, service, airport, flight or motorway',
  })
  await search.fill('Whitechapel')
  await expect(page.getByRole('option', { name: /Whitechapel/ }).first()).toBeVisible()
  await search.press('Enter')

  const diagramResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-diagram.json'),
  )
  await page.getByRole('button', { name: /Diagram/ }).click()
  expect((await diagramResponse).ok()).toBe(true)

  const experience = page.locator('.london-experience')
  await expect(experience).toHaveAttribute('data-spatial-layout', 'diagram')
  await expect(experience).toHaveAttribute('data-layout-mix', '1.000', {
    timeout: 5_000,
  })
  await expect(page.locator('.london-status-card')).toContainText('Whitechapel')

  await page.getByRole('button', { name: /Geography/ }).click()
  await expect(experience).toHaveAttribute('data-layout-mix', '0.000', {
    timeout: 5_000,
  })
  await expect(page.locator('.london-status-card')).toContainText('Whitechapel')

  await page.keyboard.press('d')
  await expect(experience).toHaveAttribute('data-layout-mix', '1.000', {
    timeout: 5_000,
  })
  await page.keyboard.press('g')
  await expect(experience).toHaveAttribute('data-layout-mix', '0.000', {
    timeout: 5_000,
  })
})

test('reduced motion changes spatial layout without a sweep', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const diagramResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-diagram.json'),
  )
  await page.getByRole('button', { name: /Diagram/ }).click()
  expect((await diagramResponse).ok()).toBe(true)
  await expect(page.locator('.london-experience')).toHaveAttribute(
    'data-layout-mix',
    '1.000',
    { timeout: 1_000 },
  )
})

test('limited chrome leaves the visualization and timeline in control', async ({
  page,
}) => {
  const experience = page.locator('.london-experience')
  const timeline = page.locator('.london-transport')
  const enter = page.getByRole('button', { name: 'Enter limited chrome' })

  await enter.click()
  await expect(experience).toHaveAttribute('data-limited-chrome', 'true')
  await expect(timeline).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exit limited chrome' })).toBeVisible()
  await expect(page.locator('.london-masthead')).not.toBeVisible()
  await expect(page.locator('.london-search')).not.toBeVisible()
  await expect(page.locator('.london-status-card')).not.toBeVisible()
  await expect(page.locator('.london-service-legend')).not.toBeVisible()
  await expect(page.locator('.london-map-tools')).not.toBeVisible()
  await expect(page.locator('.london-layout-switch')).not.toBeVisible()

  await page.keyboard.press('Escape')
  await expect(experience).toHaveAttribute('data-limited-chrome', 'false')
  await expect(page.locator('.london-masthead')).toBeVisible()

  await page.keyboard.press('f')
  await expect(experience).toHaveAttribute('data-limited-chrome', 'true')
})

test('interchange pulse preserves the shared clock and switches character', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Interchange pulse' }).click()
  const experience = page.locator('.london-experience')
  await expect(experience).toHaveClass(/is-pulse-study/)
  await expect(page.locator('.london-status-card')).toContainText("King's Cross")
  await expect(page.locator('.london-status-card')).toContainText(
    'movements in orbit',
  )
  await page.getByRole('button', { name: 'radial movements' }).click()
  await expect(experience).toHaveAttribute('data-pulse-lens', 'radial')
  await expect(page.locator('.london-status-card')).toContainText(
    'radial movements',
  )
  await expect(page.getByRole('button', { name: 'Exit interchange pulse' })).toBeVisible()
  await expect(page.locator('.london-map-tools')).not.toBeVisible()

  await page.getByRole('combobox', { name: 'Pulse interchange' }).selectOption(
    'stratford',
  )
  await expect(page.locator('.london-status-card')).toContainText('Stratford')
  await expect(experience).toHaveAttribute('data-pulse-lens', 'all')
  await page.locator('.london-transport input[type="range"]').fill('28800')
  await expect(page.locator('.london-time-copy')).toContainText('08:00')

  expect(
    await page.evaluate(() => {
      const browser = globalThis as unknown as {
        readonly document: {
          readonly documentElement: { readonly scrollWidth: number }
        }
        readonly innerWidth: number
      }
      return browser.document.documentElement.scrollWidth - browser.innerWidth
    }),
  ).toBeLessThanOrEqual(1)

  await page.getByRole('button', { name: 'Exit interchange pulse' }).click()
  await expect(experience).not.toHaveClass(/is-pulse-study/)
})

test('observed aircraft load lazily, join category emphasis and are searchable by code', async ({
  page,
}) => {
  const airResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-air-morning.json'),
  )
  await page.getByRole('button', { name: 'Show observed aircraft' }).click()
  expect((await airResponse).ok()).toBe(true)

  const experience = page.locator('.london-experience')
  await expect(experience).toHaveClass(/has-air-layer/)
  const category = page.getByRole('button', { name: 'AIR', exact: true })
  await expect(category).toBeVisible()
  await category.click()
  await expect(experience).toHaveClass(/has-air-category/)
  await expect(page.locator('.london-status-card')).toContainText('aircraft observed')
  await page.getByRole('button', { name: 'Pause motion' }).click()
  await expect(page.getByRole('button', { name: 'Resume motion' })).toBeVisible()

  const search = page.getByRole('searchbox', {
    name: 'Find a London station, line, service, airport, flight or motorway',
  })
  await search.fill('BAW925')
  await expect(page.getByRole('option', { name: /BAW925/ })).toBeVisible()
  await search.press('Enter')
  await expect(search).toHaveValue('BAW925 · 405A49')
  await expect(page.locator('.london-status-card')).toContainText('BAW925')
  await expect(page.locator('.london-status-card')).toContainText(/ft · \d+ kt/)
})

test('airport search enters air-only mode and isolates its observed flights', async ({
  page,
}) => {
  const search = page.getByRole('searchbox', {
    name: 'Find a London station, line, service, airport, flight or motorway',
  })
  await search.fill('LHR')
  const airport = page.getByRole('option', {
    name: /Heathrow Airport/,
  })
  await expect(airport).toBeVisible()

  const airResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-air-morning.json'),
  )
  await search.press('Enter')
  expect((await airResponse).ok()).toBe(true)

  const experience = page.locator('.london-experience')
  await expect(experience).toHaveClass(/has-air-layer/)
  await expect(experience).toHaveClass(/has-air-category/)
  await expect(experience).toHaveClass(/has-airport-selection/)
  await expect(experience).toHaveAttribute('data-selected-airport', 'heathrow')
  await expect(search).toHaveValue('Heathrow Airport · LHR')
  await expect(page.locator('.london-status-card')).toContainText('LHR')
  await expect(page.locator('.london-status-card')).toContainText(
    'airport movements',
  )
  await expect(page.getByRole('button', { name: 'Hide observed aircraft' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('motorway search loads observed flow lazily and enters ROAD isolation', async ({
  page,
}) => {
  const search = page.getByRole('searchbox', {
    name: 'Find a London station, line, service, airport, flight or motorway',
  })
  await search.fill('M25')
  await expect(page.getByRole('option', { name: /M25.*London Orbital/ })).toBeVisible()

  const topologyResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-road-topology.json'),
  )
  const manifestResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-road-day-manifest.json'),
  )
  const morningResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-road-day/06-12.json'),
  )
  await search.press('Enter')
  expect((await topologyResponse).ok()).toBe(true)
  expect((await manifestResponse).ok()).toBe(true)
  expect((await morningResponse).ok()).toBe(true)

  const experience = page.locator('.london-experience')
  await expect(experience).toHaveClass(/has-road-layer/)
  await expect(experience).toHaveClass(/has-road-category/)
  await expect(experience).toHaveAttribute('data-selected-road', 'M25')
  await expect(search).toHaveValue('M25 · London Orbital')
  await expect(page.locator('.london-status-card')).toContainText('M25')
  await expect(page.locator('.london-status-card')).toContainText(
    'vehicles reconstructed',
  )
  await expect(page.locator('.london-status-card')).toContainText(
    /observed 05 Sep(?:t)? 2025/,
  )
  await expect(
    page.getByRole('button', { name: 'Hide reconstructed motorway traffic' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(
    await page.evaluate(() => {
      const browser = globalThis as unknown as {
        readonly document: {
          readonly documentElement: { readonly scrollWidth: number }
        }
        readonly innerWidth: number
      }
      return browser.document.documentElement.scrollWidth - browser.innerWidth
    }),
  ).toBeLessThanOrEqual(1)
})

test('the London air day follows the 24-hour clock in progressive hourly chunks', async ({
  page,
}) => {
  await page.getByRole('button', { name: '24-hour study' }).click()
  const manifestResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-air-day-manifest.json'),
  )
  const hourResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-air-day-07.json'),
  )
  await page.getByRole('button', { name: 'Show observed aircraft' }).click()
  expect((await manifestResponse).ok()).toBe(true)
  expect((await hourResponse).ok()).toBe(true)
  await expect(page.locator('.london-experience')).toHaveClass(/has-air-layer/)
})

test(
  'the iPhone diagram maintains an interactive frame cadence',
  { tag: '@frame-cadence' },
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-webkit')
    await page.getByRole('button', { name: /Diagram/ }).click()
    await expect(page.locator('.london-experience')).toHaveAttribute(
      'data-layout-mix',
      '1.000',
      { timeout: 5_000 },
    )
    await page.keyboard.press('f')

    const intervals = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const browser = globalThis as unknown as {
            readonly performance: { now(): number }
            requestAnimationFrame(callback: (time: number) => void): number
          }
          const samples: number[] = []
          let previous = browser.performance.now()
          const started = previous
          const sample = (now: number) => {
            samples.push(now - previous)
            previous = now
            if (now - started >= 1_800) resolve(samples.slice(2))
            else browser.requestAnimationFrame(sample)
          }
          browser.requestAnimationFrame(sample)
        }),
    )
    const sorted = [...intervals].sort((first, second) => first - second)
    const p95 =
      sorted[Math.floor(sorted.length * 0.95)] ?? Number.POSITIVE_INFINITY

    // Headless WebKit on GitHub's software renderer is not a physical iPhone
    // benchmark. Keep the local interaction budget strict, while CI verifies
    // that the scene continues to render without freezing or long stalls.
    const minimumSamples = runningInCi ? 12 : 18
    const maximumP95 = runningInCi ? 175 : 125
    expect(
      intervals.length,
      `sampled ${intervals.length} frames with ${p95.toFixed(1)} ms p95`,
    ).toBeGreaterThanOrEqual(minimumSamples)
    expect(
      p95,
      `sampled ${intervals.length} frames with ${p95.toFixed(1)} ms p95`,
    ).toBeLessThan(maximumP95)
  },
)
