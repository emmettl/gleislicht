import { describe, expect, it } from 'vitest'
import { auditCantonalCoverage, minuteRuns } from './audit-cantonal-road-coverage.mjs'
import { cantonalMeasurementIssues } from './cantonal-measurement-quality.mjs'
const ids = ['ZH.CH:4590', 'ZH.CH:4290']
const catalog = { metadata: { measurementSiteTableVersion: 23 }, stations: ids.map(id => ({ id, detectorIds: [`${id}.01`, `${id}.02`] })), detectors: ids.flatMap(id => ['01', '02'].map(lane => ({ id: `${id}.${lane}`, lane: 'lane1' }))) }
const geometry = { stations: ids.map(id => ({ id, name: id })) }
const directions = { stationAudit: ids.map(id => ({ id, status: 'validated', detectors: [] })), sectionAudit: [{ from: ids[0], to: ids[1], distanceMetres: 1300, status: 'accepted' }], sections: [], sites: [] }
const options = { serviceDate: '2026-09-08', windowStart: 48180, windowEnd: 48420 }
const sample = minute => ({ metadata: { measurementKind: 'recorded', recordingScope: 'zurich-cantonal', measurementSiteTableVersion: 23 }, measurements: catalog.detectors.map(d => ({ siteId: d.id, measurementTime: `2026-09-08T11:${minute}:00Z`, lightFlowPerHour: 60, lightSpeedKmh: 50, heavyFlowPerHour: 0 })) })
describe('cantonal archive completeness audit', () => {
  it('separates archive gaps from source failures and preserves real minute windows', () => {
    const bad = sample('26'); delete bad.measurements[0].lightFlowPerHour
    const audit = auditCantonalCoverage([sample('23'), sample('24'), bad, sample('27')], catalog, geometry, directions, options)
    expect(audit.archiveGaps).toEqual([{ start: 48300, end: 48300, minutes: 1 }])
    expect(audit.horgen.completeRuns).toEqual([{ start: 48180, end: 48240, minutes: 2 }, { start: 48420, end: 48420, minutes: 1 }])
    expect(audit.horgen.stations[0].detectorIssueMinutes['ZH.CH:4590.01']).toEqual({ 'light-flow-missing-or-invalid': 1 })
    expect(audit.candidatePairs[0].completeMinutes).toBe(3)
    expect(audit.horgen.completePercent).toBe(60)
  })
  it('rejects catalog drift, foreign detectors and conflicting duplicate minutes', () => {
    const changed = sample('23'); changed.metadata.measurementSiteTableVersion++
    expect(() => auditCantonalCoverage([changed], catalog, geometry, directions, options)).toThrow('version mismatch')
    const foreign = sample('23'); foreign.measurements[0].siteId = 'CH:1.01'
    expect(() => auditCantonalCoverage([foreign], catalog, geometry, directions, options)).toThrow('Unexpected detector')
    const conflict = sample('23'); conflict.measurements[0].lightFlowPerHour = 600
    expect(() => auditCantonalCoverage([sample('23'), conflict], catalog, geometry, directions, options)).toThrow('Conflicting duplicate')
    expect(auditCantonalCoverage([sample('23'), sample('23')], catalog, geometry, directions, options).metadata.observedMinutes).toBe(1)
  })
  it('distinguishes an empty class from missing flow or a positive flow without speed', () => {
    expect(cantonalMeasurementIssues({ lightFlowPerHour: 0, heavyFlowPerHour: 0 })).toEqual([])
    expect(cantonalMeasurementIssues({ lightFlowPerHour: 60, lightSpeedKmh: 0, heavyFlowPerHour: 0 })).toEqual(['light-speed-missing-or-invalid'])
    expect(cantonalMeasurementIssues()).toEqual(['missing-detector'])
    expect(minuteRuns([180, 60, 120, 60, 300])).toEqual([{ start: 60, end: 180, minutes: 3 }, { start: 300, end: 300, minutes: 1 }])
  })
})
