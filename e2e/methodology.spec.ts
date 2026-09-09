import { expect, test } from '@playwright/test'

test.use({ javaScriptEnabled: false })
test('methodology and provenance are readable without JavaScript', async ({ page }) => {
  await page.goto('/methodology.html')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Data in.')
  await expect(page.getByRole('heading', { name: 'Sources and packaging' })).toBeVisible()
  await expect(page.getByText(/no analytics, advertising, accounts/i)).toBeVisible()
})
