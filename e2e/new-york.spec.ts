import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/new-york.html')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Local')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await expect(page.locator('.ny-status')).toContainText('trains in corridor')
})

test('boots as an independent bounded edition', async ({ page }) => {
  const resources = await page.evaluate(() =>
    (globalThis as unknown as {
      performance: {
        getEntriesByType(type: string): readonly { readonly name: string }[]
      }
    }).performance.getEntriesByType('resource').map((entry) => entry.name),
  )
  expect(resources.some((url) => url.includes('local-express-lexington-morning.json'))).toBe(true)
  expect(resources.some((url) => url.includes('local-express-geography.json'))).toBe(true)
  expect(resources.some((url) => url.includes('local-express-diagram.json'))).toBe(false)
  expect(resources.some((url) => url.includes('local-express-day-manifest.json'))).toBe(false)
  expect(resources.some((url) => url.includes('swiss-rail-morning.json'))).toBe(false)
  expect(resources.some((url) => url.includes('all-change-rail-led'))).toBe(false)
  await expect(page.locator('.ny-transport')).toContainText('07:00')
  await expect(page.locator('.ny-transport')).toContainText('09:00')
})

test('the complete corridor day loads progressively without changing the opening payload', async ({ page }) => {
  const manifestResponse = page.waitForResponse((candidate) =>
    candidate.url().includes('local-express-day-manifest.json'),
  )
  await page.getByRole('button', { name: '24-hour study' }).click()
  expect((await manifestResponse).ok()).toBe(true)
  await expect(page.locator('.new-york-experience')).toHaveAttribute(
    'data-study-window',
    'day',
  )
  await expect(page.locator('.new-york-experience')).toHaveAttribute(
    'data-day-loading',
    'false',
  )
  await expect(page.locator('.ny-transport')).toContainText('00:00')
  await expect(page.locator('.ny-transport')).toContainText('24:00')
  const resources = await page.evaluate(() =>
    (globalThis as unknown as {
      performance: {
        getEntriesByType(type: string): readonly { readonly name: string }[]
      }
    }).performance.getEntriesByType('resource').map((entry) => entry.name),
  )
  const chunks = resources.filter((url) =>
    url.includes('local-express-day-chunks/'),
  )
  expect(chunks.length).toBeGreaterThanOrEqual(1)
  expect(chunks.length).toBeLessThanOrEqual(3)
  expect(resources.some((url) => url.includes('local-express-lexington-day.json'))).toBe(false)
  await page.getByRole('button', { name: '2-hour morning study' }).click()
  await expect(page.locator('.new-york-experience')).toHaveAttribute(
    'data-study-window',
    'morning',
  )
  await expect(page.locator('.ny-transport')).toContainText('07:00')
  await expect(page.locator('.ny-transport')).toContainText('09:00')
})

test('local and express patterns can be isolated', async ({ page }) => {
  const local = page.getByRole('button', { name: /Local 6/ })
  const express = page.getByRole('button', { name: /Express 4/ })
  await local.click()
  await expect(local).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.ny-status')).toContainText('Lexington Avenue Local')
  await express.click()
  await expect(express).toHaveAttribute('aria-pressed', 'true')
  await expect(local).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.ny-status')).toContainText('Lexington Avenue Express')
})

test('the overtake director selects a real scheduled comparison', async ({ page }) => {
  await page.getByRole('button', { name: /Next overtake/ }).click()
  await expect(page.locator('.ny-status')).toContainText(/passes 6 local/)
  await expect(page.locator('.ny-status')).toContainText('scheduled order reversal')
  await expect(page.locator('.new-york-experience')).toHaveAttribute(
    'data-comparison-count',
    '2',
  )
  await expect(page.getByRole('button', { name: 'Resume motion' })).toBeVisible()
})

test('station search supports keyboard selection', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Find a station, pattern or train' })
  await search.fill('86 St')
  await expect(page.getByRole('option', { name: /86 St/ }).first()).toBeVisible()
  await search.press('Enter')
  await expect(page.locator('.ny-status')).toContainText('86 St')
  await expect(search).toHaveValue('86 St')
})

test('diagram loads lazily without losing the clock', async ({ page }) => {
  await page.getByRole('button', { name: 'Pause motion' }).click()
  const clock = page.locator('.ny-transport > div strong')
  const pausedTime = await clock.textContent()
  const response = page.waitForResponse((candidate) =>
    candidate.url().includes('local-express-diagram.json'),
  )
  await page.getByRole('button', { name: 'Diagram' }).click()
  const diagramResponse = await response
  expect(diagramResponse.ok()).toBe(true)
  const diagram = await diagramResponse.json() as {
    metadata: { overridesSource?: string }
    context?: { waterPaths?: readonly unknown[] }
  }
  expect(diagram.metadata.overridesSource).toBe(
    'local-express-diagram-overrides.json',
  )
  expect(diagram.context?.waterPaths).toHaveLength(2)
  await expect(page.locator('.new-york-experience')).toHaveAttribute('data-spatial-layout', 'diagram')
  await expect(clock).toHaveText(pausedTime ?? '')
})

test('reduced motion keeps the alternate map available without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(page.locator('.scene canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Diagram' }).click()
  await expect(page.locator('.new-york-experience')).toHaveAttribute('data-layout-mix', '1.000')
  await expect(page.locator('.new-york-experience')).toHaveAttribute('data-layout-transitioning', 'false')
})

test('iPhone chrome stays inside the viewport and can be reduced', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit', 'iPhone-only layout gate')
  const overflow = await page.evaluate(() => {
    const browser = globalThis as unknown as {
      document: { documentElement: { scrollWidth: number } }
      innerWidth: number
    }
    return browser.document.documentElement.scrollWidth - browser.innerWidth
  })
  expect(overflow).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: 'Enter limited chrome' }).click()
  await expect(page.locator('.new-york-experience')).toHaveAttribute('data-limited-chrome', 'true')
  await expect(page.locator('.ny-masthead')).not.toBeVisible()
  await expect(page.locator('.ny-transport')).toBeVisible()
})
