import { expect, test } from '@playwright/test'

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
  expect(resources.some((url) => url.includes('swiss-rail-morning.json'))).toBe(false)

  await expect(page.locator('.london-status-card')).toContainText('trains in motion')
  await expect(page.locator('.london-transport')).toContainText('06:45')
  await expect(page.locator('.london-transport')).toContainText('08:45')
  await expect(page.getByRole('button', { name: /Diagram/ })).toBeEnabled()
})

test('station search selects and reveals a London interchange', async ({ page }) => {
  const search = page.getByRole('searchbox', {
    name: 'Find a London station, line, service or flight',
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
  await expect(page.locator('.london-status-card')).toContainText('10,455 scheduled journeys')

  const eveningChunkResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-day-chunks/18-20.json'),
  )
  await page.locator('.london-transport input[type="range"]').fill('66600')
  expect((await eveningChunkResponse).ok()).toBe(true)
  await expect(page.locator('.london-time-copy')).toContainText('18:30')

  const diagramResponse = page.waitForResponse((response) =>
    response.url().includes('all-change-diagram.json'),
  )
  await page.getByRole('button', { name: 'Diagram layout' }).click()
  expect((await diagramResponse).ok()).toBe(true)
  await expect(experience).toHaveAttribute('data-layout-mix', '1.000', {
    timeout: 5_000,
  })
})

test('diagram geometry loads lazily and preserves the current station', async ({
  page,
}) => {
  const search = page.getByRole('searchbox', {
    name: 'Find a London station, line, service or flight',
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

  const search = page.getByRole('searchbox', {
    name: 'Find a London station, line, service or flight',
  })
  await search.fill('BAW925')
  await expect(page.getByRole('option', { name: /BAW925/ })).toBeVisible()
  await search.press('Enter')
  await expect(search).toHaveValue('BAW925 · 405A49')
  await expect(page.locator('.london-status-card')).toContainText('BAW925')
  await expect(page.locator('.london-status-card')).toContainText(/ft · \d+ kt/)
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
