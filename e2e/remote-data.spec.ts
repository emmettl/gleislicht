import { expect, test } from '@playwright/test'
import release from '../src/editions/data-release.json' with { type: 'json' }

test('production loads the pinned R2 timetable without local data fallback', async ({page}) => {
  test.skip(!process.env.E2E_PREVIEW, 'Run against the production build with E2E_PREVIEW=1.')
  const requested: string[] = []
  const failures: string[] = []
  const loadedChunks: string[] = []
  page.on('request', request => requested.push(request.url()))
  page.on('requestfailed', request => failures.push(request.url()))
  page.on('response', response => {
    if (!response.url().startsWith(release.baseUrl)) return
    if (!response.ok()) failures.push(response.url())
    else if (response.url().includes('swiss-rail-day-chunks/')) loadedChunks.push(response.url())
  })
  await page.goto('/?range=day')
  await expect(page.locator('.train-search input')).toBeVisible()
  await expect.poll(() => loadedChunks.length).toBeGreaterThan(0)
  const appOrigin = new URL(page.url()).origin
  expect(requested.filter(url => new URL(url).origin === appOrigin && new URL(url).pathname.startsWith('/data/'))).toEqual([])
  expect(failures.filter(url => url.startsWith(release.baseUrl))).toEqual([])
  const jsonResponses = await page.request.get(release.baseUrl + 'swiss-rail-day-manifest.json')
  expect(jsonResponses.ok()).toBeTruthy()
  const manifest = await jsonResponses.json()
  expect(manifest.metadata.serviceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  await expect(page.locator('.scrubber input')).toBeEnabled()
})

test('production decodes orbital blocks from R2', async ({page}) => {
  test.skip(!process.env.E2E_PREVIEW, 'Run against the production build with E2E_PREVIEW=1.')
  const errors: string[] = []
  const blocks: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    if (response.url().startsWith(release.baseUrl) && response.url().endsWith('.bin.gz') && response.ok()) blocks.push(response.url())
  })
  await page.goto('/?view=orbital')
  await expect(page.getByRole('button', {name:'Pause playback', exact:true})).toBeEnabled({timeout:60_000})
  expect(blocks.length).toBeGreaterThan(0)
  expect(errors).toEqual([])
})
