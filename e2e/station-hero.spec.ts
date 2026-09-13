/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

test('SBB station card fits its container and selects a scheduled train', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?time=27900')
  await expect(page.locator('.scene canvas')).toBeVisible()
  const search = page.locator('.train-search input[type="search"]')
  await search.fill('Basel SBB')
  await page.locator('.search-results .station-result').first().click()
  const card = page.locator('.station-hero-card')
  await expect(card.locator('.ms-sbb-board')).toBeVisible()
  await expect(card.locator('.ms-sbb-board__row button').first()).toBeVisible()
  for (const width of [280, 360, 520]) {
    await card.evaluate((element, width) => { (element as HTMLElement).style.width = `${Math.min(width, innerWidth - 72)}px` }, width)
    await expect.poll(() => card.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: 'test-results/station-hero.png' })
  await card.locator('.ms-sbb-board__row button').first().click()
  await expect(card).toHaveCount(0)
  await expect(page.locator('.journey-card')).toBeVisible()
})
