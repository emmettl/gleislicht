import { expect, test, type Page } from '@playwright/test'

async function selectLanguage(page: Page, mobile: boolean, language: string) {
  if (mobile) {
    await page.locator('.mobile-language-picker .mobile-picker__trigger').click()
    await page.getByRole('option', { name: new RegExp(`^${language} `) }).click()
  } else {
    await page.locator('.language-picker').getByRole('button', { name: language, exact: true }).click()
  }
}

test('translations load only when selected and survive a reload', async ({ page, isMobile }) => {
  const requests: string[] = []
  page.on('request', request => { if (/\/src\/locales\/(de|fr|it)\.ts/.test(request.url())) requests.push(request.url()) })
  await page.goto('/')
  await expect(page).toHaveTitle('Gleislicht — Switzerland in motion')
  await expect(page.locator('.scene canvas')).toBeVisible()
  expect(requests).toHaveLength(0)
  for (const [language, title] of [
    ['DE', 'Gleislicht — Schweiz in Bewegung'],
    ['FR', 'Gleislicht — La Suisse en mouvement'],
    ['IT', 'Gleislicht — Svizzera in movimento'],
  ]) {
    await selectLanguage(page, isMobile, language)
    await expect(page).toHaveTitle(title)
    expect(requests.some(url => url.includes(`/locales/${language.toLowerCase()}.ts`))).toBe(true)
  }
  await page.reload()
  await expect(page).toHaveTitle('Gleislicht — Svizzera in movimento')
  await selectLanguage(page, isMobile, 'EN')
  await expect(page).toHaveTitle('Gleislicht — Switzerland in motion')
})

test('a delayed translation cannot replace a newer language selection', async ({ page, isMobile }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/locales/de.ts*', async route => { await gate; await route.continue() })
  await page.goto('/')
  await expect(page).toHaveTitle('Gleislicht — Switzerland in motion')
  const germanRequested = page.waitForRequest('**/src/locales/de.ts*')
  await selectLanguage(page, isMobile, 'DE')
  await germanRequested
  await selectLanguage(page, isMobile, 'FR')
  await expect(page).toHaveTitle('Gleislicht — La Suisse en mouvement')
  const germanLoaded = page.waitForResponse('**/src/locales/de.ts*')
  release()
  await germanLoaded
  await expect(page).toHaveTitle('Gleislicht — La Suisse en mouvement')
  await selectLanguage(page, isMobile, 'DE')
  await expect(page).toHaveTitle('Gleislicht — Schweiz in Bewegung')
})
