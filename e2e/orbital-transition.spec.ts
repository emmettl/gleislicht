import { expect, test } from '@playwright/test'

test('orbit transition loads on demand and preserves the paused atlas on return', async ({ page }) => {
  test.setTimeout(180_000)
  const requests: string[] = []
  page.on('request', request => { if (request.url().includes('/OrbitalTransition.tsx')) requests.push(request.url()) })
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await page.getByRole('button', { name: /Pause motion/i }).click()
  await page.locator('.scrubber input').fill('28000')
  expect(requests).toEqual([])
  await page.getByRole('button', { name: 'Explore studies', exact: true }).click()
  await page.locator('.study-orbital-entry').click()
  await expect(page.locator('.atlas-experience')).toHaveClass(/flight-orbital/, { timeout: 60_000 })
  await expect(page.locator('.flight-orbit canvas')).toBeVisible()
  expect(requests).toHaveLength(1)
  await page.locator('.orbital-back').click()
  await expect(page.locator('.atlas-experience')).toHaveClass(/flight-atlas/)
  await expect(page.locator('.scrubber input')).toHaveValue('28000')
  await expect(page.getByRole('button', { name: /Resume motion/i })).toBeVisible()
})

test('a failed transition module leaves the atlas usable', async ({ page }) => {
  await page.route('**/OrbitalTransition.tsx', route => route.abort())
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Explore studies', exact: true }).click()
  await page.locator('.study-orbital-entry').click()
  await expect(page.locator('.flight-error')).toContainText('could not load')
  await expect(page.locator('.atlas-experience')).toHaveClass(/flight-atlas/)
  await expect(page.locator('.scene canvas')).toBeVisible()
  expect(new URL(page.url()).searchParams.has('view')).toBe(false)
})
