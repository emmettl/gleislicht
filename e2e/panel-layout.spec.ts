import { expect, test } from '@playwright/test'

test('compact airport uses measured heading and playback clearances', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await page.getByRole('button', { name: /Pause motion/ }).click()
  await page.locator('.train-search input[type=search]').fill('ZRH')
  await page.getByRole('option').filter({ hasText: 'ZRH' }).first().click()
  const panel = page.locator('.edition-airport-card')
  await expect(panel).toBeVisible()
  for (const [width, height] of (isMobile ? [[390, 664]] : [[1440, 900], [1280, 800], [1024, 600]])) {
    await page.setViewportSize({ width, height })
    let measured: unknown
    await expect.poll(async () => {
      const card = await panel.boundingBox()
      const search = await page.locator('.train-search').boundingBox()
      const playback = await page.locator('.transport').boundingBox()
      measured = { width, card, search, playback }
      return card && search && playback ? { width, card, search, playback, valid: card.y >= search.y + search.height && card.x >= 0 && card.x + card.width <= width && card.height > 40 && card.y + card.height <= playback.y - 10 } : { valid: false }
    }).toMatchObject({ valid: true }).catch(error => { console.log(measured); throw error })
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await expect(panel.locator('.ms-airport-hero__code')).toHaveCSS('font-size', '40px')
    // Refocus after each resize; an already-focused link does not request
    // another browser scroll when the available panel height changes.
    await panel.getByRole('link').last().blur()
    await panel.getByRole('link').last().focus()
    await expect(panel.getByRole('link').last()).toBeInViewport()
    await page.screenshot({ path: `test-results/panel-airport-${width}.png` })
  }
})
