/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import type { RootState } from '@react-three/fiber'
import type * as THREE from 'three'

test('aircraft stay pickable without rendering invisible hit spheres', async ({ page, isMobile }) => {
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await page.locator(isMobile ? '.mobile-sbb-toggle' : '.network-study-picker .sbb-toggle').click()
  await page.locator(isMobile ? '.mobile-air-toggle' : '.network-study-picker .air-toggle').click()
  await expect(page.locator(isMobile ? '.mobile-air-toggle' : '.network-study-picker .air-toggle')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Pause motion/i }).click()
  await expect.poll(async () => page.evaluate(async () => {
    const fiberUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/@react-three_fiber.js'))?.name
    if (!fiberUrl) return 0
    const { _roots } = await import(fiberUrl)
    return [..._roots.values()][0]?.store.getState().scene.getObjectByName('aircraft-hit-targets')?.count ?? 0
  })).toBeGreaterThan(0)
  const state = await page.evaluate(async () => {
    const fiberUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/@react-three_fiber.js'))!.name
    const { _roots } = await import(fiberUrl)
    const { scene, camera, gl, raycaster } = [..._roots.values()][0].store.getState() as RootState
    const hit = scene.getObjectByName('aircraft-hit-targets') as THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
    let draws = 0
    hit.onBeforeRender = () => { draws++ }
    const version = hit.instanceMatrix.version
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const rect = gl.domElement.getBoundingClientRect()
    let target: { x: number; y: number } | undefined
    for (let i = 0; i < hit.count; i++) {
      const matrix = hit.matrix.clone()
      hit.getMatrixAt(i, matrix)
      const point = camera.position.clone().setFromMatrixPosition(matrix).applyMatrix4(hit.matrixWorld).project(camera)
      if (point.z < -1 || point.z > 1) continue
      const x = Math.floor(rect.left + (point.x + 1) * rect.width / 2)
      const y = Math.floor(rect.top + (1 - point.y) * rect.height / 2)
      if (document.elementFromPoint(x, y) !== gl.domElement) continue
      raycaster.setFromCamera({ x: (x - rect.left) / rect.width * 2 - 1, y: 1 - (y - rect.top) / rect.height * 2 } as THREE.Vector2, camera)
      if (raycaster.intersectObject(hit, false).length) { target = { x, y }; break }
    }
    return { target, visible: hit.material.visible, draws, uploads: hit.instanceMatrix.version - version }
  })
  expect(state.visible).toBe(false)
  expect(state.draws).toBe(0)
  expect(state.uploads).toBe(0)
  expect(state.target).toBeTruthy()
  if (isMobile) await page.touchscreen.tap(state.target!.x, state.target!.y)
  else await page.mouse.click(state.target!.x, state.target!.y)
  await expect(page.locator('.air-card')).toBeVisible()
})
