import { expect, test } from '@playwright/test'

for (const [recording, time, name, min, max] of [
  ['horgen-2026-09-08', 49020, 'Horgen', 48180, 51660],
] as const) {
  test(`${name} recording link restores paused time and shares a reloadable link`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/?recording=${recording}&date=2026-09-08&time=${time}&latitude=47&longitude=8#private`)
    const card = page.locator('.road-corridor-card')
    const timeline = page.locator('.scrubber input')
    await expect(card.locator('.cantonal-pilot')).toContainText(`${name} ·`)
    await expect(card).toContainText('8 September 2026')
    await expect(timeline).toHaveAttribute('min', String(min))
    await expect(timeline).toHaveAttribute('max', String(max))
    await expect(timeline).toHaveValue(String(time))
    await expect(page.locator('main')).toHaveAttribute('data-sbb-enabled', 'false')
    await expect(page.getByRole('button', { name: /Resume motion/i })).toBeVisible()
    if (name === 'Horgen') {
      await expect(card.getByRole('status')).toContainText('Traffic is hidden')
      await expect(card.locator('.metric-grid strong').nth(1)).toHaveText('—')
    } else await expect(card.locator('.metric-grid strong').nth(1)).toHaveText(/≈[1-9]/)
    await page.getByRole('button', { name: 'Share study', exact: true }).click()
    const url = await page.locator('.explore-link').inputValue()
    expect(new URL(url).searchParams.get('recording')).toBe(recording)
    expect(url).not.toMatch(/latitude|longitude|private|station|train/)
    await page.goto(url)
    await expect(card.locator('.cantonal-pilot')).toContainText(`${name} ·`)
    await expect(timeline).toHaveValue(String(time))
    await expect(page.getByRole('button', { name: /Resume motion/i })).toBeVisible()
    await card.getByRole('button', { name: 'Return to morning roads' }).click()
    await expect(timeline).toHaveAttribute('min', '24300')
    expect(errors).toEqual([])
  })
}

test('missing cantonal geometry explains the fallback and allows retry', async ({ page }) => {
  await page.route('**/zurich-cantonal-road-topology.json', route => route.fulfill({ status: 503, body: '' }))
  await page.goto('/?recording=horgen-2026-09-08&time=49020')
  await expect(page.locator('.explore-status')).toContainText('The morning study is shown')
  await expect(page.locator('main')).toHaveAttribute('data-sbb-enabled', 'true')
  await page.unroute('**/zurich-cantonal-road-topology.json')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.scrubber input')).toHaveValue('49020')
  await expect(page.locator('.cantonal-pilot')).toContainText('Traffic is hidden')
})
