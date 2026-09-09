import { expect, it } from 'vitest'
import { OrbitalResolutionBudget, OrbitalShadowBudget } from './orbital-performance.ts'

it('backs off resolution under sustained load and restores it conservatively', () => {
  const budget = new OrbitalResolutionBudget()
  let dpr = 1.5
  const frames = (count: number, delta: number) => {
    for (let i = 0; i < count; i++) dpr = budget.sample(delta, dpr, 1.5)
  }
  frames(120, 1 / 60)
  expect(dpr).toBe(1.5)
  frames(1, 0.1)
  expect(dpr).toBe(1.5)
  frames(100, 1 / 30)
  expect(dpr).toBe(1.25)
  frames(600, 1 / 30)
  expect(dpr).toBe(0.75)
  frames(500, 1 / 60)
  expect(dpr).toBe(0.75)
  frames(160, 1 / 60)
  expect(dpr).toBe(1)
  frames(1800, 1 / 60)
  expect(dpr).toBe(1.5)
})

it('ignores isolated stalls and never exceeds the display resolution', () => {
  const budget = new OrbitalResolutionBudget()
  for (const delta of [NaN, Infinity, -1, 0, 1, 10]) expect(budget.sample(delta, 1, 1)).toBe(1)
  for (let i = 0; i < 1200; i++) expect(budget.sample(1 / 60, 1, 1)).toBe(1)
})

it('reuses terrain shadows while paused, follows seeks and invalidates at sunrise or terrain changes', () => {
  const budget = new OrbitalShadowBudget(), standard = {}, fine = {}
  expect(budget.shouldUpdate(27900, standard, true)).toBe(true)
  for (let i = 0; i < 120; i++) expect(budget.shouldUpdate(27900, standard, true)).toBe(false)
  expect(budget.shouldUpdate(27929, standard, true)).toBe(false)
  expect(budget.shouldUpdate(27930, standard, true)).toBe(true)
  expect(budget.shouldUpdate(27930, fine, true)).toBe(true)
  expect(budget.shouldUpdate(27000, fine, true)).toBe(true)
  expect(budget.shouldUpdate(0, fine, false)).toBe(false)
  expect(budget.shouldUpdate(27000, fine, true)).toBe(true)
})

it('still adapts when rendering falls below four frames per second', () => {
  const budget = new OrbitalResolutionBudget()
  let dpr = 1.5
  for (let i = 0; i < 12; i++) dpr = budget.sample(1 / 3, dpr, 1.5)
  expect(dpr).toBeLessThan(1.5)
})
