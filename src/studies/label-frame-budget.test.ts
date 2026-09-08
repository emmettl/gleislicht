import { PerspectiveCamera } from 'three'
import { expect, it } from 'vitest'
import { LabelFrameBudget } from './label-frame-budget'

it('refreshes candidates at 10 Hz while moving visible labels every frame', () => {
  const budget = new LabelFrameBudget(), camera = new PerspectiveCamera(), key = {}
  const work = Array.from({ length: 61 }, (_, i) => budget.update(key, camera, 1280, 720, 100 + i, 1 / 60, true, 60))
  expect(work[0]).toBe('all')
  expect(work.filter(value => value === 'all').length).toBeGreaterThanOrEqual(9)
  expect(work.filter(value => value === 'all').length).toBeLessThanOrEqual(11)
  expect(work).not.toContain('idle')
})

it('refreshes immediately for camera, viewport, selection and clock changes', () => {
  const budget = new LabelFrameBudget(), camera = new PerspectiveCamera()
  let key = {}, time = 100
  const tick = () => budget.update(key, camera, 1280, 720, time++, 1 / 60, true, 60)
  expect(tick()).toBe('all')
  expect(tick()).toBe('visible')
  camera.position.x = 1; camera.updateMatrixWorld()
  expect(tick()).toBe('all')
  camera.fov = 30; camera.updateProjectionMatrix()
  expect(tick()).toBe('all')
  key = {}; expect(tick()).toBe('all')
  time = 50; expect(tick()).toBe('all')
  time = 500; expect(tick()).toBe('all')
  expect(budget.update(key, camera, 800, 600, time++, 1 / 60, true, 60)).toBe('all')
})

it('does no label work while paused, but responds to seeks and camera movement', () => {
  const budget = new LabelFrameBudget(), camera = new PerspectiveCamera(), key = {}
  const tick = (time = 100) => budget.update(key, camera, 1280, 720, time, 1 / 60, false, 60)
  expect(tick()).toBe('all')
  for (let i = 0; i < 60; i++) expect(tick()).toBe('idle')
  expect(tick(100.01)).toBe('all')
  camera.position.y = 3; camera.updateMatrixWorld()
  expect(tick(100.01)).toBe('all')
  expect(tick(100.01)).toBe('idle')
})
