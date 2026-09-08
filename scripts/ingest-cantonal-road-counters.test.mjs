import { describe, expect, it } from 'vitest'
import { buildCantonalCounterCatalog } from './ingest-cantonal-road-counters.mjs'
import { parseAstraMeasurementSites } from './ingest-national-road-topology.mjs'

const detector = (id, { direction = 'positive', location = '<latitude>47.45</latitude><longitude>8.70</longitude>', lane = 'lane1' } = {}) =>
  `<measurementSiteRecord id="${id}"><lane>${lane}</lane>${direction ? `<alertCDirectionCoded>${direction}</alertCDirectionCoded>` : ''}<pointCoordinates>${location}</pointCoordinates></measurementSiteRecord>`
const table = (records) => `<publicationTime>2026-06-18T12:11:49Z</publicationTime><measurementSiteTable version="23">${records.join('')}</measurementSiteTable>`

describe('Zürich cantonal counter discovery', () => {
  it('uses the actual dotted supplier ID without mixing similarly numbered federal stations', () => {
    const xml = table([detector('CH:1019.01'), detector('ZH.CH:1019.01'), detector('ZH.CH:1019.02')])
    const catalog = buildCantonalCounterCatalog(xml)
    expect(catalog.stations).toEqual([{ id: 'ZH.CH:1019', detectorIds: ['ZH.CH:1019.01', 'ZH.CH:1019.02'] }])
    expect(catalog.directionalGroups[0].detectorIds).toHaveLength(2)
    expect(parseAstraMeasurementSites(xml).records.map(({ id }) => id)).toEqual(['CH:1019.01'])
    expect(catalog.metadata.geometryStatus).toBe('unmatched')
    expect(catalog.metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('handles namespace prefixes and slash detector separators', () => {
    const xml = table([detector('ZH.CH:1019/01')]).replace(/<(\/?)([a-zA-Z]+)/g, '<$1dx223:$2')
    expect(buildCantonalCounterCatalog(xml).stations[0].id).toBe('ZH.CH:1019')
  })

  it('retains incomplete records for collection but excludes them from directional geometry groups', () => {
    const catalog = buildCantonalCounterCatalog(table([
      detector('ZH.CH:1019.01', { direction: null }),
      detector('ZH.CH:1020.01', { location: '' }),
      detector('ZH.CH:1021.01', { lane: 'emergencyLane' }),
      detector('ZH.CH:1022.01', { location: '<latitude>0</latitude><longitude>0</longitude>' }),
    ]))
    expect(catalog.stations).toHaveLength(4)
    expect(catalog.directionalGroups).toEqual([])
    expect(catalog.metadata.coverage).toMatchObject({ detectorsWithoutDirection: 1, detectorsWithInvalidCoordinate: 2, emergencyLaneDetectors: 1 })
    expect(catalog.detectors[1].coordinate).toBeNull()
  })

  it('rejects missing suppliers, duplicate detectors and missing provenance', () => {
    expect(() => buildCantonalCounterCatalog(table([detector('CH:1019.01')]))).toThrow('no ZH.CH')
    expect(() => buildCantonalCounterCatalog(table([detector('ZH.CH:1019.01'), detector('ZH.CH:1019.01')]))).toThrow('Repeated detector')
    expect(() => buildCantonalCounterCatalog(detector('ZH.CH:1019.01'))).toThrow('version and publication')
  })
})
