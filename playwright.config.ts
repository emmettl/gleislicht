import { defineConfig, devices } from '@playwright/test'

const runningInCi = Boolean(
  (globalThis as { process?: { env?: { CI?: string } } }).process?.env?.CI,
)

const port = Number(process.env.E2E_PORT ?? 4180)

export default defineConfig({
  testDir: './e2e',
  // Let CI shards divide individual tests, including the large core spec.
  // workers: 1 below still prevents concurrent WebGL rendering on a runner.
  fullyParallel: runningInCi,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: true,
  // Retry transient hosted software-renderer failures once in CI.
  retries: runningInCi ? 1 : 0,
  // Two continuously rendered WebGL editions can starve Chromium's input and
  // animation loop on the shared CI runner. Keep local feedback parallel, but
  // run CI shards on separate runners with one worker each.
  workers: runningInCi ? 1 : 2,
  reporter: runningInCi
    ? [
        ['list'],
        ['github'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['./scripts/playwright-summary-reporter.mjs'],
      ]
    : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
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
      // Pure buffer/batching invariants run once in Chromium. WebKit retains
      // real worker lifecycle, scene transitions, labels/picking and touch/layout.
      testIgnore: ['**/label-performance.spec.ts', '**/hub-rendering.spec.ts', '**/methodology.spec.ts'],
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
