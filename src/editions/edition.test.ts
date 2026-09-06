import { describe, expect, it, vi } from 'vitest'
import { SWITZERLAND_EDITION } from './switzerland.ts'
import { LONDON_EDITION } from './london.ts'
import { NEW_YORK_EDITION } from './new-york.ts'
import { PARIS_EDITION } from './paris.ts'
import { resolveEdition } from './index.ts'
import {
  ALL_CHANGE_STUDY,
  CORRESPONDANCES_STUDY,
  GLEISLICHT_STUDY,
  LOCAL_EXPRESS_STUDY,
  MOTION_STUDIES_CATALOGUE,
  motionStudyMark,
} from './catalogue.ts'
import { applyVisualTheme, SERVICE_CATEGORIES } from '../theme/visual-language.ts'

describe('Motion Studies editions', () => {
  it('keeps the Swiss dataset catalogue outside the application shell', () => {
    expect(SWITZERLAND_EDITION.id).toBe('switzerland')
    expect(SWITZERLAND_EDITION.identity).toBe(GLEISLICHT_STUDY)
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
    expect(resolveEdition('london')).toBe(LONDON_EDITION)
    expect(resolveEdition('new-york')).toBe(NEW_YORK_EDITION)
    expect(resolveEdition('paris')).toBe(PARIS_EDITION)
    expect(() => resolveEdition('unknown')).toThrow('Unknown Motion Studies edition')
  })

  it('gives every work its own identity inside the shared catalogue', () => {
    expect(GLEISLICHT_STUDY).toMatchObject({
      catalogueNumber: '005',
      title: 'Gleislicht',
      placeName: 'Switzerland',
      status: 'released',
    })
    expect(ALL_CHANGE_STUDY).toMatchObject({
      catalogueNumber: '006',
      title: 'All Change',
      descriptor: 'A London motion study',
      status: 'foundation',
    })
    expect(LOCAL_EXPRESS_STUDY).toMatchObject({
      catalogueNumber: '007',
      title: 'Local / Express',
      placeName: 'New York',
      status: 'foundation',
    })
    expect(CORRESPONDANCES_STUDY).toMatchObject({
      catalogueNumber: '008',
      title: 'Correspondances',
      placeName: 'Paris',
      status: 'foundation',
    })
    expect(
      new Set(MOTION_STUDIES_CATALOGUE.map(({ catalogueNumber }) => catalogueNumber))
        .size,
    ).toBe(MOTION_STUDIES_CATALOGUE.length)
    expect(motionStudyMark(GLEISLICHT_STUDY)).toBe('MOTION STUDIES · 005')
  })

  it('keeps alternate spatial layouts edition-owned and lazy', () => {
    expect(LONDON_EDITION.data.opening.network).toBe(
      'all-change-rail-led-morning.json',
    )
    expect(LONDON_EDITION.data.opening.dayManifest).toBe(
      'all-change-day-manifest.json',
    )
    expect(LONDON_EDITION.data.opening.layouts).toEqual([
      { id: 'geographic', label: 'Geography', kind: 'geographic' },
      {
        id: 'diagram',
        label: 'Diagram',
        kind: 'topological',
        artifact: 'all-change-diagram.json',
      },
    ])
    expect(LONDON_EDITION.data.opening.layouts[1].artifact).toBe(
      'all-change-diagram.json',
    )
    expect(NEW_YORK_EDITION.data.opening.layouts[1]).toMatchObject({
      id: 'diagram',
      kind: 'topological',
      artifact: 'local-express-diagram.json',
    })
    expect(NEW_YORK_EDITION.data.opening.dayManifest).toBe(
      'local-express-day-manifest.json',
    )
    expect(PARIS_EDITION.data.opening.network).toBe(
      'correspondances-morning.json',
    )
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
