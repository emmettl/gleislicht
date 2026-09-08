import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

// Profile the user's LUFT + Auto combination against a local dev/preview server.
// --metal uses this Mac's GPU; default headless rendering may use software.
const url = process.argv.find(value => /^https?:\/\//.test(value)) ?? 'http://127.0.0.1:4192/'
const browser = await chromium.launch({ args: process.argv.includes('--metal') ? ['--use-angle=metal', '--enable-gpu'] : [] })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url)
  await page.waitForSelector('.scene canvas')
  await page.locator('.network-study-picker .sbb-toggle').click()
  await page.locator('.network-study-picker .air-toggle').click()
  await page.locator('.network-study-picker .road-toggle').click()
  await page.waitForFunction(() => /[1-9]/.test(document.querySelector('.air-count')?.textContent ?? ''))
  await page.waitForFunction(() => /[1-9]/.test(document.querySelector('.road-count')?.textContent ?? ''))
  await page.waitForTimeout(2000)
  const client = await page.context().newCDPSession(page)
  const cpuRate = Number(process.env.CPU_RATE ?? 1)
  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuRate })
  await client.send('Performance.enable')
  const before = await client.send('Performance.getMetrics')
  await client.send('Profiler.enable')
  await client.send('Profiler.start')
  const timing = await page.evaluate(() => new Promise(resolve => {
    const intervals = []
    let previous
    function frame(now) {
      if (previous !== undefined) intervals.push(now - previous)
      previous = now
      if (intervals.length < 300) requestAnimationFrame(frame)
      else {
        const gl = document.querySelector('.scene canvas').getContext('webgl2')
        const info = gl.getExtension('WEBGL_debug_renderer_info')
        resolve({
          renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unavailable',
          fps: 1000 * intervals.length / intervals.reduce((a, b) => a + b, 0),
          p95FrameMs: intervals.sort((a, b) => a - b)[Math.floor(intervals.length * 0.95)],
        })
      }
    }
    requestAnimationFrame(frame)
  }))
  const { profile } = await client.send('Profiler.stop')
  const after = await client.send('Performance.getMetrics')
  const metric = (set, key) => set.metrics.find(metric => metric.name === key)?.value ?? 0
  const output = process.env.PROFILE_OUTPUT
  if (output) await writeFile(output, JSON.stringify(profile))
  const totals = new Map()
  for (const node of profile.nodes) {
    const frame = node.callFrame
    const name = `${frame.functionName || '(anonymous)'} ${frame.url.split('/').at(-1)?.split('?')[0]}:${frame.lineNumber + 1}`
    totals.set(name, (totals.get(name) ?? 0) + (node.hitCount ?? 0))
  }
  console.log(JSON.stringify({ url, cpuRate, ...timing,
    scriptMsPerFrame: 1000 * (metric(after, 'ScriptDuration') - metric(before, 'ScriptDuration')) / 300,
    errors, topSamples: [...totals].sort((a, b) => b[1] - a[1]).slice(0, 25) }, null, 2))
} finally {
  await browser.close()
}
