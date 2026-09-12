import { chromium } from '@playwright/test'

// Run against the retained local dev/preview server. Prints the actual GPU so
// headless software results cannot be confused with device performance.
const url = process.argv.find(value => /^https?:\/\//.test(value)) ?? 'http://127.0.0.1:4180/'
const browser = await chromium.launch({
  args: process.argv.includes('--metal') ? ['--use-angle=metal', '--enable-gpu'] : [],
})
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const client = await page.context().newCDPSession(page)
  await client.send('Performance.enable')
  await page.goto(url)
  await page.waitForSelector('.scene canvas')
  async function sample(study) {
    const before = await client.send('Performance.getMetrics')
    const timing = await page.evaluate(() => new Promise(resolve => {
      const intervals = []
      let previous = performance.now()
      function frame(now) {
        intervals.push(now - previous)
        previous = now
        if (intervals.length < 180) requestAnimationFrame(frame)
        else resolve({
          fps: 180000 / intervals.reduce((a, b) => a + b, 0),
          p95FrameMs: intervals.sort((a, b) => a - b)[171],
        })
      }
      requestAnimationFrame(frame)
    }))
    const after = await client.send('Performance.getMetrics')
    const metric = (set, key) => set.metrics.find(metric => metric.name === key)?.value ?? 0
    const renderer = await page.evaluate(() => {
      const gl = document.querySelector('.scene canvas').getContext('webgl2')
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unavailable'
    })
    return { study, renderer, ...timing,
      heapBytes: metric(after, 'JSHeapUsedSize'),
      scriptSeconds: metric(after, 'ScriptDuration') - metric(before, 'ScriptDuration'),
    }
  }
  const rail = await sample('rail')
  const started = performance.now()
  await page.locator('.sbb-toggle').click()
  await page.locator('.postbus-toggle').click()
  await page.waitForFunction(() => document.querySelector('.network-card .between')?.textContent.includes('Scheduled PostBus'))
  const loadMs = performance.now() - started
  const postbus = await sample('postbus')
  console.log(JSON.stringify({ url, viewport: '1280×720', rail, postbus: { ...postbus, loadMs } }, null, 2))
} finally {
  await browser.close()
}
