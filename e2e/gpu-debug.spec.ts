import { expect, test } from '@playwright/test'

test('normal edition loads no GPU debug tools', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/')
  await expect(page.locator('canvas').first()).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Edition GPU debugging' })).toHaveCount(0)
  expect(requests.some(url => /debug-runtime|spector|debug-fiber|r3f-perf/.test(url))).toBe(false)
})

test('capture contains actual draw commands and current edition reproduction metadata', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/?debug=capture')
  const panel = page.getByRole('complementary', { name: 'Edition GPU debugging' })
  await expect(panel.getByRole('button', { name: 'Capture WebGL frame', exact: true })).toBeEnabled({ timeout: 45_000 })
  await panel.getByRole('button', { name: 'Capture WebGL frame', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveText(/Captured [1-9]\d* WebGL commands\./, { timeout: 20_000 })
  const result = await panel.getByRole('link', { name: 'Download capture JSON' }).evaluate(async link => (await fetch((link as HTMLAnchorElement).href)).json())
  expect(result.commands.some((command: { name: string }) => command.name.startsWith('draw'))).toBe(true)
  expect(result.motionstudies.edition).toBe('gleislicht')
  expect(result.motionstudies.build).toMatch(/^[a-f0-9]{40}(-dirty)?$/)
  expect(result.motionstudies.dataRelease).toMatch(/^[a-f0-9]{64}$/)
  expect(result.motionstudies.drawingBuffer.width).toBeGreaterThan(0)
  expect(typeof result.motionstudies.playbackTime).toBe('number')
  expect(result.motionstudies.layers).toBeDefined()
  expect(result.motionstudies.camera.position).toHaveLength(3)
  expect(result.motionstudies.camera.projection).toHaveLength(16)
  await panel.getByRole('link', { name: 'Exit debugging (reload)' }).click()
  await expect(page.getByRole('complementary', { name: 'Edition GPU debugging' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Fiber profiler is opt-in and natural rendering is the default', async ({ page }) => {
  await page.goto('/?debug=perf')
  const panel = page.getByRole('complementary', { name: 'Edition GPU debugging' })
  await expect(page.locator('.ms-edition-perf')).toBeVisible({ timeout: 45_000 })
  await expect(panel).toContainText('Natural rendering policy preserved')
  await expect(panel.getByRole('button', { name: 'Capture WebGL frame', exact: true })).toBeHidden()
  await panel.getByRole('link', { name: 'Continuous Fiber profiling (reload)' }).click()
  await expect(panel).toContainText('Continuous profiling requested')
  await expect(page.locator('.ms-edition-perf')).toBeVisible()
})
