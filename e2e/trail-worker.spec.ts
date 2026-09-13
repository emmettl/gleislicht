import { expect, test } from '@playwright/test'

test('trail worker returns geometry, follows seeks, and releases old study workers', async ({ page, isMobile }) => {
  test.setTimeout(120_000)
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
  await page.locator(isMobile ? '.mobile-postbus-toggle' : '.postbus-toggle').click()
  await expect(page.locator('.experience')).toHaveAttribute('data-postbus-enabled', 'true')
  const stats = () => page.evaluate(() => (window as unknown as { trailWorkerTest: { frames: number; populated: number; invalid: boolean; terminated: number; time: number } }).trailWorkerTest)
  // Keep the dataset and time fixed while the full bus geometry initializes.
  // Continuous playback on software WebGL can cross chunks and reset the worker.
  await page.getByRole('button', { name: /Pause motion/i }).click()
  await expect.poll(async () => (await stats()).populated, { timeout: 60_000 }).toBeGreaterThan(0)
  const populatedBeforeSeek = (await stats()).populated
  await page.locator('.scrubber input').fill('28000')
  await expect.poll(async () => (await stats()).time).toBe(28000)
  expect((await stats()).populated).toBeGreaterThan(populatedBeforeSeek)
  await page.locator('.scrubber input').fill('27900')
  await expect.poll(async () => (await stats()).time).toBe(27900)
  expect((await stats()).invalid).toBe(false)
  // Removing bus geometry must discard the previous worker and its geometry.
  const terminatedBefore = (await stats()).terminated
  await page.locator(isMobile ? '.mobile-postbus-toggle' : '.postbus-toggle').click()
  await expect(page.locator('.experience')).toHaveAttribute('data-postbus-enabled', 'false')
  await expect.poll(async () => (await stats()).terminated).toBeGreaterThan(terminatedBefore)
  expect(errors).toEqual([])
})
