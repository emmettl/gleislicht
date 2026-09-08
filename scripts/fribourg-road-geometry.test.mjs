import { describe, it, expect } from 'vitest'
import { fribourgRoadInputs, validateFribourgRoadScope, applyFribourgRoads } from './fribourg-road-geometry.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'

const stops = [[7.1, 46.8, 'Outside canton', '', 'a'], [7.11, 46.8, 'Inside canton', '', 'b'], [7.12, 46.8, 'Terminus', '', 'c']]
const route = { id: 'route', agencyId: '834', agency: 'TPF', name: '2', mode: 'bus', type: 700 }
const timetable = () => ({ routes: [route], sourceHashes: { archive: 'gtfs', source: 'geometry' }, snapshots: [
  { metadata: { serviceDate: '2026-09-04' }, stops, trains: [{ id: 'carry', routeId: 'route', agencyId: '834', stops: [[0, -60, -60], [1, 0, 0], [2, 60, 60]] }] },
  { metadata: { serviceDate: '2026-09-06' }, stops, trains: [{ id: 'reverse', routeId: 'route', agencyId: '834', stops: [[2, 60, 60], [1, 120, 120], [0, 180, 180]] }] },
] })

function fixture() {
  const result = { paths: [[stops[0].slice(0, 2), stops[1].slice(0, 2)]], pairs: [
    { routeId: 'route', agencyId: '834', mode: 'bus', fromId: 'a', toId: 'b', pathIndex: 0, occurrences: 1, admittedOccurrences: 0 },
    { routeId: 'route', agencyId: '834', mode: 'bus', fromId: 'b', toId: 'c', pathIndex: null, occurrences: 1, admittedOccurrences: 0, reason: 'disconnected-line', maximumSnapMetres: 8 },
  ], patterns: [{ id: 'pattern', routeId: 'route', stopIds: ['a', 'b', 'c'], pathSegments: [0, null], matchedSegments: 1, segmentCount: 2, admittedTrips: 0, decisions: {} }],
  trains: [{ id: 'trip', routeId: 'route', patternId: 'pattern', admission: 'incomplete-directed-pattern', stops: [[0, 0, 0], [1, 60, 60], [2, 120, 120]] }] }
  const roads = { policy: { excludedRouteIds: [] }, candidates: new Map([[JSON.stringify(['route', 'b', 'c']), {
    agencyId: '834', path: [stops[1].slice(0, 2), [7.115, 46.801], stops[2].slice(0, 2)], lengthMetres: 800, roadPatternIds: ['full-pattern'],
  }]]) }
  return { result, roads, routes: new Map([['route', { ...route }]]) }
}

describe('Fribourg road supplement', () => {
  it('retains complete cross-canton and reverse calls, shifting only routing times', () => {
    const raw = timetable(), before = structuredClone(raw), input = fribourgRoadInputs(raw)
    expect(input.agencies.get('834').trains.map(t => t.stops.map(([i]) => input.stops[i][4]))).toEqual([['a', 'b', 'c'], ['c', 'b', 'a']])
    expect(input.agencies.get('834').trains[0].stops[0][1]).toBe(86340)
    expect(raw).toEqual(before)
  })

  it('rejects missing full patterns and changed coordinates in the scope', () => {
    const raw = timetable(), input = fribourgRoadInputs(raw), identities = Object.fromEntries(input.agencies.get('834').trains.map(t => [roadPatternId(t, input.stops), {}]))
    const cache = { metadata: { sourceHashes: raw.sourceHashes, dates: raw.snapshots.map(s => s.metadata.serviceDate) }, agencies: { 834: { identities } } }
    expect(() => validateFribourgRoadScope(raw, cache)).not.toThrow()
    const changed = structuredClone(raw); changed.snapshots[1].stops[2][0] += 0.00001
    expect(() => validateFribourgRoadScope(changed, cache)).toThrow()
    delete identities[Object.keys(identities)[0]]
    expect(() => validateFribourgRoadScope(raw, cache)).toThrow()
  })

  it('retains official segments and admits only a complete reconstructed journey', () => {
    const { result, roads, routes } = fixture(), before = structuredClone(result.trains[0].stops), official = structuredClone(result.paths[0])
    applyFribourgRoads(result, routes, roads)
    expect(result.paths[0]).toEqual(official)
    expect(result.trains[0].stops).toEqual(before)
    expect(result.trains[0].admission).toBe('admitted')
    expect(result.trains[0].roadSegmentCount).toBe(1)
    expect(result.patterns[0].officialMatchedSegments).toBe(1)
    expect(result.patterns[0].matchedSegments).toBe(2)
    expect(result.pairs[1].officialFailure.reason).toBe('disconnected-line')
    expect(result.pairs.map(p => p.admittedOccurrences)).toEqual([1, 1])
  })

  it('does not admit failed or pattern-dependent road candidates', () => {
    for (const reason of ['road-matcher-rejected', 'road-pattern-dependent-path']) {
      const { result, roads, routes } = fixture()
      roads.candidates.set(JSON.stringify(['route', 'b', 'c']), { agencyId: '834', reason })
      applyFribourgRoads(result, routes, roads)
      expect(result.trains[0].admission).toBe('incomplete-directed-pattern')
      expect(result.pairs[1].reason).toBe('disconnected-line')
      expect(result.pairs[1].roadFallback.reason).toBe(reason)
    }
  })

  it('rejects agency mismatch and missing route-specific pair identities', () => {
    const { result, roads, routes } = fixture()
    roads.candidates.values().next().value.agencyId = '801'
    expect(() => applyFribourgRoads(result, routes, roads)).toThrow()
    roads.candidates.clear()
    expect(() => applyFribourgRoads(result, routes, roads)).toThrow()
  })

  it('does not rescue reservation, demand-responsive or provisional-boundary journeys', () => {
    for (const reason of ['reservation-or-demand-responsive', 'demand-responsive-route-type', 'provisional-boundary-membership']) {
      const { result, roads, routes } = fixture()
      if (reason.startsWith('reservation')) result.trains[0].reservationRequired = true
      if (reason.startsWith('demand')) routes.get('route').type = 715
      if (reason.startsWith('provisional')) roads.policy.excludedRouteIds = ['route']
      applyFribourgRoads(result, routes, roads)
      expect(result.trains[0].admission).toBe(reason)
      expect(result.patterns[0].admittedTrips).toBe(0)
    }
  })
})
