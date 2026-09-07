import { defineConfig, devices } from '@playwright/test'

const externalUrl = (globalThis as { process?: { env?: { MOTION_LAB_URL?: string } } }).process?.env?.MOTION_LAB_URL
export default defineConfig({
  testDir: './lab/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 1,
  forbidOnly: true,
  use: { baseURL: externalUrl ?? 'http://127.0.0.1:4174', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: externalUrl ? undefined : {
    command: 'npm run lab -- --strictPort', url: 'http://127.0.0.1:4174', reuseExistingServer: true,
  },
})
