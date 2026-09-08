import { expect, test, type Page } from '@playwright/test'

async function openPostbus(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.locator('.mobile-study-picker button').first().click()
    await page.getByRole('option', { name: /PA/ }).click()
  } else {
    await page.getByRole('button', { name: 'PostBus · all Switzerland · 24 hours', exact: true }).click()
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Switzerland by PostBus')
}

test('national PostBus stays lazy, renders the full network and follows the 24-hour clock', async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().includes('postbus-national')) requests.push(request.url()) })
  await page.goto('/?perf=1')
  await expect(page.locator('.scene canvas')).toBeVisible()
  expect(requests).toEqual([])
  const started = Date.now()
  await openPostbus(page, isMobile)
  await expect(page.locator('.network-card .between')).toContainText('Scheduled PostBus')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  await expect(page.locator('.metric-grid')).toContainText('24h')
  expect(requests.some(url => url.endsWith('06-09.json'))).toBe(true)
  expect(requests.some(url => url.endsWith('15-18.json'))).toBe(false)
  const loadedMs = Date.now() - started
  // Keep the renderer playing at its peak morning load while sampling local frame timing.
  const samples = await page.evaluate(async () => {
    const intervals: number[] = []
    let previous = performance.now()
    return await new Promise<{ fps: number; p95FrameMs: number }>(resolve => {
      const frame = (now: number) => {
        intervals.push(now - previous); previous = now
        if (intervals.length < 180) { requestAnimationFrame(frame); return }
        const sorted = [...intervals].sort((a, b) => a - b)
        resolve({ fps: 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length), p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] })
      }
      requestAnimationFrame(frame)
    })
  })
  await testInfo.attach('postbus-performance.json', { body: JSON.stringify({ loadedMs, ...samples }), contentType: 'application/json' })
  console.log(testInfo.project.name, 'PostBus performance', { loadedMs, ...samples })
  const scrubber = page.locator('.scrubber input')
  await scrubber.fill('62100')
  await expect(page.locator('.network-card .between')).toContainText('Scheduled PostBus')
  await expect.poll(() => requests.some(url => url.endsWith('15-18.json'))).toBe(true)
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('—')
  await scrubber.fill('3600')
  await expect(page.locator('.network-count-row strong').first()).toHaveText('0')
  await expect(page.locator('.network-card .between')).toContainText('Scheduled PostBus')
  await scrubber.fill('27900')
  await expect(page.locator('.network-count-row strong').first()).not.toHaveText('0')
  const search = page.locator('.train-search input')
  await search.fill('220')
  await expect(page.locator('.route-result .result-route').first()).toContainText(/Bahnhof|Griesalp|Reichenbach/)
  await page.locator('.route-result').first().click()
  await expect(page.locator('.route-card')).toBeVisible()
  expect(errors).toEqual([])
})

test('corrupt movement data enters an error state instead of rendering it', async ({ page, isMobile }) => {
  await page.route('**/postbus-national-day-chunks/06-09.json', route => route.fulfill({ json: { trains: [] } }))
  await page.goto('/')
  await openPostbus(page, isMobile)
  await expect(page.locator('.network-card')).toContainText('PostBus timetable unavailable')
  await expect(page.locator('.network-count-row strong').first()).toHaveText('—')
})

test('missing PostBus data is disclosed without showing rail counts as buses', async ({ page, isMobile }) => {
  await page.route('**/postbus-national-day-manifest.json', route => route.fulfill({ status: 503, body: '' }))
  await page.goto('/')
  await openPostbus(page, isMobile)
  await expect(page.locator('.network-card')).toContainText('PostBus timetable unavailable')
  await expect(page.locator('.network-count-row strong').first()).toHaveText('—')
})
