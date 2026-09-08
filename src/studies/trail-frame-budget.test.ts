import { expect, it } from 'vitest'
import { TrailFrameBudget } from './trail-frame-budget'

it('keeps full trail detail on smooth frames and reduces work under sustained load', () => {
  const budget = new TrailFrameBudget()
  for (let i = 0; i < 120; i++) expect(budget.interval(1 / 60)).toBe(1 / 30)
  expect(budget.interval(1 / 30)).toBe(1 / 30)
  for (let i = 0; i < 30; i++) budget.interval(1 / 30)
  expect(budget.interval(1 / 30)).toBe(1 / 15)
})

it('uses hysteresis to avoid oscillation and restores detail after sustained recovery', () => {
  const budget = new TrailFrameBudget()
  for (let i = 0; i < 30; i++) budget.interval(1 / 25)
  for (let i = 0; i < 180; i++) expect(budget.interval(1 / 45)).toBe(1 / 15)
  for (let i = 0; i < 120; i++) expect(budget.interval(1 / 60)).toBe(1 / 15)
  for (let i = 0; i < 150; i++) budget.interval(1 / 60)
  expect(budget.interval(1 / 60)).toBe(1 / 30)
})

it('ignores invalid deltas and isolated background-tab gaps', () => {
  const budget = new TrailFrameBudget()
  for (const delta of [NaN, Infinity, -1, 0, 2, 60]) expect(budget.interval(delta)).toBe(1 / 30)
})
