import { expect, test } from '@playwright/test'

for (const study of ['surveys', 'summaries'] as const) test(`${study} verify lazy assets and recover after a corrupt download`, async ({ page }) => {
  const requests: string[] = []
  const folder = study === 'surveys' ? 'aargau-road-statistics' : 'geneva-luzern-statistics'
  let attempts = 0, corrupt = true
  page.on('request', request => { if (request.url().includes(folder + '/')) requests.push(request.url()) })
  await page.route(`**/${folder}/*.json`, async route => {
    if (new URL(route.request().url()).pathname.endsWith('/index.json')) { await route.continue(); return }
    attempts++
    const response = await route.fetch()
    // Keep the original manifest and corrupt downloads until the explicit retry.
    await route.fulfill({ response, body: (await response.text()) + (corrupt ? ' ' : '') })
  })
  await page.goto('/?time=28800')
  const open = page.getByRole('button', { name: 'Road recordings', exact: true })
  await expect(open).toBeVisible()
  expect(requests).toHaveLength(0)
  await open.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: study === 'surveys' ? /Aargau road surveys/ : /Geneva & Luzern road statistics/ }).click()
  await expect(dialog.getByRole('alert')).toContainText(study === 'surveys' ? 'Road surveys could not be loaded.' : 'Statistics could not be loaded.')
  expect(attempts).toBeGreaterThan(0)
  const beforeRetry = attempts
  corrupt = false
  await dialog.getByRole('button', { name: 'Try again' }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByRole('combobox', { name: study === 'surveys' ? 'Reference year' : 'Counter', exact: true })).toBeVisible()
  expect(attempts).toBeGreaterThan(beforeRetry)
  await expect(dialog).toContainText(study === 'surveys' ? 'Survey statistics, not traffic on a selected day.' : 'Statistical averages, not traffic observed on a selected day.')
  if (study === 'summaries') {
    await dialog.getByRole('combobox', { name: 'Region', exact: true }).selectOption('luzern')
    await expect(dialog.getByRole('heading', { name: 'Typical weekday · vehicles per hour', exact: true })).toBeVisible()
    await expect(dialog).toContainText('The discrepancy is unresolved.')
  }
})
