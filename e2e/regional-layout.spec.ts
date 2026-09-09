import { expect, test } from '@playwright/test'

test('regional date picker and translated long headings fit the viewport', async ({ page, isMobile }) => {
  await page.goto('/?study=fribourg-region&range=day&date=2026-09-06&time=62100')
  await expect(page.getByRole('combobox', { name: /Timetable date/ })).toHaveValue('2026-09-06')
  for (const code of ['EN', 'DE', 'FR', 'IT']) {
    if (code !== 'EN') {
      if (isMobile) {
        await page.locator('.mobile-language-picker .mobile-picker__trigger').click()
        await page.getByRole('option', { name: new RegExp(`^${code} `) }).click()
      } else await page.locator('.language-picker').getByRole('button', { name: code, exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('lang', code.toLowerCase())
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect((await page.locator('.train-search').boundingBox())!.width).toBeGreaterThan(150)
    if (isMobile) {
      const title = (await page.locator('.masthead h1').boundingBox())!, search = (await page.locator('.train-search').boundingBox())!
      expect(title.y + title.height).toBeLessThanOrEqual(search.y)
    }
  }
})
