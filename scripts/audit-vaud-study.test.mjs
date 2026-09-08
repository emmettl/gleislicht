import { describe, expect, it } from 'vitest'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { auditVaudBoundary, summarizeVaud, vaudAdmission, validateVaudArtifacts } from './audit-vaud-study.mjs'

describe('Vaud expansion audit', () => {
  it('admits by source agency and mode, separating lake/mountain and neighbouring services', () => {
    expect(vaudAdmission({ agencyId: '764', mode: 'bus' })).toBe('candidate')
    expect(vaudAdmission({ agencyId: '66', mode: 'rail' })).toBe('candidate')
    expect(vaudAdmission({ agencyId: '344', mode: 'funicular' })).toBe('deferred-mode')
    expect(vaudAdmission({ agencyId: '184', mode: 'ferry' })).toBe('deferred-mode')
    expect(vaudAdmission({ agencyId: '881', mode: 'bus' })).toBe('outside-operator-scope')
    expect(vaudAdmission({ agencyId: '131', mode: 'rail' })).toBe('outside-operator-scope')
    expect(() => vaudAdmission()).toThrow('Unknown source route')
  })

  it('distinguishes clipped termini from artificial links across omitted calls', () => {
    expect(auditVaudBoundary(['a', 'b', 'c', 'd'], ['b', 'c'])).toEqual({ clippedStart: true, clippedEnd: true, interiorGaps: [] })
    expect(auditVaudBoundary(['a', 'b', 'c', 'd'], ['a', 'c', 'd']).interiorGaps).toEqual([0])
    expect(auditVaudBoundary(['a', 'b', 'a', 'c'], ['a', 'b', 'a', 'c'])).toEqual({ clippedStart: false, clippedEnd: false, interiorGaps: [] })
    expect(() => auditVaudBoundary(['a', 'b', 'c'], ['c', 'a'])).toThrow('absent or reordered')
  })

  it('counts directions and operators separately, with headways and overnight trips disclosed', () => {
    const stops = [[6.5, 46.5, 'A', '', 'a'], [6.51, 46.5, 'B', '', 'b']]
    const routes = new Map([['bus', { agencyId: '764', mode: 'bus', name: '1' }], ['m2', { agencyId: '151', mode: 'metro', name: 'm2' }]])
    const trip = { id: 'a', routeId: 'bus', route: '1', sourceServiceDate: '2026-09-08', stops: [[0, 100, 100], [1, 200, 200]], pathSegments: [0] }
    const snapshot = { metadata: { serviceDate: '2026-09-08' }, stops, paths: [stops.map(stop => stop.slice(0, 2))], trains: [trip, { ...trip, id: 'b' }, { ...trip, id: 'c', sourceServiceDate: '2026-09-07', stops: [...trip.stops].reverse(), pathSegments: [null] }, { ...trip, id: 'd', routeId: 'm2', frequency: { exactTimes: 0 }, pathSegments: [null] }] }
    const groups = summarizeVaud(snapshot, routes)
    expect(groups.find(group => group.id === '764:bus')).toMatchObject({ trips: 3, previousDayTrips: 1, totalSegments: 3, acceptedSegments: 2, directedPairs: 2, acceptedDirectedPairs: 1, coverage: 2 / 3 })
    expect(groups.find(group => group.id === '151:m2')).toMatchObject({ trips: 1, headwayTrips: 1, coverage: 0 })
    expect(() => summarizeVaud({ ...snapshot, trains: [{ ...trip, pathSegments: [99] }] }, routes)).toThrow('Invalid Vaud path reference')
  })

  it('validates chunk hashes and references while allowing explicit unshaped motion', () => {
    const stops = [[6.5, 46.5, 'A', '', 'a'], [6.51, 46.5, 'B', '', 'b']]
    const trip = { id: 'a', route: '1', category: 'bus', start: 100, end: 200, stops: [[0, 100, 100], [1, 200, 200]], pathSegments: [null] }
    const snapshot = { metadata: { serviceDate: '2026-09-08', windowStart: 0, windowEnd: 86400 }, stops, bounds: {}, paths: [], edges: [[0, 1]], edgePaths: [null], trains: [trip] }
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'vaud-region-day-chunks')
    const morning = extractNetworkWindow(snapshot, 0, 7200, 100)
    expect(() => validateVaudArtifacts(manifest, chunks, morning)).not.toThrow()
    const invalid = chunkNetworkSnapshot({ ...snapshot, trains: [{ ...trip, pathSegments: [99] }] }, 7200, 'vaud-region-day-chunks')
    expect(() => validateVaudArtifacts(invalid.manifest, invalid.chunks, morning)).toThrow('Invalid Vaud train path references')
    chunks[0].payload.trains[0].route = 'tampered'
    expect(() => validateVaudArtifacts(manifest, chunks, morning)).toThrow()
  })
})
