import { describe, expect, it } from 'vitest'
import {
  categoryIsVisibleInAutoMode,
  compareTrainLabelCandidates,
  nonRailCategorySuppressesTrainLabels,
  trainLabelArrivalOpacity,
  trainLabelBudget,
  trainLabelIdentity,
  trainLabelPriority,
  trainLabelScreenHeight,
  trainLabelScreenWidth,
} from './train-labels.ts'

describe('train labels', () => {
  it('does not repeat a line name supplied as both route and service identity', () => {
    expect(trainLabelIdentity('Jubilee', 'Jubilee')).toBe('Jubilee')
    expect(trainLabelIdentity('Elizabeth line', ' elizabeth line ')).toBe(
      'Elizabeth line',
    )
  })

  it('keeps genuinely distinct route and service identities', () => {
    expect(trainLabelIdentity('IC', '1')).toBe('IC · 1')
    expect(trainLabelIdentity('S', '')).toBe('S')
  })

  it('suppresses rail labels while a non-rail category is isolated', () => {
    expect(nonRailCategorySuppressesTrainLabels()).toBe(false)
    expect(nonRailCategorySuppressesTrainLabels(true, false)).toBe(true)
    expect(nonRailCategorySuppressesTrainLabels(false, true)).toBe(true)
  })

  it('gives arriving labels a playback-rate-independent afterglow', () => {
    expect(trainLabelArrivalOpacity(1_000, 1_000, 1)).toBe(1)
    expect(trainLabelArrivalOpacity(1_000.8, 1_000, 1)).toBeCloseTo(0.5)
    expect(trainLabelArrivalOpacity(1_003.2, 1_000, 4)).toBeCloseTo(0.5)
    expect(trainLabelArrivalOpacity(1_102.4, 1_000, 64)).toBe(0)
  })

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

  it('keeps iPhone overview labels restrained and close labels readable', () => {
    expect(trainLabelScreenHeight(390, false, 37)).toBe(24)
    expect(trainLabelScreenHeight(390, true, 37)).toBe(32)
    expect(trainLabelScreenHeight(390, false, 24)).toBe(34)
    expect(trainLabelScreenHeight(390, false, 14)).toBe(44)
    expect(trainLabelScreenHeight(390, true, 14)).toBe(52)
    expect(trainLabelScreenHeight(1024, false, 37)).toBe(38)
    expect(trainLabelScreenWidth('IC1 · 710', 24)).toBeGreaterThanOrEqual(68)
  })
})
