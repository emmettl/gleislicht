import { describe, expect, it } from 'vitest'
import {
  categoryIsVisibleInAutoMode,
  compareTrainLabelCandidates,
  trainLabelBudget,
  trainLabelPriority,
  trainLabelScreenHeight,
  trainLabelScreenWidth,
} from './train-labels.ts'

describe('train labels', () => {
  it('keeps automatic labels sparse until the camera approaches', () => {
    expect(trainLabelBudget(37, 'auto')).toBe(8)
    expect(trainLabelBudget(25, 'auto')).toBe(16)
    expect(trainLabelBudget(14, 'auto')).toBe(32)
    expect(trainLabelBudget(14, 'off')).toBe(0)
  })

  it('lets the explicit on mode reveal a denser layer', () => {
    expect(trainLabelBudget(37, 'on')).toBe(18)
    expect(trainLabelBudget(14, 'on')).toBe(56)
  })

  it('prioritises long-distance services in automatic overview', () => {
    expect(categoryIsVisibleInAutoMode('international', 37)).toBe(true)
    expect(categoryIsVisibleInAutoMode('intercity', 37)).toBe(true)
    expect(categoryIsVisibleInAutoMode('s-bahn', 37)).toBe(false)
    expect(categoryIsVisibleInAutoMode('s-bahn', 14)).toBe(true)
    expect(trainLabelPriority('intercity')).toBeLessThan(
      trainLabelPriority('regional'),
    )
  })

  it('retains visible labels before choosing deterministic replacements', () => {
    const candidates = [
      { id: 'train-20', category: 's-bahn', retained: false },
      { id: 'train-10', category: 's-bahn', retained: false },
      { id: 'train-30', category: 's-bahn', retained: true },
    ] as const

    expect([...candidates].sort(compareTrainLabelCandidates).map(({ id }) => id)).toEqual([
      'train-30',
      'train-10',
      'train-20',
    ])
  })

  it('keeps iPhone train labels at a readable screen size', () => {
    expect(trainLabelScreenHeight(390, false)).toBe(44)
    expect(trainLabelScreenHeight(390, true)).toBe(52)
    expect(trainLabelScreenHeight(1024, false)).toBe(38)
    expect(trainLabelScreenWidth('IC1 · 710', 44)).toBeGreaterThanOrEqual(120)
  })
})
