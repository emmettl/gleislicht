import { validateCantonalPilot } from './validate-cantonal-pilot.ts'
import { describe, expect, it } from 'vitest'
import source from '../../public/data/kilchberg-thalwil-road-pilot.json'
import { cantonalPilotForRoad, cantonalPilotWindow, cantonalPilotsForRoad, type CantonalPilot } from './cantonal-road-pilot.ts'
import { readStudyLink } from './explore.ts'
import { studyLinkUrl } from './share-link.ts'
const pilot = source as unknown as CantonalPilot
it('validates all 142 minutes and both directions of Kilchberg–Thalwil', () => {
  expect(validateCantonalPilot(pilot)).toBe(pilot)
  expect(pilot.windows[0].minutes).toHaveLength(142)
  expect(pilot.gaps).toEqual([])
  expect(cantonalPilotWindow(pilot,59700)).toBe(pilot.windows[0])
  expect(cantonalPilotWindow(pilot,59701)).toBeUndefined()
  expect(pilot.topology.sections.map(s => s.distanceKm)).toEqual([4.80281,4.80281])
})
describe('multiple recordings on the same road', () => {
  it('selects the requested identity and keeps Horgen as the default ZH 3 pilot', () => {
    expect(cantonalPilotsForRoad('ZH:3')).toHaveLength(2)
    expect(cantonalPilotForRoad('ZH:3')?.id).toBe('horgen-2026-09-08')
    expect(cantonalPilotForRoad('ZH:3', pilot.metadata.recordingId)?.id).toBe(pilot.metadata.recordingId)
    expect(() => validateCantonalPilot(pilot, cantonalPilotForRoad('ZH:3'))).toThrow('identity')
  })
  it('round trips the final observation without selecting another ZH 3 recording', () => {
    const state = { study: 'national', range: 'morning', recording: pilot.metadata.recordingId, date: '2026-09-08', time: 59700 } as const
    const link = readStudyLink(new URL(studyLinkUrl('https://example.org',state)).search)
    expect(link).toEqual(state)
    expect(cantonalPilotForRoad('ZH:3',link.recording)?.stationIds).toEqual(['ZH.CH:0109','ZH.CH:4190'])
  })
})
