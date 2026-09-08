import { describe, it, expect } from 'vitest'
import { fribourgRailScope, fribourgRailRaw, applyFribourgRail, FRIBOURG_RAIL_LIMITS } from './fribourg-rail-geometry.mjs'
import { luzernRailMatcher } from './luzern-rail-geometry.mjs'
import { assessFribourgWorks, assertFribourgWorks } from './fribourg-works-audit.mjs'

function fixture() {
  const result = { paths: [[[7, 47], [7.01, 47]]], pairs: [
    { routeId: 'r', mode: 'rail', fromId: 'a', toId: 'b', pathIndex: 0, admittedOccurrences: 0 },
    { routeId: 'r', mode: 'rail', fromId: 'b', toId: 'c', pathIndex: null, reason: 'endpoint-gap', admittedOccurrences: 0 },
  ], patterns: [{ id: 'p', mode: 'rail', routeId: 'r', stopIds: ['a', 'b', 'c'], segmentCount: 2 }],
  trains: [{ id: 't', patternId: 'p', admission: 'incomplete-directed-pattern', stops: [[0, -10, 0], [1, 60, 60], [2, 120, 120]], callPermissions: [[0, 0], [0, 0], [0, 0]] }] }
  const rail = { policy: { routes: [{ routeId: 'r' }] }, pairs: new Map([[JSON.stringify(['r', 'b', 'c']), {
    path: [[7.01, 47], [7.02, 47]], pathMetres: 760, stationAttachmentsMetres: [20, 30], railPatternIds: ['full-chain'],
  }]]) }
  return { result, rail }
}

describe('Fribourg federal rail supplement', () => {
  it('limits gauge review to SBB, BLS and explicit TPF standard-gauge identities', () => {
    const routes = [['sbb', '11', 'IC', 'rail'], ['bls', '33', 'S1', 'rail'], ['tpf', '53', 'S20', 'rail'], ['meter', '53', 'S50', 'rail'], ['special', '53', '', 'rail'], ['mob', '73', 'GPX', 'rail'], ['bus', '11', 'IC', 'bus']].map(([id, agencyId, name, mode]) => ({ id, agencyId, name, mode }))
    expect(fribourgRailScope({ routes }).map(r => r.routeId)).toEqual(['bls', 'sbb', 'tpf'])
    expect(fribourgRailScope({ routes }).every(r => r.gauge === 'mm1435')).toBe(true)
  })
  it('retains complete repeated calls, direction and call permissions and rejects drifting platform identity', () => {
    const day = { metadata: { serviceDate: '2026-09-04' }, stops: [[7, 47, 'Outside canton', '', 'a'], [7.1, 47, 'Inside', '', 'b']], trains: [{ routeId: 'r', directionId: '1', stops: [[0], [1], [0]], callPermissions: [[1, 0], [0, 0], [0, 1]] }] }
    const raw = { routes: [], snapshots: [day] }, before = structuredClone(raw)
    expect(fribourgRailRaw(raw).snapshots[0].trains[0]).toEqual({ routeId: 'r', directionId: '1', calls: [{ id: 'a', pickupType: '1', dropOffType: '0' }, { id: 'b', pickupType: '0', dropOffType: '0' }, { id: 'a', pickupType: '0', dropOffType: '1' }] })
    expect(raw).toEqual(before)
    raw.snapshots.push(structuredClone(day)); raw.snapshots[1].stops[0][0] += 0.001
    expect(() => fribourgRailRaw(raw)).toThrow('Inconsistent rail platform identity')
  })
  it('fills failed pairs without changing accepted geometry, calls or times', () => {
    const { result, rail } = fixture(), before = structuredClone(result)
    applyFribourgRail(result, rail)
    expect(result.paths[0]).toEqual(before.paths[0])
    expect(result.trains[0].stops).toEqual(before.trains[0].stops)
    expect(result.trains[0].callPermissions).toEqual(before.trains[0].callPermissions)
    expect(result.trains[0].admission).toBe('admitted')
    expect(result.trains[0].railSegmentCount).toBe(1)
    expect(result.pairs[1].officialFailure).toEqual(before.pairs[1])
    expect(result.pairs.map(p => p.admittedOccurrences)).toEqual([1, 1])
  })
  it('keeps incomplete and context-dependent paths excluded, and rejects missing evidence', () => {
    const { result, rail } = fixture()
    rail.pairs.set(JSON.stringify(['r', 'b', 'c']), { reason: 'rail-pattern-dependent-path' })
    applyFribourgRail(result, rail)
    expect(result.trains[0].admission).toBe('incomplete-directed-pattern')
    expect(result.pairs[1].railFallback.reason).toBe('rail-pattern-dependent-path')
    expect(result.patterns[0].admittedTrips).toBe(0)
    rail.pairs.clear()
    expect(() => applyFribourgRail(result, rail)).toThrow('Missing full-pattern rail pair')
  })
  it('rejects a long standard-gauge detour even when topology and station identity agree', () => {
    const a = { id: 'a', number: '8500001', coordinate: [7, 47] }, b = { id: 'b', number: '8500002', coordinate: [7.1, 47] }
    const route = { routeId: 'r', agencyId: '11', line: 'IC1', gauge: 'mm1435' }
    const network = { nodes: new Map([['a', a], ['b', b]]), segments: [{ id: 'detour', start: 'a', end: 'b', gauge: 'mm1435', points: [a.coordinate, [7.05, 47.1], b.coordinate] }] }
    const stops = new Map([a, b].map(n => [n.id, { stop_id: n.id, didok: n.number, stop_lon: n.coordinate[0], stop_lat: n.coordinate[1] }]))
    const matcher = luzernRailMatcher(network, { routes: [route], limits: FRIBOURG_RAIL_LIMITS }, ['2026-09-04', '2026-09-06'])
    expect(matcher.match({ routeId: 'r', calls: [{ id: 'a' }, { id: 'b' }] }, stops, route)[0].reason).toBe('rail-disconnected-detour-or-stop-order')
  })
  it('never rescues reservation journeys or excluded gauges', () => {
    const { result, rail } = fixture()
    result.trains[0].reservationRequired = true
    applyFribourgRail(result, rail)
    expect(result.trains[0].admission).toBe('reservation-or-demand-responsive')
    expect(result.patterns[0].admittedTrips).toBe(0)
    const other = fixture(); other.rail.policy.routes = []
    applyFribourgRail(other.result, other.rail)
    expect(other.result.pairs[1].pathIndex).toBe(null)
  })
  it('detects evening closure violations including trips already underway, but ignores other corridors', () => {
    const calls = (a, b, departure, arrival) => [{ id: `ch:1:sloid:${a}`, departure }, { id: `ch:1:sloid:${b}`, arrival }]
    const input = [{ date: '2026-09-06', trains: [{ id: 'bad', calls: calls('4063', '4064', 75540, 75660) }] }]
    const assessment = assessFribourgWorks(input)
    expect(assessment[0].eveningCorridorSegments).toBe(1)
    expect(() => assertFribourgWorks(assessment)).toThrow('contradicts')
    input[0].trains[0].calls = calls('4086', '9999', 75660, 75780)
    expect(() => assertFribourgWorks(assessFribourgWorks(input))).not.toThrow()
    input[0].trains = []
    expect(() => assertFribourgWorks(assessFribourgWorks(input))).toThrow('Missing Sunday')
  })
})
