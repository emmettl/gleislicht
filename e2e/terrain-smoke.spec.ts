import { expect, test } from '@playwright/test'

// Timetable, direction, dwell, mask, retry and invalid-data matrices run in Vitest.
// Here we check actual R3F frames and clock ownership when the scene unmounts.
for (const journey of [
  { study: 'gornergrat', initial: 43200, start: /Follow Zermatt to Gornergrat/, card: '.gornergrat-ascent', scene: '.gornergrat-terrain-scene', outdoor: 45000, portal: 43570, mask: /tunnel/ },
  { study: 'pilatus', initial: 44100, start: /Follow the Pilatus railway/, card: '.pilatus-journey', scene: '.pilatus-terrain-scene', outdoor: 44620, portal: 44430, mask: /tunnel/ },
  { study: 'rochers', initial: 41640, start: /Follow Montreux to Rochers-de-Naye/, card: '.rochers-journey', scene: '.rochers-terrain-scene', outdoor: 43000, portal: 43620, mask: /covered/ },
  { study: 'territet', initial: 43440, start: /Follow the Territet–Glion funicular/, card: '.territet-journey', scene: '.territet-terrain-scene', outdoor: 43500, portal: 43560, mask: /alignment/ },
  { study: 'jungfrau', initial: 43440, start: /Follow the ascent via Wengen/, card: '.jungfrau-ascent', scene: '.jungfrau-terrain-scene', outdoor: 48060, portal: 46930, mask: /tunnel/ },
]) {
  test(`${journey.study}: measured frames and uninterrupted map/terrain handoff`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/?study=${journey.study}`)
    await page.getByRole('button', { name: journey.start }).click()
    const clock = page.locator('.scrubber input'), card = page.locator(journey.card), scene = page.locator(journey.scene)
    await expect(card).toBeVisible()
    await expect(clock).toHaveValue(String(journey.initial))
    await clock.fill(String(journey.outdoor))
    await card.getByRole('button', { name: 'Follow in measured terrain', exact: true }).click()
    await expect(scene).toHaveAttribute('data-rendered', 'true')
    if (journey.study === 'territet') await expect(scene).toHaveAttribute('data-context-tracks', '2')
    await expect(clock).toHaveValue(String(journey.outdoor))
    await clock.fill(String(journey.portal))
    await page.getByRole('button', { name: /Resume motion/ }).click()
    await expect(scene).toHaveCount(0)
    await expect(card.locator('[data-terrain-status]')).toHaveAttribute('data-terrain-status', journey.mask)
    await expect(page.getByRole('button', { name: /Pause motion/ })).toBeVisible()
    await page.getByRole('button', { name: /Pause motion/ }).click()
    await clock.fill(String(journey.outdoor))
    await expect(scene).toHaveAttribute('data-rendered', 'true')
    await card.getByRole('button', { name: 'Return to map', exact: true }).click()
    await expect(scene).toHaveCount(0)
    await expect(clock).toHaveValue(String(journey.outdoor))
    expect(errors).toEqual([])
  })
}

test('Glion replaces the funicular renderer with railway terrain through the interchange', async ({ page }) => {
  await page.goto('/?study=territet&date=2026-09-04&time=41700&glion=.ojp-91-37-F.1.TA.45.j26')
  const card = page.locator('.glion-journey'), clock = page.locator('.scrubber input')
  await card.getByRole('button', { name: 'Follow in measured terrain', exact: true }).click()
  await expect(page.locator('.territet-terrain-scene')).toHaveAttribute('data-rendered', 'true')
  await clock.fill('41990')
  await page.getByRole('button', { name: /Resume motion/ }).click()
  await expect(card).toHaveAttribute('data-phase', 'interchange')
  await expect(page.locator('.territet-terrain-scene')).toHaveCount(0)
  await page.getByRole('button', { name: /Pause motion/ }).click()
  await clock.fill('42960')
  await expect(page.locator('.rochers-terrain-scene')).toHaveAttribute('data-rendered', 'true')
  await expect(page.locator('.territet-terrain-scene')).toHaveCount(0)
  await card.getByRole('button', { name: 'Return to map', exact: true }).click()
  await expect(clock).toHaveValue('42960')
  await expect(page.locator('.rochers-terrain-scene')).toHaveCount(0)
})

test('Rigi timetable terrain retains its paused clock and returns control to the map', async ({ page }) => {
  await page.goto('/?study=rigi-lake&time=43200')
  await page.getByRole('button', { name: /Follow lake to summit/ }).click()
  const card = page.locator('.rigi-sequence'), clock = page.locator('.scrubber input')
  await expect(card).toHaveAttribute('data-phase', 'boat')
  await expect(clock).toHaveValue('43920')
  await clock.fill('48780')
  await card.getByRole('button', { name: /Follow this train in terrain/ }).click()
  await expect(page.locator('.rigi-timetable-scene canvas')).toBeVisible()
  await expect(clock).toHaveValue('48780')
  await expect(page.locator('.rigi-timetable-scene')).toHaveAttribute('data-stopped', 'true')
  await page.getByRole('button', { name: /Resume motion/ }).click()
  await expect.poll(async () => Number(await clock.inputValue())).toBeGreaterThan(48780)
  await page.getByRole('button', { name: /Pause motion/ }).click()
  await clock.fill('48960')
  await card.getByRole('button', { name: /Return to map/ }).click()
  await expect(page.locator('.rigi-timetable-scene')).toHaveCount(0)
  await expect(clock).toHaveValue('48960')
})

test('scenic Rigi switches measured approaches and leaves mobile landscape clearance', async ({ page, isMobile }) => {
  await page.goto('/?study=rigi-lake')
  for (const approach of ['Vitznau', 'Arth-Goldau']) {
    await page.getByRole('button', { name: new RegExp(`Climb ${approach}`) }).click()
    await expect(page.locator('h1')).toHaveText(`${approach} → Rigi Kulm`)
    await expect(page.locator('.rigi-terrain-profile')).toBeVisible()
    await expect(page.locator('.scene canvas')).toBeVisible()
    if (isMobile) {
      const card = (await page.locator('.journey-card').boundingBox())!, transport = (await page.locator('.transport').boundingBox())!
      expect(card.height).toBeLessThan(190)
      expect(transport.y - card.y - card.height).toBeGreaterThan(230)
    }
  }
})
