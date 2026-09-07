import { expect, test } from '@playwright/test'

test('edition controls expose desktop help without touch tooltips', async ({ page, isMobile }) => {
  await page.goto('/')
  const control = page.locator('button.air-toggle:visible, button.mobile-air-toggle:visible').first()
  await expect(control).toBeVisible()
  await control.hover()
  if (isMobile) {
    await control.tap()
    await page.waitForTimeout(500)
    await expect(page.getByRole('tooltip')).toHaveCount(0)
  } else {
    await expect(page.getByRole('tooltip')).toHaveText('Show the historical Luftraum study')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await control.focus()
    await expect(page.getByRole('tooltip')).toHaveText('Show the historical Luftraum study')
  }
  await expect(page.locator('button[title]')).toHaveCount(0)
})
