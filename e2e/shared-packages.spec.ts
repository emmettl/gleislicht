import { expect, test, type Page } from '@playwright/test'

const fixtureUrl = '/e2e/fixtures/shared-widgets.html'
const kinds = ['network', 'air', 'road'] as const

type Kind = (typeof kinds)[number]
function manifest(kind: Kind, model: string, empty = false) {
  return {
    metadata: { model, publisher: 'Synthetic fixture', serviceDate: '2026-01-01',
      feedVersion: model, windowStart: 0, windowEnd: 20, focusTime: 5,
      sourceUrl: 'https://example.test/synthetic', note: 'Test fixture' },
    bounds: { minLongitude: 0, maxLongitude: 1, minLatitude: 0, maxLatitude: 1 },
    stops: [], edges: [], aircraft: [], siteIds: [], sections: [],
    chunks: empty ? [] : [0, 10].map((start, index) => ({
      id: String(index), path: `${kind}/${model}/chunk-${index}.json`,
      windowStart: start, windowEnd: start + 10,
      tripCount: 0, trackCount: 0, sampleCount: 0, minuteCount: 0, valueCount: 0,
    })),
  }
}
async function stubData(page: Page, options: { failChunk?: () => boolean; slowChunk?: () => boolean } = {}) {
  const requests: string[] = []
  await page.route('**/lab-data/**', async (route) => {
    const path = `/lab-data/${route.request().url().split('/lab-data/')[1]}`
    requests.push(path)
    const [, , root, kind, file] = path.split('/')
    if (path.endsWith('chunk-0.json') || path.endsWith('chunk-1.json')) {
      if (options.slowChunk?.() && path.includes('/primary-')) await page.waitForTimeout(300)
      if (options.failChunk?.() && path.endsWith('chunk-1.json')) {
        await route.fulfill({ status: 503, body: 'Temporarily unavailable' })
      } else {
        await route.fulfill({ json: { windowStart: 0, windowEnd: 20, trains: [], tracks: [], minutes: [] } })
      }
    } else if (file === 'missing.json') {
      await route.fulfill({ status: 404, body: 'No dataset' })
    } else {
      if (file === 'slow.json') await page.waitForTimeout(300)
      await route.fulfill({ json: manifest(kind as Kind, `${root}-${file.replace('.json', '')}`, file === 'empty.json') })
    }
  })
  return requests
}

test('the picker works and is styled using only package assets', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto(fixtureUrl)
  const picker = page.getByRole('button', { name: 'Example picker' })
  await expect(picker).toHaveCSS('min-height', '42px')
  await expect(page.getByRole('button', { name: 'Empty picker' })).toBeDisabled()
  await picker.focus()
  await picker.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'One First option' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('choice')).toHaveText('two')
  await expect(picker).toBeFocused()
  await picker.press('ArrowUp')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(picker).toBeFocused()
  expect(requests.some((url) => /^https?:\/\/[^/]+\/(?:src|data)\//.test(url))).toBe(false)
})

for (const kind of kinds) {
  test(`${kind} loader resets data and errors when its source or asset root changes`, async ({ page }) => {
    const requests = await stubData(page)
    await page.goto(fixtureUrl)
    await page.getByLabel('Loader').selectOption(kind)
    expect(requests).toHaveLength(0)
    await page.getByRole('button', { name: 'Enable', exact: true }).click()
    const state = page.getByTestId('state')
    await expect(state).toHaveAttribute('data-ready', 'true')
    await expect(state).toHaveAttribute('data-model', 'primary-a')
    await page.getByLabel('Dataset').selectOption('missing')
    await expect(state).toHaveAttribute(kind === 'road' ? 'data-unavailable' : 'data-error', 'true')
    await expect(state).toHaveAttribute('data-model', '')
    await page.getByLabel('Dataset').selectOption('b')
    await expect(state).toHaveAttribute('data-model', 'primary-b')
    await expect(state).toHaveAttribute('data-ready', 'true')
    await expect(state).toHaveAttribute('data-error', 'false')
    await expect(state).toHaveAttribute('data-unavailable', 'false')
    await page.getByRole('button', { name: 'Change asset root' }).click()
    await expect(state).toHaveAttribute('data-model', 'alternate-b')
    await expect(state).toHaveAttribute('data-ready', 'true')
    await page.getByLabel('Dataset').selectOption('empty')
    await expect(state).toHaveAttribute('data-error', 'true')
    await expect(state).toHaveAttribute('data-loading', 'false')
  })

  test(`${kind} loader discards a late response from the previous dataset`, async ({ page }) => {
    await stubData(page)
    await page.goto(fixtureUrl)
    await page.getByLabel('Loader').selectOption(kind)
    await page.getByLabel('Dataset').selectOption('slow')
    const slowRequest = page.waitForRequest(`**/${kind}/slow.json`)
    await page.getByRole('button', { name: 'Enable', exact: true }).click()
    await slowRequest
    await page.getByLabel('Dataset').selectOption('b')
    const state = page.getByTestId('state')
    await expect(state).toHaveAttribute('data-model', 'primary-b')
    await expect(state).toHaveAttribute('data-ready', 'true')
    // Give the deliberately delayed stale response time to complete.
    await page.waitForTimeout(400)
    await expect(state).toHaveAttribute('data-model', 'primary-b')
  })

  test(`${kind} loader recovers from a failed prefetched chunk`, async ({ page }) => {
    let fail = true
    const requests = await stubData(page, { failChunk: () => fail })
    await page.goto(fixtureUrl)
    await page.getByLabel('Loader').selectOption(kind)
    await page.getByRole('button', { name: 'Enable', exact: true }).click()
    const state = page.getByTestId('state')
    await expect(state).toHaveAttribute('data-ready', 'true')
    await expect.poll(() => requests.some((path) => path.endsWith('chunk-1.json'))).toBe(true)
    await expect(state).toHaveAttribute('data-error', 'false')
    await page.getByRole('button', { name: 'Next chunk' }).click()
    await expect(state).toHaveAttribute('data-error', 'true')
    fail = false
    await page.getByRole('button', { name: 'Disable', exact: true }).click()
    await page.getByRole('button', { name: 'Enable', exact: true }).click()
    await expect(state).toHaveAttribute('data-ready', 'true')
    await expect(state).toHaveAttribute('data-error', 'false')
  })
}

test('observations clear old endpoint data and ignore a late response', async ({ page }) => {
  await page.route('**/observation-data/**', async (route) => {
    const name = route.request().url().split('/').at(-1)!.replace('.json', '')
    if (name === 'slow') await page.waitForTimeout(300)
    if (name === 'fail') await route.fulfill({ status: 503, body: 'Unavailable' })
    else await route.fulfill({ json: { metadata: { publisher: name }, vehicles: [], lineStatuses: [] } })
  })
  await page.goto(fixtureUrl)
  await page.getByRole('button', { name: 'Start observations', exact: true }).click()
  const state = page.getByTestId('observations')
  await expect(state).toHaveAttribute('data-source', 'a')
  const slow = page.waitForRequest('**/observation-data/slow.json')
  await page.getByLabel('Observation endpoint').selectOption('slow')
  await slow
  await expect(state).toHaveAttribute('data-source', '')
  await page.getByLabel('Observation endpoint').selectOption('b')
  await expect(state).toHaveAttribute('data-source', 'b')
  await page.waitForTimeout(350)
  await expect(state).toHaveAttribute('data-source', 'b')
  await page.getByLabel('Observation endpoint').selectOption('fail')
  await expect(state).toHaveAttribute('data-error', 'true')
  await expect(state).toHaveAttribute('data-source', '')
  await page.getByRole('button', { name: 'Stop observations', exact: true }).click()
  await expect(state).toHaveAttribute('data-loading', 'false')
})

test('observations never overlap slow polls and stop requesting after unmount', async ({ page }) => {
  let inFlight = 0
  let peak = 0
  let requests = 0
  await page.route('**/observation-data/**', async (route) => {
    requests++
    inFlight++
    peak = Math.max(peak, inFlight)
    await page.waitForTimeout(120)
    await route.fulfill({ json: { metadata: { publisher: 'a' }, vehicles: [], lineStatuses: [] } })
    inFlight--
  })
  await page.goto(fixtureUrl)
  await page.getByRole('button', { name: 'Start observations', exact: true }).click()
  await expect.poll(() => requests).toBeGreaterThanOrEqual(3)
  expect(peak).toBe(1)
  await page.getByRole('button', { name: 'Unmount observations', exact: true }).click()
  const stoppedAt = requests
  await page.waitForTimeout(250)
  expect(requests).toBe(stoppedAt)
  await expect(page.getByTestId('observations')).toHaveCount(0)
})
