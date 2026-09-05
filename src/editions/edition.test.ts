import { describe, expect, it, vi } from 'vitest'
import { SWITZERLAND_EDITION } from './switzerland.ts'
import { resolveEdition } from './index.ts'
import { applyVisualTheme, SERVICE_CATEGORIES } from '../theme/visual-language.ts'

describe('Gleislicht editions', () => {
  it('keeps the Swiss dataset catalogue outside the application shell', () => {
    expect(SWITZERLAND_EDITION.id).toBe('switzerland')
    expect(SWITZERLAND_EDITION.data.nationalMorning).toBe(
      'swiss-rail-morning.json',
    )
    expect(Object.keys(SWITZERLAND_EDITION.data.regional)).toEqual([
      'zurich-city',
      'zvv-region',
      'geneva-tpg',
    ])
    expect(Object.values(SWITZERLAND_EDITION.data.corridors)).toHaveLength(2)
  })

  it('resolves editions at the entry point and rejects configuration mistakes', () => {
    expect(resolveEdition()).toBe(SWITZERLAND_EDITION)
    expect(resolveEdition('switzerland')).toBe(SWITZERLAND_EDITION)
    expect(() => resolveEdition('london')).toThrow('Unknown Gleislicht edition')
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
