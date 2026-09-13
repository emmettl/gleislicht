/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { RootState } from '@react-three/fiber'
import type * as THREE from 'three'
import type { StationIndexEntry } from '@motionstudies/core/domain/network'

// Read the renderer's public R3F root in the development test server. No
// production debug endpoint or duplicate train-position calculation is needed.
async function renderedTarget(page: Page, kind: 'station' | 'train', touch: boolean) {
  return page.evaluate(async ({ kind, touch }) => {
    const fiberUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/@react-three_fiber.js'))?.name
    if (!fiberUrl) return
    const { _roots } = await import(fiberUrl)
    const root = [..._roots.values()][0]
    if (!root) return
    const { scene, camera, gl } = root.store.getState() as RootState
    const moduleUrl = '/src/studies/map-selection.ts'
    const { pickMapTarget } = await import(moduleUrl) as typeof import('../src/studies/map-selection.ts')
    const metadataUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('scene-picking'))?.name
    if (!metadataUrl) return
    const { scenePickMetadata } = await import(metadataUrl) as typeof import('@motionstudies/three/scene-picking')
    const rect = gl.domElement.getBoundingClientRect()
    const stations = new Map<number, StationIndexEntry>()
    scene.traverseVisible(object => {
      const target = scenePickMetadata(object)?.target
      if (target?.kind === 'station') for (const index of target.value.stopIndexes) stations.set(index, target.value)
    })
    const candidates: { x: number; y: number; text: string }[] = []
    const add = (position: THREE.Vector3, text: string) => {
      position.project(camera)
      if (position.z < -1 || position.z > 1) return
      // Validate the integer coordinates that Playwright actually taps.
      const x = Math.round(rect.left + (position.x * 0.5 + 0.5) * rect.width)
      const y = Math.round(rect.top + (0.5 - position.y * 0.5) * rect.height)
      if (document.elementFromPoint(x, y) !== gl.domElement) return
      const hit = pickMapTarget(scene, camera, rect, x, y, touch, stations)
      const hitText = hit?.kind === 'station' ? hit.value.name
        : hit?.kind === 'train' ? `${hit.value.route} ${hit.value.shortName} → ${hit.value.headsign}` : undefined
      if (hit?.kind === kind && text === hitText) candidates.push({ x, y, text })
    }
    scene.traverseVisible(object => {
      const sprite = object as THREE.Sprite
      const target = scenePickMetadata(sprite)?.target
      if (kind === 'station' && sprite.isSprite && target?.kind === 'station') {
        const position = sprite.position.clone()
        const right = position.clone().set(1, 0, 0).applyQuaternion(camera.quaternion)
        position.addScaledVector(right, sprite.scale.x * (0.5 - sprite.center.x))
        add(position, target.value.name)
      }
      const points = object as THREE.Points
      const trains = points.isPoints ? scenePickMetadata(points.geometry)?.trains : undefined
      if (kind === 'train' && trains) {
        for (let index = 0; index < points.geometry.drawRange.count; index++) {
          const train = trains[index]
          if (!train) continue
          const position = points.position.clone().fromBufferAttribute(points.geometry.getAttribute('position'), index).applyMatrix4(points.matrixWorld)
          add(position, `${train.route} ${train.shortName} → ${train.headsign}`)
        }
      }
    })
    const target = candidates[0]
    return target && { ...target, camera: camera.matrixWorld.elements.map(value => value.toFixed(5)).join(',') }
  }, { kind, touch })
}

for (const kind of ['station', 'train'] as const) {
  test(`map ${kind} selection follows the visible ${kind === 'station' ? 'label' : 'marker'}`, async ({ page, isMobile }) => {
    await page.goto('/')
    await expect(page.locator('.scene canvas')).toBeVisible()
    // Freeze train positions for an exact marker hit; leave station selection
    // playing to exercise callbacks changing while a pointer is held down.
    if (kind === 'train') await page.getByRole('button', { name: /Pause motion/i }).click()
    let target: Awaited<ReturnType<typeof renderedTarget>>
    let previousCamera = ''
    // A visible label can precede the opening camera transition finishing.
    // Keep playback active, but wait for stable screen coordinates before tapping.
    await expect.poll(async () => {
      target = await renderedTarget(page, kind, isMobile)
      const settled = Boolean(target && target.camera === previousCamera)
      previousCamera = target?.camera ?? ''
      return settled
    }).toBe(true)
    if (isMobile) await page.touchscreen.tap(target!.x, target!.y)
    else {
      await page.mouse.move(target!.x, target!.y)
      await page.mouse.down()
      if (kind === 'station') await page.waitForTimeout(350)
      await page.mouse.up()
    }
    await expect(page.locator('.train-search input[type=search]')).toHaveValue(target!.text)
  })
}
