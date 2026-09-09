import { expect, test } from '@playwright/test'

test('trail worker returns geometry, follows seeks, and releases old study workers', async ({ page, isMobile }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    const state = { created: 0, terminated: 0, frames: 0, populated: 0, invalid: false, time: -1 }
    Object.assign(window, { trailWorkerTest: state })
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        state.created++
        this.addEventListener('message', event => {
          const frame = event.data.frame
          if (!frame) return
          state.frames++
          state.time = event.data.time
          if (frame.counts.some((count: number) => count > 0)) state.populated++
          for (let i = 0; i < frame.counts.length; i++) {
            if (!frame.positions[i].subarray(0, frame.counts[i] * 6).every(Number.isFinite)) state.invalid = true
          }
        })
      }
      terminate() { state.terminated++; super.terminate() }
    }
  })
  await page.goto('/')
  if (isMobile) {
    await page.locator('.mobile-study-picker button').first().click()
    await page.getByRole('option', { name: /PA/ }).click()
  } else await page.getByRole('button', { name: 'PostBus · all Switzerland · 24 hours', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Switzerland by PostBus')
  const stats = () => page.evaluate(() => (window as unknown as { trailWorkerTest: { frames: number; populated: number; invalid: boolean; terminated: number; time: number } }).trailWorkerTest)
  await expect.poll(async () => (await stats()).populated, { timeout: 45_000 }).toBeGreaterThan(1)
  await page.getByRole('button', { name: /Pause motion/i }).click()
  await page.locator('.scrubber input').fill('28000')
  await expect.poll(async () => (await stats()).time).toBe(28000)
  await page.locator('.scrubber input').fill('27900')
  await expect.poll(async () => (await stats()).time).toBe(27900)
  expect((await stats()).invalid).toBe(false)
  // A different projection must discard the previous worker and its geometry.
  const terminatedBefore = (await stats()).terminated
  if (isMobile) {
    await page.locator('.mobile-study-picker button').first().click()
    await page.getByRole('option', { name: /^CH/ }).click()
  } else await page.locator('.network-study-picker button').filter({ hasText: /^CH$/ }).click()
  await expect.poll(async () => (await stats()).terminated).toBeGreaterThan(terminatedBefore)
  expect(errors).toEqual([])
})
