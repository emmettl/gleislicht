import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/paris.html')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Correspondances')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await expect(page.locator('.paris-status')).toContainText('trains en mouvement')
})

test('boots from the bounded IDFM artifact only', async ({ page }) => {
  const resources = await page.evaluate(() =>
    (globalThis as unknown as {
      performance: {
        getEntriesByType(type: string): readonly { readonly name: string }[]
      }
    }).performance.getEntriesByType('resource').map((entry) => entry.name),
  )
  expect(resources.some((url) => url.includes('correspondances-morning.json'))).toBe(true)
  expect(resources.some((url) => url.includes('correspondances-geography.json'))).toBe(true)
  expect(resources.some((url) => url.includes('correspondances-day-manifest'))).toBe(false)
  expect(resources.some((url) => url.includes('correspondances-central-cross'))).toBe(false)
  expect(resources.some((url) => url.includes('correspondances-regional-rer'))).toBe(false)
  expect(resources.some((url) => url.includes('swiss-rail-morning.json'))).toBe(false)
  expect(resources.some((url) => url.includes('all-change-rail-led'))).toBe(false)
  expect(resources.some((url) => url.includes('local-express-lexington'))).toBe(false)
  await expect(page.locator('.paris-transport')).toContainText('07:00')
  await expect(page.locator('.paris-transport')).toContainText('09:00')
})

test('loads the north–south layer only when requested', async ({ page }) => {
  await page.getByRole('button', { name: 'Afficher les couches' }).click()
  const layer = page.getByRole('button', {
    name: 'Couche nord–sud Métro 4, Métro 14 et RER B',
  })
  await layer.click()
  await expect(page.locator('.paris-status')).toContainText('1 couche active')
  await expect.poll(async () => page.evaluate(() =>
    (globalThis as unknown as {
      performance: {
        getEntriesByType(type: string): readonly { readonly name: string }[]
      }
    }).performance
      .getEntriesByType('resource')
      .some((entry) => entry.name.includes('correspondances-central-cross-morning.json')),
  )).toBe(true)

  const search = page.getByRole('searchbox', {
    name: 'Rechercher une station, ligne ou mission',
  })
  await search.fill('Métro 14')
  await expect(page.getByRole('option', { name: /Métro 14/ })).toBeVisible()
  await search.press('Enter')
  await expect(page.locator('.paris-status')).toContainText('Métro 14')
})

test('loads the 24-hour study progressively', async ({ page }) => {
  await page.getByRole('button', { name: 'Étude de vingt-quatre heures' }).click()
  await expect(page.locator('.paris-transport')).toContainText('00:00')
  await expect(page.locator('.paris-transport')).toContainText('24:00')
  await expect(page.locator('.paris-status')).toContainText('1461 missions planifiées')
  await expect.poll(async () => page.evaluate(() => {
    const browser = globalThis as unknown as {
      performance: {
        getEntriesByType(type: string): readonly { readonly name: string }[]
      }
    }
    return browser.performance.getEntriesByType('resource').map((entry) => entry.name)
  })).toEqual(expect.arrayContaining([
    expect.stringContaining('correspondances-day-manifest.json'),
    expect.stringMatching(/correspondances-day-chunks\/\d{2}-\d{2}\.json/),
  ]))
})

test('keeps the optional north–south layer across the progressive 24-hour clock', async ({ page }) => {
  await page.getByRole('button', { name: 'Afficher les couches' }).click()
  const layer = page.getByRole('button', {
    name: 'Couche nord–sud Métro 4, Métro 14 et RER B',
  })
  await layer.click()
  await expect(page.locator('.paris-status')).toContainText('1 couche active')
  await page.getByRole('button', { name: 'Étude de vingt-quatre heures' }).click()
  await expect(page.locator('.paris-transport')).toContainText('24:00')
  await expect.poll(async () => page.evaluate(() => {
    const resources = (globalThis as unknown as {
      performance: {
        getEntriesByType(type: string): readonly { readonly name: string }[]
      }
    }).performance.getEntriesByType('resource')
    return resources.map((entry) => entry.name)
  })).toEqual(expect.arrayContaining([
    expect.stringContaining('correspondances-central-cross-day-manifest.json'),
    expect.stringMatching(/correspondances-central-cross-day-chunks\/\d{2}-\d{2}\.json/),
  ]))
  await expect(page.locator('.paris-status')).toContainText('1 couche active')
})

test('composes the extended RER layer with the cross and the full clock', async ({ page }) => {
  const layers = page.getByRole('button', { name: 'Afficher les couches' })
  await layers.click()
  await page.getByRole('button', {
    name: 'Couche nord–sud Métro 4, Métro 14 et RER B',
  }).click()
  await expect(page.locator('.paris-status')).toContainText('1 couche active')
  await layers.click()
  await page.getByRole('button', {
    name: 'Couche régionale RER C, RER D et RER E',
  }).click()
  await expect(page.locator('.paris-status')).toContainText('977 missions planifiées')
  await expect(page.locator('.paris-status')).toContainText('2 couches actives')

  const search = page.getByRole('searchbox', {
    name: 'Rechercher une station, ligne ou mission',
  })
  await search.fill('RER D')
  await expect(page.getByRole('option', {
    name: /^RER D \d+ MISSIONS PLANIFIÉES$/,
  })).toBeVisible()
  await page.getByRole('button', { name: 'Étude de vingt-quatre heures' }).click()
  await expect(page.locator('.paris-status')).toContainText('4983 missions planifiées')
  await expect.poll(async () => page.evaluate(() => {
    const resources = (globalThis as unknown as {
      performance: {
        getEntriesByType(type: string): readonly { readonly name: string }[]
      }
    }).performance.getEntriesByType('resource')
    return resources.map((entry) => entry.name)
  })).toEqual(expect.arrayContaining([
    expect.stringContaining('correspondances-regional-rer-day-manifest.json'),
    expect.stringMatching(/correspondances-regional-rer-day-chunks\/\d{2}-\d{2}\.json/),
  ]))
})

test('changes scale without replacing the network or stopping its clock', async ({ page }) => {
  const morningRequestCount = async () =>
    page.evaluate(() =>
      (globalThis as unknown as {
        performance: {
          getEntriesByType(type: string): readonly { readonly name: string }[]
        }
      }).performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('correspondances-morning.json')).length,
    )
  const scale = page.getByRole('button', {
    name: 'Basculer entre le centre et la région',
  })
  const clock = page.getByRole('slider', { name: 'Heure' })
  const before = Number(await clock.inputValue())
  const requestsBeforeScaleChange = await morningRequestCount()
  await scale.click()
  await expect(page.locator('.correspondances-experience')).toHaveAttribute(
    'data-scale-view',
    'centre',
  )
  await expect(page.locator('.paris-status')).toContainText('Le cœur en détail')
  await expect.poll(async () => Number(await clock.inputValue())).toBeGreaterThan(before)
  expect(await morningRequestCount()).toBe(requestsBeforeScaleChange)
  await scale.click()
  await expect(page.locator('.correspondances-experience')).toHaveAttribute(
    'data-scale-view',
    'region',
  )
})

test('Métro and RER can be isolated independently', async ({ page }) => {
  const metro = page.getByRole('button', { name: 'Isoler Métro 1' })
  const rer = page.getByRole('button', { name: 'Isoler RER A' })
  await metro.click()
  await expect(metro).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.paris-status')).toContainText('Métro 1')
  await rer.click()
  await expect(rer).toHaveAttribute('aria-pressed', 'true')
  await expect(metro).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.paris-status')).toContainText('RER A')
})

test('the correspondence director cycles authored hubs using published transfer evidence', async ({ page }) => {
  const nextHub = page.getByRole('button', { name: 'Prochaine correspondance' })
  await nextHub.click()
  await expect(page.locator('.paris-status')).toContainText('Châtelet–Les Halles')
  await expect(page.locator('.paris-status')).toContainText('densité Métro au centre')
  await expect(page.locator('.paris-status')).toContainText(/Métro 1 → RER A|RER A → Métro 1/)
  await expect(page.locator('.paris-status')).toContainText('minimum publié')
  await expect(page.getByRole('button', { name: 'Lecture' })).toBeVisible()
  await nextHub.click()
  await expect(page.locator('.paris-status')).toContainText('Gare de Lyon')
  await expect(page.locator('.paris-status')).toContainText('échange Métro–RER est-ouest')
  await nextHub.click()
  await expect(page.locator('.paris-status')).toContainText('La Défense')
  await expect(page.locator('.paris-status')).toContainText('le réseau régional rencontre Paris')
})

test('accent-insensitive station search and mission-code search are selectable', async ({ page }) => {
  const search = page.getByRole('searchbox', {
    name: 'Rechercher une station, ligne ou mission',
  })
  await search.fill('chatelet')
  await expect(page.getByRole('option', { name: /Châtelet/ }).first()).toBeVisible()
  await search.press('Enter')
  await expect(page.locator('.paris-status')).toContainText('Châtelet')
  await search.fill('ZKAM31')
  await expect(page.getByRole('option', { name: /ZKAM31/ })).toBeVisible()
  await search.press('Enter')
  await expect(page.locator('.paris-status')).toContainText('ZKAM31')
  await expect(page.locator('.paris-status')).toContainText('Saint-Germain-en-Laye')
})

test('typing in search does not activate global playback shortcuts', async ({ page }) => {
  const search = page.getByRole('searchbox', {
    name: 'Rechercher une station, ligne ou mission',
  })
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await search.pressSequentially('Gare de Lyon')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('iPhone chrome remains inside the viewport and reduces to the timeline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit', 'iPhone-only layout gate')
  const layout = await page.evaluate(() => {
    const browser = globalThis as unknown as {
      document: {
        documentElement: { scrollWidth: number }
        querySelector(selector: string): {
          getBoundingClientRect(): {
            left: number
            right: number
            top: number
            bottom: number
          }
        } | null
      }
      innerWidth: number
      innerHeight: number
    }
    const selectors = [
      '.paris-masthead',
      '.paris-search',
      '.paris-status',
      '.paris-routes',
      '.paris-transport',
    ]
    return {
      overflow: browser.document.documentElement.scrollWidth - browser.innerWidth,
      boxes: selectors.map((selector) => {
        const box = browser.document.querySelector(selector)?.getBoundingClientRect()
        return box ? { selector, left: box.left, right: box.right, top: box.top, bottom: box.bottom } : null
      }),
      width: browser.innerWidth,
      height: browser.innerHeight,
    }
  })
  expect(layout.overflow).toBeLessThanOrEqual(1)
  for (const box of layout.boxes) {
    expect(box, box?.selector).not.toBeNull()
    expect(box?.left, box?.selector).toBeGreaterThanOrEqual(-1)
    expect(box?.right, box?.selector).toBeLessThanOrEqual(layout.width + 1)
    expect(box?.top, box?.selector).toBeGreaterThanOrEqual(-1)
    expect(box?.bottom, box?.selector).toBeLessThanOrEqual(layout.height + 1)
  }
  await page.getByRole('button', { name: 'Plein écran' }).click()
  await expect(page.locator('.correspondances-experience')).toHaveAttribute('data-limited-chrome', 'true')
  await expect(page.locator('.paris-masthead')).not.toBeVisible()
  await expect(page.locator('.paris-transport')).toBeVisible()
})
