import { expect, test } from '@playwright/test'

test('national road search loads its catalogue on demand before geometry arrives', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  let release!: () => void
  const geometryReady = new Promise<void>(resolve => { release = resolve })
  await page.route('**/swiss-road-topology.json', async route => {
    await geometryReady
    await route.continue()
  })
  try {
    await page.goto('/')
    await expect(page.locator('.scene canvas')).toBeVisible()
    expect(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/switzerland-roads-')))).toBe(false)
    await page.locator('.train-search input[type="search"]').fill('Gotthard')
    await page.locator('.search-results .road-result').first().click()
    await expect(page.locator('.road-corridor-card')).toContainText('A2')
    await expect(page.locator('.road-corridor-card')).toContainText('Gotthard')
    expect(errors).toEqual([])
  } finally {
    release()
  }
})
