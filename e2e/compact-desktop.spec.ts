import { expect, test } from '@playwright/test'

for (const size of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test(`compact desktop leaves room for the map at ${size.width} × ${size.height}`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop chrome; touch controls have their own layout.')
    await page.setViewportSize(size)
    await page.goto('/?study=fribourg-region&range=day&date=2026-09-06&time=62100')
    await expect(page.getByRole('combobox', { name: /Timetable date/ })).toHaveValue('2026-09-06')
    const trigger = page.locator('.playback-options__trigger')
    await expect(trigger).toBeVisible()
    await expect(page.locator('.speed-picker')).toBeHidden()
    await trigger.focus()
    await page.keyboard.press('Space')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.time-presets')).toBeVisible()
    await page.locator('.speed-picker').getByRole('button', { name: '16×', exact: true }).click()
    await expect(trigger).toContainText('16×')
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await expect(page.locator('.speed-picker')).toBeHidden()

    for (const code of ['EN', 'DE', 'FR', 'IT']) {
      await page.locator('.language-picker').getByRole('button', { name: code, exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('lang', code.toLowerCase())
      await expect.poll(() => page.evaluate(() => {
        const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()
        const search = rect('.train-search'), transport = rect('.transport'), footer = rect('footer')
        return search.bottom < 235 && transport.top - search.bottom > 240
          && transport.bottom + 4 <= footer.top && document.documentElement.scrollWidth <= innerWidth
      })).toBe(true)
    }

    await page.screenshot({ path: `test-results/compact-desktop-${size.width}.png` })
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(trigger).toBeHidden()
    await expect(page.locator('.speed-picker')).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(trigger).toBeHidden()
    await expect(page.locator('.mobile-transport-actions')).toBeVisible()
  })
}


test('time scroller accepts touches near both edges of its larger target', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch interaction is checked in iPhone WebKit.')
  await page.goto('/?study=national&range=day&time=27900')
  const slider = page.locator('.scrubber input')
  await expect(slider).toBeEnabled()
  const bounds = (await slider.boundingBox())!
  expect(bounds.height).toBeGreaterThanOrEqual(48)
  await page.touchscreen.tap(bounds.x + bounds.width * 0.2, bounds.y + 3)
  await expect.poll(async () => Number(await slider.inputValue())).toBeLessThan(25000)
  await page.touchscreen.tap(bounds.x + bounds.width * 0.8, bounds.y + bounds.height - 3)
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(60000)
})
