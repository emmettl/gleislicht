import { expect, test } from '@playwright/test'

test('Now crosses Swiss midnight into one prepared new-day session', async ({ page }) => {
  test.skip(Boolean(process.env.E2E_PREVIEW), 'Calendar fixture interception uses Vite modules.')
  const days = ['2026-09-04', '2026-09-05'].map(date => ({ date, feedVersion: '20260902', prefix: `calendar/${date}/`, indexSha256: 'a'.repeat(64) }))
  await page.route('**/src/editions/timetable-calendar.json*', route => route.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify({ schemaVersion: 1, days })}` }))
  const requests: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/data/calendar/**', async route => {
    const url = new URL(route.request().url())
    requests.push(url.pathname)
    const date = url.pathname.match(/calendar\/([^/]+)\//)![1]
    url.pathname = url.pathname.replace(/calendar\/[^/]+\//, '')
    const response = await route.fetch({ url: url.toString() })
    const json = await response.json()
    if (json.metadata?.serviceDate) json.metadata.serviceDate = date
    await route.fulfill({ response, json })
  })
  await page.clock.install({ time: new Date('2026-09-04T21:59:40Z') })
  await page.goto('/?study=national&range=day')
  const now = page.getByRole('button', { name: 'Now', exact: true })
  await expect(now).toBeEnabled()
  await now.click()
  await expect(now).toHaveAttribute('aria-pressed', 'true')
  // Let prefetched old-day chunks settle before intentionally replacing the document.
  await page.waitForLoadState('networkidle')
  await page.clock.fastForward(30_000)
  await expect(page).toHaveURL(/now=1/)
  await expect.poll(() => requests.some(path => path.includes('calendar/2026-09-05/swiss-rail-day-chunks/'))).toBe(true)
  await expect(now).toHaveAttribute('aria-pressed', 'true')
  expect(requests.some(path => path.includes('calendar/2026-09-04/'))).toBe(true)
  expect(errors).toEqual([])
})
