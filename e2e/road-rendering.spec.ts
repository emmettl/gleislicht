/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { RootState } from '@react-three/fiber'
import type * as THREE from 'three'

async function renderedRoads(page: Page) {
  return page.evaluate(async () => {
    const fiberUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/@react-three_fiber.js'))?.name
    if (!fiberUrl) return
    const { _roots } = await import(fiberUrl)
    const root = [..._roots.values()][0]
    if (!root) return
    const { scene, camera } = root.store.getState() as RootState
    const group = scene.getObjectByName('motorway-labels')
    if (!group) return
    const lines: { vertices: number; opacity: number; depthTest: boolean }[] = []
    scene.traverseVisible(object => {
      const line = object as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
      if (line.isLineSegments && line.material.color.getHexString() === 'a0a6b2') {
        lines.push({ vertices: line.geometry.getAttribute('position').count, opacity: line.material.opacity, depthTest: line.material.depthTest })
      }
    })
    return {
      lines,
      camera: camera.matrixWorld.toArray(),
      anchors: (group.userData.anchors as { id: string; position: THREE.Vector3 }[]).map(anchor => ({ id: anchor.id, position: anchor.position.toArray() })),
      attached: group.children.map(sprite => ({ id: sprite.name, position: sprite.position.toArray(), visible: sprite.visible })),
      visible: group.children.filter(sprite => sprite.visible).map(sprite => sprite.name),
    }
  })
}

test('motorway geometry and fixed labels survive empty traffic and road selection', async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/data/swiss-road-morning.json', async route => {
    const response = await route.fetch()
    const snapshot = await response.json()
    await route.fulfill({ json: { ...snapshot, corridors: [] } })
  })
  await page.route('**/data/swiss-road-national-manifest.json', route => route.fulfill({ status: 404, body: '' }))
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await page.locator(isMobile ? '.mobile-road-toggle' : '.network-study-picker .road-toggle').click()
  await expect(page.locator('.network-card .road-count')).toHaveAttribute('aria-label', /^0 estimated road vehicles/)
  await expect.poll(async () => (await renderedRoads(page))?.visible.length ?? 0).toBeGreaterThan(0)
  const overview = (await renderedRoads(page))!
  expect(overview.attached.length).toBeLessThan(overview.anchors.length)
  for (const sprite of overview.attached) {
    expect(sprite.visible).toBe(true)
    expect(sprite.position).toEqual(overview.anchors.find(anchor => anchor.id === sprite.id)?.position)
  }
  expect(overview.lines).toHaveLength(2)
  for (const line of overview.lines) {
    expect(line.vertices).toBeGreaterThan(0)
    expect(line.opacity).toBeGreaterThanOrEqual(0.2)
    expect(line.depthTest).toBe(false)
  }

  const search = page.locator('.train-search input[type="search"]')
  await search.fill('Gotthard')
  await page.locator('.search-results .road-result').first().click()
  await expect(page.locator('.road-corridor-card')).toContainText('A2')
  await expect.poll(async () => (await renderedRoads(page))?.lines.length).toBe(3)
  const selected = (await renderedRoads(page))!
  const original = new Map(overview.anchors.map(anchor => [anchor.id, anchor.position]))
  expect(selected.anchors).toHaveLength(overview.anchors.length)
  for (const anchor of selected.anchors) expect(anchor.position).toEqual(original.get(anchor.id))
  for (const sprite of selected.attached) {
    expect(sprite.visible).toBe(true)
    expect(sprite.position).toEqual(original.get(sprite.id))
  }
  for (const line of selected.lines) {
    expect(line.vertices).toBeGreaterThan(0)
    expect(line.opacity).toBeGreaterThanOrEqual(0.15)
    expect(line.depthTest).toBe(false)
  }
  // The road focus animates the camera; label world coordinates stay fixed.
  await expect.poll(async () => (await renderedRoads(page))?.camera).not.toEqual(overview.camera)
  await expect.poll(async () => (await renderedRoads(page))?.visible.length ?? 0).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath('empty-traffic-roads.png') })
  expect(errors).toEqual([])
})

test('click a motorway badge or road line and explore its traffic history', async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.scene canvas')).toBeVisible()
  await page.locator(isMobile ? '.mobile-road-toggle' : '.network-study-picker .road-toggle').click()
  await expect.poll(async () => (await renderedRoads(page))?.visible.length ?? 0).toBeGreaterThan(0)
  let previousCamera = ''
  await expect.poll(async () => {
    const camera = (await renderedRoads(page))?.camera.map(value => value.toFixed(5)).join(',') ?? ''
    const settled = Boolean(camera && camera === previousCamera)
    previousCamera = camera
    return settled
  }).toBe(true)
  const target = await page.evaluate(async () => {
    const fiberUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/@react-three_fiber.js'))!.name
    const { _roots } = await import(fiberUrl)
    const { scene, camera, gl } = [..._roots.values()][0].store.getState() as RootState
    const rect = gl.domElement.getBoundingClientRect()
    const group = scene.getObjectByName('motorway-labels')!
    const moduleUrl = '/src/studies/map-selection.ts'
    const { pickMapTarget } = await import(moduleUrl)
    const candidates = group.children.filter(sprite => sprite.visible && sprite.userData.pickTarget?.value === 'N1')
    for (const sprite of candidates) {
      const p = sprite.position.clone().project(camera)
      const x = rect.left + (p.x * 0.5 + 0.5) * rect.width, y = rect.top + (0.5 - p.y * 0.5) * rect.height
      const hit = pickMapTarget(scene, camera, rect, Math.floor(x), Math.floor(y), true, new Map())
      if (document.elementFromPoint(x, y) === gl.domElement && hit?.kind === 'road' && hit.value === 'N1') return { x: Math.floor(x), y: Math.floor(y) }
    }
  })
  expect(target).toBeTruthy()
  if (isMobile) await page.touchscreen.tap(target!.x, target!.y)
  else await page.mouse.click(target!.x, target!.y)
  const card = page.locator('.road-corridor-card')
  await expect(card).toContainText('A1')
  await expect(card.locator('.road-history svg')).toBeVisible()
  await expect(card.locator('.road-history')).toContainText('Recorded peak')
  const slider = card.getByRole('slider', { name: 'Choose traffic time' })
  await slider.fill('27000')
  await expect(card.locator('.road-history time')).toHaveText('07:30')
  await expect(card.locator('.road-chart-current')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('road-traffic-history.png') })
  await slider.fill('31500')
  await expect(card.locator('.road-history time')).toHaveText('08:45')
  await page.getByRole('button', { name: /Resume motion/i }).click()
  await expect(card.locator('.road-history time')).not.toHaveText('08:45')
  await page.getByRole('button', { name: /Pause motion/i }).click()
  // Pick a line away from badges and overlays, then select it through a real pointer event.
  const lineTarget = await page.evaluate(async () => {
    const fiberUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/@react-three_fiber.js'))!.name
    const { _roots } = await import(fiberUrl)
    const { scene, camera, gl } = [..._roots.values()][0].store.getState() as RootState
    const rect = gl.domElement.getBoundingClientRect()
    let found: { x: number; y: number; road: string } | undefined
    scene.traverseVisible(object => {
      const line = object as THREE.LineSegments
      const roads = line.geometry?.userData.pickRoads as string[] | undefined
      if (found || !roads) return
      const positions = line.geometry.getAttribute('position')
      const point = camera.position.clone(), end = point.clone()
      for (let i = 0; i + 1 < positions.count; i += 2) {
        if (roads[i] === 'N1') continue
        point.fromBufferAttribute(positions, i).lerp(end.fromBufferAttribute(positions, i + 1), 0.5).applyMatrix4(line.matrixWorld).project(camera)
        const x = rect.left + (point.x * 0.5 + 0.5) * rect.width, y = rect.top + (0.5 - point.y * 0.5) * rect.height
        if (x < 15 || y < 15 || x > rect.right - 15 || y > rect.bottom - 15 || document.elementFromPoint(x, y) !== gl.domElement) continue
        // Avoid the screen rectangles occupied by visible badges.
        const badgeNear = scene.getObjectByName('motorway-labels')!.children.some(sprite => {
          if (!sprite.visible) return false
          const p = sprite.position.clone().project(camera)
          return Math.abs((p.x - point.x) * rect.width / 2) < 30 && Math.abs((p.y - point.y) * rect.height / 2) < 20
        })
        if (!badgeNear) { found = { x, y, road: roads[i].replace(/^N/, 'A') }; break }
      }
    })
    return found
  })
  expect(lineTarget).toBeTruthy()
  if (isMobile) await page.touchscreen.tap(lineTarget!.x, lineTarget!.y)
  else await page.mouse.click(lineTarget!.x, lineTarget!.y)
  await expect(card.locator('.service')).toHaveText(lineTarget!.road)
  expect(errors).toEqual([])
})
