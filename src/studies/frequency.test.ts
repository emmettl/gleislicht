import { FREQUENCY_COPY } from './frequency-copy.ts'
import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot, NetworkTrain } from '@motionstudies/core/domain/network'
import { isHeadwayTrain, withFrequencyFerryPaths } from './frequency.ts'

const ferry = { id: 'ferry', route: 'F', category: 'ferry', shortName: '', headsign: 'B', start: 0, end: 600, stops: [[0, 0, 0], [1, 600, 600]], frequency: { sourceTripId: 'template', startTime: 0, endTime: 3600, headwaySeconds: 600, exactTimes: 0 } } as const
const snapshot: NetworkSnapshot = {
  metadata: { publisher: 'SBB', serviceDate: '2026-09-04', feedVersion: 'v', sourceUrl: '', model: '', note: '', windowStart: 0, windowEnd: 3600, focusTime: 300 },
  bounds: { minLongitude: 8, maxLongitude: 9, minLatitude: 46, maxLatitude: 47 },
  stops: [[8, 46, 'A'], [9, 47, 'B']], edges: [[0, 1]], trains: [ferry],
}

describe('frequency presentation', () => {
  it('distinguishes exact departures from headway illustrations in every interface language', () => {
    expect(isHeadwayTrain(ferry)).toBe(true)
    expect(isHeadwayTrain({ ...ferry, frequency: { ...ferry.frequency, exactTimes: 1 } } as NetworkTrain)).toBe(false)
    for (const language of ['en', 'de', 'fr', 'it'] as const) expect(FREQUENCY_COPY[language].note).toBeTruthy()
  })

  it('keeps ferry crossings direct and shared across directions instead of routing along shore', () => {
    const reverse = { ...ferry, id: 'reverse', stops: [[1, 0, 0], [0, 600, 600]] as const }
    const output = withFrequencyFerryPaths({ ...snapshot, trains: [ferry, reverse] })
    expect(output.paths).toEqual([[[8, 46], [9, 47]]])
    expect(output.edgePaths).toEqual([0])
    expect(output.trains.map(train => train.pathSegments)).toEqual([[0], [0]])
    expect(snapshot.paths).toBeUndefined()
  })

  it('preserves supplied geometry and leaves ordinary rail snapshots unchanged', () => {
    const supplied = { ...snapshot, paths: [[[8, 46], [8.5, 46.5], [9, 47]]] as const, edgePaths: [0], trains: [{ ...ferry, pathSegments: [0] }] }
    expect(withFrequencyFerryPaths(supplied).paths).toEqual(supplied.paths)
    const rail = { ...snapshot, trains: [{ ...ferry, category: 'regional' as const }] }
    expect(withFrequencyFerryPaths(rail)).toBe(rail)
  })
})
