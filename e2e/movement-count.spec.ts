import { expect, test } from '@playwright/test'

test('active movement count follows station selection and release', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  const pause = page.getByRole('button', { name: /Pause motion/ })
  if (await pause.isVisible()) await pause.click()
  const count = page.locator('.network-count-row > strong').first()
  const readCount = async () => Number((await count.innerText()).replace(/[^0-9]/g, ''))
  const total = await readCount()
  expect(total).toBeGreaterThan(0)
  await page.locator('.train-search input[type=search]').fill('Bern')
  await page.locator('.station-result').first().click()
  await expect.poll(readCount).toBeLessThan(total)
  expect(await readCount()).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Clear search and selection', exact: true }).click()
  await expect.poll(readCount).toBe(total)
})
