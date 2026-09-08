import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { zugRailMatcher } from './zug-rail-geometry.mjs'
import { coverage } from './build-graubuenden-region.mjs'
import { readStudyLink, STUDY_IDS, REGIONAL_DAYS } from '../src/studies/explore.ts'
import { EXPLORE_COPY } from '../src/studies/explore-copy.ts'

const route = { routeId: 'r', agencyId: '72', line: 'R16' }
const nodes = new Map([
  ['shared', { id: 'shared', name: 'Station', number: '8500001', coordinate: [9.5, 46.8] }],
  ['rhb', { id: 'rhb', name: 'Station RhB', number: '8510001', coordinate: [9.5001, 46.8] }],
  ['b', { id: 'b', name: 'B', number: '8500002', coordinate: [9.51, 46.8] }],
])
const network = { nodes, segments: [{ id: 'rhb-edge', start: 'rhb', end: 'b', gauge: 'mm1000', infrastructureOperator: 'RhB FR VR', points: [nodes.get('rhb').coordinate, nodes.get('b').coordinate], validFrom: '2000-01-01' }] }
const config = { routes: [route], gauges: ['mm1000'], infrastructureOperators: ['RhB FR VR'], limits: { stationAttachmentMetres: 350, topologyAttachmentMetres: 120, detourRatio: 4.5, detourFloorMetres: 3000 },
  operatingPointOverrides: [{ sourceNumber: '8500001', targetNumber: '8510001', expectedName: 'Station RhB', routeIds: ['r'] }] }
const stops = new Map([['a', { stop_id: '8500001:0:1', stop_lon: 9.5, stop_lat: 46.8 }], ['b', { stop_id: '8500002', stop_lon: 9.51, stop_lat: 46.8 }]])
const train = { routeId: 'r', directionId: '0', calls: [{ id: 'a' }, { id: 'b' }] }
const match = c => zugRailMatcher(network, c, ['2026-09-03', '2026-09-06']).matchPattern(train, stops, route)[0]

describe('Graubünden initial scope', () => {
  it('maps explicitly reviewed platform groups without adding infrastructure edges or changing source stops', () => {
    expect(match(config).directedSourceSegments).toEqual([{ id: 'rhb-edge', from: 'rhb', to: 'b' }])
    expect(match(config).path[0]).toEqual([9.5, 46.8])
    expect(stops.get('a').stop_id).toBe('8500001:0:1')
    expect(match({ ...config, operatingPointOverrides: [] }).reason).toBe('rail-disconnected-detour-or-stop-order')
    expect(match({ ...config, gauges: ['mm1435'] }).reason).toBe('rail-disconnected-detour-or-stop-order')
    expect(match({ ...config, infrastructureOperators: ['MGI'] }).reason).toBe('rail-disconnected-detour-or-stop-order')
  })
  it('rejects ambiguous reviews, changed source names and mappings assigned to another route', () => {
    expect(() => match({ ...config, operatingPointOverrides: [...config.operatingPointOverrides, ...config.operatingPointOverrides] })).toThrow('Ambiguous')
    expect(() => match({ ...config, operatingPointOverrides: [{ ...config.operatingPointOverrides[0], expectedName: 'Changed' }] })).toThrow('identity')
    expect(match({ ...config, operatingPointOverrides: [{ ...config.operatingPointOverrides[0], routeIds: ['other'] }] }).reason).toBe('rail-disconnected-detour-or-stop-order')
  })
  it('keeps excluded patterns and headways in coverage denominators; pair success is not journey admission', () => {
    const p = { routeId: 'r', trips: 10, admitted: false, headwayTrips: 4, carryInTrips: 2, reasons: ['gap'], pairs: [{ fromId: 'a', toId: 'b', matched: true }, { fromId: 'b', toId: 'c', matched: false }] }
    const c = coverage([p])
    expect(c.trips).toBe(10); expect(c.admittedTrips).toBe(0); expect(c.matchedSegmentOccurrences).toBe(10)
    expect(c.scheduledSegmentOccurrences).toBe(12); expect(c.headwayTrips).toBe(4); expect(c.carryInTrips).toBe(2)
  })
  it('resolves dated links and keeps all study labels aligned with their identifiers', () => {
    expect(readStudyLink('?study=graubuenden-region&date=2026-09-06').range).toBe('day')
    expect(readStudyLink('?study=graubuenden-region&range=morning').range).toBe('morning')
    expect(REGIONAL_DAYS['graubuenden-region']).toContain('/2026-09-04/')
    for (const copy of Object.values(EXPLORE_COPY)) {
      expect(copy.names).toHaveLength(STUDY_IDS.length); expect(copy.descriptions).toHaveLength(STUDY_IDS.length)
      expect(copy.names[STUDY_IDS.indexOf('graubuenden-region')]).toMatch(/Graubünden|Grisons|Grigioni/)
    }
  })
  it('pins every annual route and both dated full-candidate totals', () => {
    const s = JSON.parse(readFileSync('data/graubuenden-audit/summary.json'))
    expect(s.annualRouteRecords).toBe(380); expect(s.annualAgencies).toBe(67)
    expect(s.days.map(d => d.trips)).toEqual([39402, 38425])
    expect(s.days.map(d => d.admittedTrips)).toEqual([10110, 8947])
  })
})
