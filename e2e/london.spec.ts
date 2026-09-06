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
  expect(resources.some((url) => url.includes('swiss-rail-morning.json'))).toBe(false)

  await expect(page.locator('.london-status-card')).toContainText('trains in motion')
  await expect(page.locator('.london-transport')).toContainText('06:45')
  await expect(page.locator('.london-transport')).toContainText('08:45')
  await expect(page.getByRole('button', { name: /Diagram/ })).toBeDisabled()
})

test('station search selects and reveals a London interchange', async ({ page }) => {
  const search = page.getByRole('searchbox', {
    name: 'Find a London station, line or service',
  })
  await search.fill('Whitechapel')
  const result = page.getByRole('option', { name: /Whitechapel/ }).first()
  await expect(result).toBeVisible()
  await search.press('Enter')

  await expect(page.locator('.london-status-card')).toContainText('Whitechapel')
  await expect(search).toHaveValue('Whitechapel')
})
