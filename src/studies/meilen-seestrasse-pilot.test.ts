import { expect, it } from 'vitest'
import source from '../../public/data/meilen-seestrasse-road-pilot.json'
import { validateCantonalPilot } from './validate-cantonal-pilot.ts'
import { cantonalPilotForRoad, cantonalPilotWindow, type CantonalPilot } from './cantonal-road-pilot.ts'
import { readStudyLink } from './explore.ts'
import { studyLinkUrl } from './share-link.ts'
const pilot = source as unknown as CantonalPilot

it('validates all 142 Meilen minutes and excludes observations outside its window', () => {
  expect(validateCantonalPilot(pilot)).toBe(pilot)
  expect(pilot.windows).toHaveLength(1)
  expect(pilot.windows[0].minutes).toHaveLength(142)
  expect(pilot.gaps).toEqual([])
  expect(cantonalPilotWindow(pilot, 59700)).toBe(pilot.windows[0])
  expect(cantonalPilotWindow(pilot, 59701)).toBeUndefined()
  expect(cantonalPilotWindow(pilot, 51239)).toBeUndefined()
  expect(pilot.topology.sections.map(s => s.distanceKm)).toEqual([2.90183, 2.90183])
})

it('keeps the two ZH 17 recording identities distinct when sharing and selecting', () => {
  const state = { study: 'national', range: 'morning', date: '2026-09-08', recording: 'meilen-seestrasse-2026-09-08', time: 59700 } as const
  expect(readStudyLink(new URL(studyLinkUrl('https://example.org', state)).search)).toEqual(state)
  expect(cantonalPilotForRoad('ZH:17')?.id).toBe('meilen-staefa-2026-09-08')
  expect(cantonalPilotForRoad('ZH:17', state.recording)?.id).toBe(state.recording)
  expect(() => validateCantonalPilot(pilot, cantonalPilotForRoad('ZH:17'))).toThrow()
})
