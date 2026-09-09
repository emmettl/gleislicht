import { expect, test, type Page } from '@playwright/test'
import type { RootState } from '@react-three/fiber'
import type * as THREE from 'three'

async function sample(page: Page) {
  return page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').find(entry => entry.name.includes('/@react-three_fiber.js'))?.name
    if (!url) return null
    const { _roots } = await import(url)
    const root = [..._roots.values()][0]
    if (!root) return null
    const { scene, gl, viewport } = root.store.getState() as RootState
    const buffers: { kind: string; version: number; count: number; bytes: number }[] = []
    const seen = new Set<string>()
    let shadowPasses = 0
    scene.traverse(object => {
      if (object.castShadow) {
        if (object.userData.shadowPasses === undefined) {
          object.userData.shadowPasses = 0
          object.onAfterShadow = () => { object.userData.shadowPasses++ }
        }
        shadowPasses += object.userData.shadowPasses
      }
      const mesh = object as THREE.Points | THREE.LineSegments
      if (!(('isPoints' in mesh && mesh.isPoints) || ('isLineSegments' in mesh && mesh.isLineSegments)) || !mesh.geometry.hasAttribute('color') || seen.has(mesh.geometry.uuid)) return
      seen.add(mesh.geometry.uuid)
      const attribute = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      buffers.push({ kind: 'isPoints' in mesh ? 'points' : 'trails', version: attribute.version, count: mesh.geometry.drawRange.count, bytes: attribute.array.byteLength })
    })
    return { buffers, dpr: viewport.dpr, triangles: gl.info.render.triangles, shadowPasses }
  })
}

test('orbital buffers reuse paused work and update after seeking', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/?view=orbital')
  await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeEnabled({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
  await page.locator('.orbital-timeline input').fill('27900')
  await expect.poll(async () => (await sample(page))?.buffers.find(b => b.kind === 'points')?.count ?? 0).toBeGreaterThan(0)
  await page.waitForTimeout(1500)
  const before = await sample(page)
  await page.waitForTimeout(1000)
  const after = await sample(page)
  console.log('Orbital paused:', JSON.stringify({ before, after }))
  expect(after?.buffers).toEqual(before?.buffers)
  expect(after?.shadowPasses).toBe(before?.shadowPasses)
  await page.locator('.orbital-timeline input').fill('28020')
  await expect.poll(async () => (await sample(page))?.buffers).not.toEqual(after?.buffers)
  await expect.poll(async () => (await sample(page))?.shadowPasses ?? 0).toBeGreaterThan(after?.shadowPasses ?? 0)
  await page.getByRole('button', { name: 'Play playback', exact: true }).click()
  const playingBefore = await sample(page)
  await page.waitForTimeout(2000)
  const playingAfter = await sample(page)
  const updates = (kind: string) => playingAfter!.buffers.find(b => b.kind === kind)!.version - playingBefore!.buffers.find(b => b.kind === kind)!.version
  console.log('Orbital playing updates:', { points: updates('points'), trails: updates('trails') })
  expect(updates('points')).toBeGreaterThan(updates('trails'))
  expect(updates('trails')).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
  const controls = page.getByRole('button', { name: 'Controls', exact: true })
  if (await controls.isVisible()) await controls.click()
  await page.getByRole('slider', { name: 'Trail duration', exact: true }).fill('0')
  await expect.poll(async () => (await sample(page))?.buffers.find(b => b.kind === 'trails')?.count).toBe(0)
  expect(errors).toEqual([])
})
