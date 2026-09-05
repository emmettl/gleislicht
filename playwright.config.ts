import { defineConfig, devices } from '@playwright/test'

const runningInCi = Boolean(
  (globalThis as { process?: { env?: { CI?: string } } }).process?.env?.CI,
)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: true,
  // Hosted WebKit occasionally loses a software-rendered WebGL context while
  // the Chromium project is rendering in parallel. Retry that isolated test
  // once in CI; local runs remain strict and immediate.
  retries: runningInCi ? 1 : 0,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'dark',
    locale: 'en-CH',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone-webkit',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
