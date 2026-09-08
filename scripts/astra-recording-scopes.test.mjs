import { describe, expect, it } from 'vitest'
import { cantonalSiteReferences, scopedRecordedSnapshot, validateRecordingScope } from './astra-recording-scopes.mjs'

const catalog = {
  metadata: { supplier: 'ZH.CH', publisher: 'Tiefbauamt Kanton Zürich', recordingScope: 'zurich-cantonal', measurementSiteTableVersion: 23, sourceSha256: 'test-hash' },
  stations: [{ id: 'ZH.CH:1019' }, { id: 'ZH.CH:1020' }],
  detectors: [{ id: 'ZH.CH:1019.01' }, { id: 'ZH.CH:1020.01' }],
}
const measurement = (siteId, overrides = {}) => ({ siteId, measurementTime: '2026-09-08T10:00:00.000Z', lightFlowPerHour: 120, lightSpeedKmh: 40, heavyFlowPerHour: 0, ...overrides })
const snapshot = (measurements) => ({ metadata: { publisher: 'Federal Roads Office (ASTRA / FEDRO)', publicationTime: '2026-09-08T10:01:20.000Z', receivedAt: '2026-09-08T10:01:24.000Z', measurementSiteTableVersion: 23, measurementKind: 'recorded' }, measurements })

describe('cantonal recording isolation and coverage', () => {
  it('requests catalog stations regardless of geometry eligibility and validates scope inputs', () => {
    expect(cantonalSiteReferences(catalog)).toEqual(['ZH.CH:1019/#', 'ZH.CH:1020/#'])
    expect(() => cantonalSiteReferences({ ...catalog, stations: [{ id: 'CH:1019' }] })).toThrow('invalid station')
    expect(() => validateRecordingScope('../national')).toThrow('Unknown recording scope')
    expect(() => validateRecordingScope('toString')).toThrow('Unknown recording scope')
  })

  it('keeps federal, unrequested cantonal and old data out of current coverage', () => {
    const result = scopedRecordedSnapshot(snapshot([
      measurement('CH:1019.01'), measurement('ZH.CH:1019.01'),
      measurement('ZH.CH:1020.01', { measurementTime: '2026-09-08T09:59:00.000Z' }),
      measurement('ZH.CH:9999.01'),
    ]), 'zurich-cantonal', cantonalSiteReferences(catalog), catalog)
    expect(result.measurements.map(({ siteId }) => siteId)).toEqual(['ZH.CH:1019.01', 'ZH.CH:1020.01'])
    expect(result.metadata).toMatchObject({ publisher: 'Tiefbauamt Kanton Zürich', supplier: 'ZH.CH', counterCatalogVersionMatches: true, requestedStationCount: 2 })
    expect(result.metadata.coverage).toMatchObject({ reportingStations: 1, reportingStationFraction: 0.5, reportingDetectors: 1, completeDetectors: 1, olderDetectorMeasurements: 1 })
  })

  it('rejects an absent or stale cantonal supplier even when federal data is fresh', () => {
    const federal = measurement('CH:1019.01')
    const stale = measurement('ZH.CH:1019.01', { measurementTime: '2026-09-08T09:50:00.000Z' })
    expect(() => scopedRecordedSnapshot(snapshot([federal]), 'zurich-cantonal', cantonalSiteReferences(catalog), catalog)).toThrow('No requested detector')
    expect(() => scopedRecordedSnapshot(snapshot([federal, stale]), 'zurich-cantonal', cantonalSiteReferences(catalog), catalog)).toThrow('stale')
  })

  it('reports incomplete speed, catalog drift and new detectors without inventing observations', () => {
    const input = snapshot([measurement('ZH.CH:1019.03', { lightSpeedKmh: undefined })])
    input.metadata.measurementSiteTableVersion = 24
    const result = scopedRecordedSnapshot(input, 'zurich-cantonal', cantonalSiteReferences(catalog), catalog)
    expect(result.metadata.coverage.completeDetectors).toBe(0)
    expect(result.metadata.counterCatalogVersionMatches).toBe(false)
    expect(result.metadata.unlistedDetectorIds).toEqual(['ZH.CH:1019.03'])
    expect(result.measurements[0].lightSpeedKmh).toBeUndefined()
  })
})
