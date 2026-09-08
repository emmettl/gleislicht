import { describe, expect, it } from 'vitest'
import { compileCantonalRoadStudy, compileNationalRoadStudy } from './compile-astra-national-study.mjs'
const topology = {
  metadata: { recordingScope: 'zurich-cantonal', measurementSiteTableVersion: 23 },
  sites: [1, 2, 3].map(n => ({ id: `ZH.CH:${n}:axis-positive`, stationId: `ZH.CH:${n}`, detectorIds: [`ZH.CH:${n}.01`], match: { confidence: 'high' } })),
  sections: [{ id: 'section', road: 'ZH:3', direction: 'positive', fromSiteId: 'ZH.CH:1:axis-positive', toSiteId: 'ZH.CH:2:axis-positive', distanceKm: 1.3 }],
}
const snapshot = (minute, scope = 'zurich-cantonal') => ({ metadata: { recordingScope: scope, measurementKind: 'recorded', measurementSiteTableVersion: 23 }, measurements: [1, 2, 3].map(n => ({ siteId: `ZH.CH:${n}.01`, measurementTime: `2026-09-08T11:${minute}:00Z`, lightFlowPerHour: n * 60, lightSpeedKmh: 50, heavyFlowPerHour: 0 })) })
describe('cantonal recorded pilot compiler', () => {
  it('uses only connected sites and retains the real Swiss afternoon date and scope', () => {
    const study = compileCantonalRoadStudy([snapshot('23'), snapshot('24'), snapshot('25', 'national')], topology, { minimumSamples: 2 })
    expect(study.metadata).toMatchObject({ publisher: 'Tiefbauamt Kanton Zürich', recordingScope: 'zurich-cantonal', serviceDate: '2026-09-08', windowStart: 13 * 3600 + 23 * 60, completeMinutes: 2, acceptedSites: 2, minimumSiteCoverage: 1 })
    expect(study.minutes[0][1][0]).toEqual([0, 60, 50, 0, 0])
    expect(() => compileNationalRoadStudy([snapshot('23')], topology, { minimumSamples: 1 })).toThrow('No sufficiently complete')
  })
  it('rejects foreign suppliers, catalog drift and conflicting duplicate observations', () => {
    const wrong = snapshot('23'); wrong.measurements[0].siteId = 'CH:1.01'
    expect(() => compileCantonalRoadStudy([wrong], topology)).toThrow('supplier')
    const changed = snapshot('23'); changed.metadata.measurementSiteTableVersion = 24
    expect(() => compileCantonalRoadStudy([changed], topology)).toThrow('version mismatch')
    const conflicting = snapshot('23'); conflicting.measurements[0].lightFlowPerHour = 999
    expect(() => compileCantonalRoadStudy([snapshot('23'), conflicting], topology)).toThrow('Conflicting duplicate')
  })
  it('requires all lanes at every connected site for every accepted minute', () => {
    const multiLane = structuredClone(topology); multiLane.sites[0].detectorIds.push('ZH.CH:1.02')
    expect(() => compileCantonalRoadStudy([snapshot('23')], multiLane, { minimumSamples: 1 })).toThrow('No sufficiently complete')
    const missingSpeed = snapshot('24'); delete missingSpeed.measurements[0].lightSpeedKmh
    expect(() => compileCantonalRoadStudy([snapshot('23'), missingSpeed, snapshot('25')], topology, { minimumSamples: 2 })).toThrow('not continuous')
    expect(() => compileCantonalRoadStudy([snapshot('23'), snapshot('25')], topology, { minimumSamples: 2 })).toThrow('not continuous')
  })
  it('supports an explicit observation window without concealing gaps inside it', () => {
    const study = compileCantonalRoadStudy([snapshot('21'), snapshot('23'), snapshot('24')], topology, { minimumSamples: 2, windowStart: 13 * 3600 + 23 * 60, windowEnd: 13 * 3600 + 24 * 60 })
    expect(study.metadata.completeMinutes).toBe(2)
    expect(() => compileCantonalRoadStudy([snapshot('23')], topology, { minimumSamples: NaN })).toThrow('positive integer')
    expect(() => compileCantonalRoadStudy([snapshot('23')], { ...topology, sections: [] })).toThrow('directed sections')
  })
  it('does not let a complete lane conceal another lane’s incomplete vehicle class', () => {
    const multiLane = structuredClone(topology)
    multiLane.sites[0].detectorIds.push('ZH.CH:1.02')
    const sample = snapshot('23')
    sample.measurements.push({ ...sample.measurements[0], siteId: 'ZH.CH:1.02', heavyFlowPerHour: 60 })
    expect(() => compileCantonalRoadStudy([sample], multiLane, { minimumSamples: 1 })).toThrow('No sufficiently complete')
    sample.measurements.at(-1).heavySpeedKmh = 40
    expect(compileCantonalRoadStudy([sample], multiLane, { minimumSamples: 1 }).metadata.completeMinutes).toBe(1)
    sample.measurements.at(-1).heavySpeedKmh = 0
    expect(() => compileCantonalRoadStudy([sample], multiLane, { minimumSamples: 1 })).toThrow('No sufficiently complete')
  })
})
