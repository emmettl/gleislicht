import { chromium } from '@playwright/test'

const url = process.argv.find(value => /^https?:\/\//.test(value)) ?? 'http://127.0.0.1:4196/'
const cpuRate = Number(process.env.CPU_RATE ?? 8)
const browser = await chromium.launch({ args: process.argv.includes('--metal') ? ['--use-angle=metal', '--enable-gpu'] : [] })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url)
  const button = page.getByRole('button', { name: 'PostBus · all Switzerland · 24 hours', exact: true })
  await button.click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setCPUThrottlingRate', { rate: cpuRate })
  await page.evaluate(() => {
    window.__interactionSamples = []
    new PerformanceObserver(list => {
      for (const event of list.getEntries()) if (event.interactionId && event.target?.matches('.postbus-study-toggle')) {
        window.__interactionSamples.push({ interactionId: event.interactionId, name: event.name, duration: event.duration,
          inputDelay: event.processingStart - event.startTime,
          processing: event.processingEnd - event.processingStart })
      }
    }).observe({ type: 'event', durationThreshold: 16 })
  })
  await page.waitForTimeout(1500)
  for (let i = 0; i < 8; i++) {
    await button.press('Enter')
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(1000)
  const samples = await page.evaluate(() => window.__interactionSamples)
  const interactions = new Map()
  for (const sample of samples) interactions.set(sample.interactionId, Math.max(interactions.get(sample.interactionId) ?? 0, sample.duration))
  const durations = [...interactions.values()].sort((a, b) => a - b)
  console.log(JSON.stringify({ url, cpuRate, errors, eventCount: samples.length, interactionCount: interactions.size,
    medianMs: durations.length ? (durations[Math.floor((durations.length - 1) / 2)] + durations[Math.floor(durations.length / 2)]) / 2 : undefined,
    p95Ms: durations[Math.floor(durations.length * .95)], samples }))
} finally { await browser.close() }
