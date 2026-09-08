import { expect, it } from 'vitest'
import source from '../../public/data/bauma-wila-road-pilot.json'
import { validateCantonalPilot } from './validate-cantonal-pilot.ts'
import { cantonalPilotForRoad, cantonalPilotWindow, type CantonalPilot } from './cantonal-road-pilot.ts'
import { readStudyLink } from './explore.ts'
import { studyLinkUrl } from './share-link.ts'
const pilot = source as unknown as CantonalPilot

it('validates the complete Bauma–Wila window and both directions', () => {
  expect(validateCantonalPilot(pilot)).toBe(pilot)
  expect(pilot.windows).toHaveLength(1)
  expect(pilot.windows[0].minutes).toHaveLength(104)
  expect(pilot.gaps).toEqual([])
  expect(cantonalPilotWindow(pilot, 57420)).toBe(pilot.windows[0])
  expect(cantonalPilotWindow(pilot, 57421)).toBeUndefined()
  expect(pilot.topology.sections.map(s => s.distanceKm)).toEqual([4.82204, 4.82204])
  expect(cantonalPilotForRoad('ZH:15')?.id).toBe('bauma-wila-2026-09-08')
})

it('shares and restores the final observation with its recording identity', () => {
  const state = { study: 'national', range: 'morning', date: '2026-09-08', recording: 'bauma-wila-2026-09-08', time: 57420 } as const
  expect(readStudyLink(new URL(studyLinkUrl('https://example.org', state)).search)).toEqual(state)
})
