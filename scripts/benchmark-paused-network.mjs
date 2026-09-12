import { chromium } from '@playwright/test'

const url = process.argv.find(value => /^https?:\/\//.test(value)) ?? 'http://127.0.0.1:4203/'
const rate = Number(process.env.CPU_RATE ?? 24)
const browser = await chromium.launch({ args: process.argv.includes('--metal') ? ['--use-angle=metal', '--enable-gpu'] : [] })
try {
  for (const study of ['CH', 'PA']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.goto(url)
    if (study === 'PA') {
      await page.locator('.sbb-toggle').click()
      await page.locator('.postbus-toggle').click()
    }
    await page.getByRole('button', { name: /Pause motion/i }).click()
    await page.locator('.scrubber input').fill('27900')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setCPUThrottlingRate', { rate })
    await page.waitForTimeout(1500)
    await session.send('Performance.enable')
    const before = await session.send('Performance.getMetrics')
    const frames = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now(); let frames = 0
      const tick = () => { frames++; if (performance.now() - start < 3000) requestAnimationFrame(tick); else resolve(frames) }
      requestAnimationFrame(tick)
    }))
    const after = await session.send('Performance.getMetrics')
    const metric = (sample, key) => sample.metrics.find(entry => entry.name === key).value
    const seconds = metric(after, 'Timestamp') - metric(before, 'Timestamp')
    console.log(JSON.stringify({ url, study, cpuRate: rate, frames, seconds,
      scriptMsPerSecond: 1000 * (metric(after, 'ScriptDuration') - metric(before, 'ScriptDuration')) / seconds, errors }))
    await page.close()
  }
} finally { await browser.close() }
