import { describe, expect, it, vi } from 'vitest'
import { SWITZERLAND_EDITION } from './switzerland.ts'
import { resolveEdition } from './index.ts'
import { GLEISLICHT_STUDY, motionStudyMark } from './catalogue.ts'
import { SERVICE_CATEGORIES } from '@motionstudies/core/theme'
import { applyVisualTheme } from '@motionstudies/web/visual-theme'

describe('Gleislicht edition', () => {
  it('keeps the Swiss dataset catalogue outside the application shell', () => {
    expect(SWITZERLAND_EDITION.id).toBe('switzerland')
    expect(SWITZERLAND_EDITION.identity).toBe(GLEISLICHT_STUDY)
    expect(SWITZERLAND_EDITION.data.nationalMorning).toBe(
      'swiss-rail-morning.json',
    )
    expect(Object.keys(SWITZERLAND_EDITION.data.regional)).toEqual([
      'gornergrat',
      'jungfrau',
      'rigi-lake',
      'zurich-city',
      'zvv-region',
      'ticino-region',
      'graubuenden-region',
      'valais-region',
      'solothurn-region',
      'bern-region',
      'nyon-region',
      'basel-core',
      'lausanne-region',
      'geneva-tpg',
    ])
    expect(Object.values(SWITZERLAND_EDITION.data.corridors)).toHaveLength(4)
  })

  it('resolves only the Swiss edition', () => {
    expect(resolveEdition()).toBe(SWITZERLAND_EDITION)
    expect(resolveEdition('switzerland')).toBe(SWITZERLAND_EDITION)
    for (const foreign of ['london', 'paris', 'new-york', 'unknown']) {
      expect(() => resolveEdition(foreign)).toThrow('Unknown Gleislicht edition')
    }
    expect(motionStudyMark(GLEISLICHT_STUDY)).toBe('MOTION STUDIES · 005')
  })

  it('exposes the complete shared transport visual language', () => {
    expect(SERVICE_CATEGORIES.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['intercity', 'metro', 'tram', 'bus', 'ferry']),
    )
  })

  it('applies edition theme tokens without coupling them to the DOM bootstrap', () => {
    const setProperty = vi.fn()
    applyVisualTheme(SWITZERLAND_EDITION.theme, {
      style: { setProperty },
    } as unknown as HTMLElement)

    expect(setProperty).toHaveBeenCalledWith('--cyan', '#8dfaff')
    expect(setProperty).toHaveBeenCalledWith('--air', '#ff5edb')
    expect(setProperty).toHaveBeenCalledWith('--road-heavy', '#ff9d52')
  })
})
