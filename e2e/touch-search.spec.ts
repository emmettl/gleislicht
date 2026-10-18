import { expect, test } from '@playwright/test'

test.use({ hasTouch: true })
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?time=27900')
  await expect(page.locator('.scene canvas')).toBeVisible()
})

test('touch selects a station even when no compatibility click arrives', async ({ page }) => {
  await page.evaluate(() => document.addEventListener('click', event => {
    if ((event.target as Element).closest('.search-results [role="option"]')) {
      event.preventDefault(); event.stopImmediatePropagation()
    }
  }, true))
  const search = page.getByRole('combobox')
  await search.tap(); await search.fill('Basel SBB')
  await page.locator('.search-results .station-result').first().tap()
  await expect(page.locator('.station-card')).toContainText('Basel SBB')
  await expect(page.locator('.search-results')).toHaveCount(0)
  await expect(search).not.toBeFocused()
})

test('keyboard dismissal does not remove results before a delayed tap', async ({ page }) => {
  const search = page.getByRole('combobox')
  await search.tap(); await search.fill('Basel SBB')
  const option = page.locator('.search-results .station-result').first()
  await expect(option).toBeVisible()
  await search.evaluate(input => input.blur())
  await expect(option).toBeVisible()
  await option.tap()
  await expect(page.locator('.station-card')).toContainText('Basel SBB')
})

test('dragging, scrolling and cancelled gestures do not select results', async ({ page }) => {
  const search = page.getByRole('combobox')
  await search.tap(); await search.fill('Basel')
  const option = page.locator('.search-results .station-result').first()
  await expect(option).toBeVisible()
  for (const gesture of ['drag', 'scroll', 'multitouch', 'cancel', 'pointercancel', 'release-outside']) {
    await option.evaluate((button, gesture) => {
      const panel = button.closest('.search-results') as HTMLElement
      panel.style.maxHeight = '80px'
      const bounds = button.getBoundingClientRect()
      const point = { identifier: 1, clientX: bounds.left + 20, clientY: bounds.top + 20, target: button }
      const send = (type: string, touches: typeof point[], changedTouches = touches) => button.dispatchEvent(Object.assign(new Event(type, { bubbles: true, cancelable: true }), { touches, changedTouches }))
      send('touchstart', [point])
      if (gesture === 'drag') {
        send('touchmove', [{ ...point, clientY: point.clientY + 30 }])
        send('touchmove', [point])
      }
      if (gesture === 'scroll') {
        panel.scrollTop += 20
        if (!panel.scrollTop) throw new Error('The result list must scroll for this regression')
      }
      if (gesture === 'multitouch') {
        send('touchstart', [point, { ...point, identifier: 2 }])
        send('touchend', [point], [{ ...point, identifier: 2 }])
      }
      if (gesture === 'cancel') send('touchcancel', [], [point])
      if (gesture === 'pointercancel') button.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerType: 'touch' }))
      send('touchend', [], [gesture === 'release-outside' ? { ...point, clientX: bounds.right + 20 } : point])
      panel.scrollTop = 0
      panel.style.maxHeight = ''
    }, gesture)
    await expect(page.locator('.station-card')).toHaveCount(0)
    await expect(option).toBeVisible()
  }
  await option.tap()
  await expect(page.locator('.station-card')).toContainText('Basel')
})

test('outside interaction and Escape dismiss results; keyboard and mouse still select', async ({ page }) => {
  const search = page.getByRole('combobox')
  await search.fill('Basel SBB')
  await expect(page.locator('.search-results')).toBeVisible()
  // Focus leaving the widget dismisses, but an input blur with no new target does not.
  const outside = page.locator('.language-picker button:visible, .mobile-language-picker button:visible').first()
  await outside.focus()
  await expect(outside).toBeFocused()
  await expect(page.locator('.search-results')).toHaveCount(0)
  await search.tap()
  await search.press('Escape')
  await expect(page.locator('.search-results')).toHaveCount(0)
  await search.fill('Bern')
  await page.locator('.scene canvas').dispatchEvent('pointerdown', { pointerType: 'touch' })
  await expect(page.locator('.search-results')).toHaveCount(0)
  await search.fill('Basel SBB'); await search.press('ArrowDown'); await search.press('Enter')
  await expect(page.locator('.station-card')).toContainText('Basel SBB')
  await search.fill('Bern')
  await page.locator('.search-results .station-result').first().click()
  await expect(page.locator('.station-card')).toContainText('Bern')
})

test('touch selects a train and route without a compatibility click', async ({ page }) => {
  await page.evaluate(() => document.addEventListener('click', event => {
    if ((event.target as Element).closest('.search-results [role="option"]')) {
      event.preventDefault(); event.stopImmediatePropagation()
    }
  }, true))
  const search = page.getByRole('combobox')
  await search.fill('2355')
  await page.locator('.search-results button').filter({ hasText: '2355' }).tap()
  await expect(page.locator('.journey-card')).toBeVisible()
  await expect(page.locator('.search-results')).toHaveCount(0)
  await search.fill('IR35')
  const route = page.locator('.search-results .route-result').first()
  await route.tap()
  await expect(page.locator('.route-card')).toContainText('35')
  await expect(page.locator('.search-results')).toHaveCount(0)
})
