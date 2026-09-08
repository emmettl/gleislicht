import { describe, expect, it } from 'vitest'
import eveningSource from '../../public/data/horgen-evening-road-pilot.json'
import afternoonSource from '../../public/data/zurich-cantonal-road-pilot.json'
import coverage from '../../data/zurich-cantonal-evening-coverage-audit.json'
import { cantonalPilotForRecording, cantonalPilotWindow, type CantonalPilot } from './cantonal-road-pilot.ts'
import { validateCantonalPilot } from './validate-cantonal-pilot.ts'

const evening = eveningSource as unknown as CantonalPilot
const afternoon = afternoonSource as unknown as CantonalPilot

describe('Horgen evening recording', () => {
  it('publishes every complete minute in the audited hour on the original reviewed section', () => {
    expect(validateCantonalPilot(evening)).toBe(evening)
    expect(evening.topology).toEqual(afternoon.topology)
    expect(eveningSource.metadata.directionTopologySha256).toBe(afternoonSource.metadata.directionTopologySha256)
    expect(evening.windows).toHaveLength(1)
    expect(evening.windows[0].minutes.map(([time]) => time)).toEqual(Array.from({ length: 61 }, (_, i) => 76200 + i * 60))
    expect(evening.gaps).toEqual([])
    expect(coverage.horgen.hourWindows).toContainEqual({ start: 76200, end: 79800, minutes: 61 })
    expect(coverage.archiveGaps).toEqual([])
    expect(cantonalPilotWindow(evening, 79800)).toBe(evening.windows[0])
    expect(cantonalPilotWindow(evening, 79801)).toBeUndefined()
  })

  it('preserves the afternoon identity and rejects cross-window responses on the same road', () => {
    expect(validateCantonalPilot(afternoon)).toBe(afternoon)
    expect(afternoon.metadata.completeMinutes).toBe(40)
    expect(afternoon.gaps).toHaveLength(2)
    expect(() => validateCantonalPilot(afternoon, cantonalPilotForRecording(evening.metadata.recordingId))).toThrow('identity')
    expect(() => validateCantonalPilot(evening, cantonalPilotForRecording(afternoon.metadata.recordingId))).toThrow('identity')
    const altered = structuredClone(evening)
    altered.windows[0].minutes.splice(20, 1)
    expect(() => validateCantonalPilot(altered)).toThrow('Incomplete')
  })
})
