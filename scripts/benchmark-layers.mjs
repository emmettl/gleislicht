import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const url = process.argv.find(value => /^https?:\/\//.test(value)) ?? 'http://127.0.0.1:4193/'
const cpuRate = Number(process.env.CPU_RATE ?? 4)
const cpuWarmupMs = Number(process.env.CPU_WARMUP_MS ?? 1500)
const frames = 180
const studies = (process.env.STUDIES ?? 'CH,24H,PA,ZH,ZVV,GE,comparison,hub,station,journey').split(',')
const browser = await chromium.launch({ args: process.argv.includes('--metal') ? ['--use-angle=metal', '--enable-gpu'] : [] })
try {
  if (process.env.PROFILE_DIR) await mkdir(process.env.PROFILE_DIR, { recursive: true })
  for (const study of studies) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(url)
    await page.waitForSelector('.scene canvas')
    if (study === 'hub' || study === 'station') {
      await page.getByRole('button', { name: 'Takt hubs', exact: true }).click()
      if (study === 'station') await page.locator('.hub-study-picker button').nth(1).click()
    } else if (study === 'journey') {
      await page.locator('.train-search input[type="search"]').fill('2355')
      await page.locator('.search-results button').filter({ hasText: '2355' }).click()
      await page.getByRole('button', { name: /Descend into real terrain/i }).click()
      await page.waitForSelector('.prototype-note')
    } else if (study !== 'CH') {
      await page.locator('.network-study-picker button').filter({ hasText: new RegExp(`^${study === 'comparison' ? '↔' : study}$`) }).click()
    }
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.scene canvas')
    await page.waitForTimeout(1500)
    const client = await page.context().newCDPSession(page)
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuRate })
    await page.waitForTimeout(cpuWarmupMs)
    await client.send('Performance.enable')
    await client.send('Profiler.enable')
    await client.send('Profiler.start')
    const before = await client.send('Performance.getMetrics')
    const timing = await page.evaluate(frames => new Promise(resolve => {
      const intervals = []
      let previous
      function frame(now) {
        if (previous !== undefined) intervals.push(now - previous)
        previous = now
        if (intervals.length < frames) requestAnimationFrame(frame)
        else {
          const gl = document.querySelector('.scene canvas').getContext('webgl2')
          const info = gl.getExtension('WEBGL_debug_renderer_info')
          resolve({
            renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unavailable',
            fps: 1000 * frames / intervals.reduce((a, b) => a + b, 0),
            p95FrameMs: intervals.sort((a, b) => a - b)[Math.floor(frames * 0.95)],
          })
        }
      }
      requestAnimationFrame(frame)
    }), frames)
    const after = await client.send('Performance.getMetrics')
    const { profile } = await client.send('Profiler.stop')
    if (process.env.PROFILE_DIR) await writeFile(`${process.env.PROFILE_DIR}/${study}.cpuprofile`, JSON.stringify(profile))
    const totals = new Map()
    for (const node of profile.nodes) {
      const frame = node.callFrame
      const name = `${frame.functionName || '(anonymous)'} ${frame.url.split('/').at(-1)?.split('?')[0]}:${frame.lineNumber + 1}`
      totals.set(name, (totals.get(name) ?? 0) + (node.hitCount ?? 0))
    }
    const metric = (set, key) => set.metrics.find(metric => metric.name === key)?.value ?? 0
    console.log(JSON.stringify({ study, url, cpuRate, cpuWarmupMs, ...timing,
      scriptMsPerFrame: 1000 * (metric(after, 'ScriptDuration') - metric(before, 'ScriptDuration')) / frames,
      errors, topSamples: [...totals].sort((a, b) => b[1] - a[1]).slice(0, 12),
    }))
    await page.close()
  }
} finally {
  await browser.close()
}
