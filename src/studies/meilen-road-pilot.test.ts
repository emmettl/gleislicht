import { expect, it } from 'vitest'
import source from '../../public/data/meilen-staefa-road-pilot.json'
import { validateCantonalPilot } from './validate-cantonal-pilot.ts'
import { cantonalPilotWindow, type CantonalPilot } from './cantonal-road-pilot.ts'
import { readStudyLink } from './explore.ts'
import { studyLinkUrl } from './share-link.ts'
const pilot = source as unknown as CantonalPilot
it('validates every minute of the 245-minute Meilen–Stäfa recording', () => {
  expect(validateCantonalPilot(pilot)).toBe(pilot)
  expect(pilot.windows).toHaveLength(1)
  expect(pilot.windows[0].minutes).toHaveLength(245)
  expect(pilot.gaps).toEqual([])
  expect(cantonalPilotWindow(pilot,62820)).toBe(pilot.windows[0])
  expect(cantonalPilotWindow(pilot,62821)).toBeUndefined()
  expect(pilot.topology.sections.map(s => s.distanceKm)).toEqual([4.09736,4.09736])
})
it('shares and restores its own recording identity through the final observation', () => {
  const state = { study: 'national', range: 'morning', date: '2026-09-08', recording: 'meilen-staefa-2026-09-08', time: 62820 } as const
  expect(readStudyLink(new URL(studyLinkUrl('https://example.org',state)).search)).toEqual(state)
})
