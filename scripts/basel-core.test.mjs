import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { coreRoute, coreCallRuns, coreCivilTrains } from './basel-core-timetable.mjs'
import { coreInfrastructure, coreGeometryMatcher, BASEL_CORE_RAIL_LIMITS, coreEdgePaths } from './basel-core-geometry.mjs'
import { BASEL_DIVERSION_LIMITS } from './basel-tram-diversions.mjs'
import { coreCoverage, reviewedCoreRoadCache } from './build-basel-core.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { mergeBaselBusCandidates } from './prepare-basel-road-feeds.mjs'

const policy = JSON.parse(readFileSync(new URL('../data/basel-core-policy.json', import.meta.url)))
const stop = (didok, stop_name) => ({ didok, stop_name })
const sourceStops = new Map([['a', stop('8500010', 'Basel SBB')], ['b', stop('8500020', 'Muttenz')], ['c', stop('8500021', 'Pratteln')], ['outside', stop('8503000', 'Bern')]])
const calls = ids => ids.map((id, i) => ({ id, sequence: i, arrival: 85800 + i * 300, departure: 85800 + i * 300 }))
const source = ids => ({ routeId: 'source-route', headsign: 'Source destination', shortName: '42', calls: calls(ids) })
const route = { agencyId: '11', name: 'S1', mode: 'rail' }

describe('Basel core source admission and civil-day boundary', () => {
  it('admits exact agency, service and mode combinations without treating all rail as regional', () => {
    expect(coreRoute({ agency_id: '11', route_short_name: 'S1', route_type: '109' }, policy)?.mode).toBe('rail')
    for (const changed of [{ agency_id: 'other' }, { route_short_name: 'IC1' }, { route_type: '700' }]) {
      expect(coreRoute({ agency_id: '11', route_short_name: 'S1', route_type: '109', ...changed }, policy)).toBeUndefined()
    }
    expect(coreRoute({ agency_id: '823', route_short_name: 'EV8', route_type: '700' }, policy)?.mode).toBe('bus')
  })

  it('splits a source journey at excluded calls instead of bridging across them', () => {
    const run = coreCallRuns(calls(['a', 'b', 'outside', 'b', 'c']), call => call.id !== 'outside')
    expect(run.map(({ start, end }) => [start, end])).toEqual([[0, 2], [3, 5]])
    const trains = coreCivilTrains('trip', source(['a', 'b', 'outside', 'b', 'c']), route, sourceStops, policy, '2026-09-08', [-86400])
    expect(trains).toHaveLength(1) // first run ends before civil midnight
    expect(trains[0].sourceCallRange).toEqual([3, 5])
    expect(trains[0].sourceCallCount).toBe(5)
    expect(trains[0].id).toContain(':run:3')
    expect(trains[0].sourceTripId).toBe('trip')
    expect(trains[0].calls.map(call => call.id)).toEqual(['b', 'c'])
  })

  it('retains full local chains and distinguishes current-day trips from previous-day carry-in', () => {
    const trains = coreCivilTrains('trip', source(['outside', 'a', 'b', 'c']), { ...route, mode: 'bus' }, sourceStops, policy, '2026-09-08', [0, -86400])
    expect(trains).toHaveLength(2)
    expect(trains.map(train => [train.start, train.end])).toEqual([[85800, 86700], [-600, 300]])
    expect(trains.map(train => train.sourceServiceDate)).toEqual(['2026-09-08', '2026-09-07'])
    expect(new Set(trains.map(train => train.id)).size).toBe(2)
    expect(trains.every(train => train.calls.length === 4)).toBe(true)
    expect(trains[0].sourceCallRange).toBeUndefined()
  })

  it('excludes a source trip starting exactly at the following midnight', () => {
    const trip = source(['a', 'b']); trip.calls = trip.calls.map(call => ({ ...call, arrival: call.arrival + 600, departure: call.departure + 600 }))
    expect(coreCivilTrains('trip', trip, route, sourceStops, policy, '2026-09-08', [0])).toEqual([])
  })

  it('restores nonnegative source-day times only in the offline bus matching union', () => {
    const original = [[0, -600, -540], [1, 120, 180]]
    const candidate = { manifest: { metadata: { feedVersion: 'fixture', serviceDate: '2026-09-08' }, stops: [[7.6, 47.55, 'A', '', 'a'], [7.61, 47.55, 'B', '', 'b']] },
      trains: [{ id: 'carry', routeId: 'bus', route: '33', category: 'bus', stops: original }] }
    const merged = mergeBaselBusCandidates([candidate], new Map([['bus', { agencyId: '823', name: '33' }]]))
    expect(merged.trains[0].stops).toEqual([[0, 85800, 85860], [1, 86520, 86580]])
    expect(candidate.trains[0].stops).toEqual(original)
  })

  it('accepts the explicit German Basel Bad Bf identity alias and rejects changed station names', () => {
    const stops = new Map(sourceStops); stops.set('german', stop('8014431', 'Basel Bad Bf'))
    expect(coreCivilTrains('trip', source(['a', 'german']), route, stops, policy, '2026-09-08', [0])).toHaveLength(1)
    stops.set('german', stop('8014431', 'Different station'))
    expect(() => coreCivilTrains('trip', source(['a', 'german']), route, stops, policy, '2026-09-08', [0])).toThrow(/Changed station identity/)
  })
})

const A = [7.6, 47.55], B = [7.61, 47.55], C = [7.62, 47.55]
const segment = (id, start, end, points) => ({ id, start, end, points })
describe('Basel core infrastructure and coverage', () => {
  it('rejects the reviewed bus return only for the exact directed platform pair and keeps the raw cache intact', () => {
    const excluded = policy.roadExclusions[0]
    const stops = [[...A, 'General Guisan-Strasse', '', excluded.fromId], [...B, 'St. Galler-Ring', '', excluded.toId]]
    const trains = [{ id: 't', category: 'bus', routeId: 'r', route: '33', stops: [[0, 0, 0], [1, 60, 60]] },
      { id: 'reverse', category: 'bus', routeId: 'r', route: '33', stops: [[1, 0, 0], [0, 60, 60]] }]
    const patterns = Object.fromEntries(trains.map(train => [roadPatternId(train, stops), [0]]))
    const cache = { agencyCaches: { '823': { metadata: {}, patterns, report: { issues: [] } } } }
    const snapshot = { metadata: { serviceDate: '2026-09-08' }, stops, trains }, routes = new Map([['r', { agencyId: '823' }]])
    const result = reviewedCoreRoadCache(snapshot, routes, cache, policy).agencyCaches['823']
    expect(result.patterns[roadPatternId(trains[0], stops)]).toEqual([null])
    expect(result.patterns[roadPatternId(trains[1], stops)]).toEqual([0])
    expect(result.report.issues[0].reason).toBe('reviewed-corridor-mismatch')
    expect(Object.values(cache.agencyCaches['823'].patterns)).toEqual([[0], [0]])
    expect(() => reviewedCoreRoadCache({ ...snapshot, metadata: { serviceDate: '2026-09-09' } }, routes, cache, policy)).toThrow(/Unreviewed/)
  })
  it('uses operating-point identity and rejects a disconnected required corridor', () => {
    const network = { nodes: new Map([
      ['a', { id: 'a', number: 'rail-a', coordinate: A }], ['b', { id: 'b', number: 'rail-b', coordinate: B }],
      ['t', { id: 't', number: '8578143', coordinate: A }], ['u', { id: 'u', number: 'tram-b', coordinate: B }],
    ]), segments: [segment('rail', 'a', 'b', [A, B]), segment('tram', 't', 'u', [A, B])] }
    const result = coreInfrastructure(network, { railCorridors: [['rail-a', 'rail-b']] })
    expect(result.rail.map(segment => segment.id)).toEqual(['rail'])
    expect(result.tram.map(segment => segment.id)).toEqual(['tram'])
    network.segments.shift()
    expect(() => coreInfrastructure(network, { railCorridors: [['rail-a', 'rail-b']] })).toThrow(/Disconnected/)
  })

  it('projects onto connected source infrastructure in both directions without joining nearby disconnected nodes', () => {
    const stops = [[7.602, 47.55], [7.618, 47.55]]
    const match = coreGeometryMatcher([segment('ab', 'a', 'b', [A, B]), segment('bc', 'b', 'c', [B, C])], stops, [0, 1], BASEL_CORE_RAIL_LIMITS)
    const forward = match(0, 1), reverse = match(1, 0)
    expect(forward.reason).toBeNull()
    expect(forward.segmentIds).toEqual(['ab', 'bc'])
    expect(reverse.points).toEqual([...forward.points].reverse())
    const broken = coreGeometryMatcher([segment('ab', 'a', 'b', [A, B]), segment('bc', 'different-node', 'c', [B, C])], stops, [0, 1], BASEL_CORE_RAIL_LIMITS)
    expect(broken(0, 1).points).toBeNull()
  })

  it('rejects distant platforms, collapsed projections and excessive urban tram returns', () => {
    const straight = [segment('ab', 'a', 'b', [A, B])]
    expect(coreGeometryMatcher(straight, [A, [B[0], B[1] + 0.003]], [0, 1], BASEL_CORE_RAIL_LIMITS)(0, 1).reason).toBe('endpoint-gap')
    expect(coreGeometryMatcher(straight, [A, A], [0, 1], BASEL_CORE_RAIL_LIMITS)(0, 1).points).toBeNull()
    const far = [7.61, 47.56], near = [7.601, 47.55]
    expect(coreGeometryMatcher([segment('return', 'a', 'b', [A, far, near])], [A, near], [0, 1], BASEL_DIVERSION_LIMITS)(0, 1).points).toBeNull()
  })

  it('counts occurrences and carry-in trips independently of representative edge paths', () => {
    const trains = [0, 1, null].map((path, i) => ({ routeId: 'r', sourceServiceDate: i ? '2026-09-08' : '2026-09-07', pathSegments: [path], stops: [[0], [1]] }))
    const snapshot = { metadata: { serviceDate: '2026-09-08' }, trains, edges: [[0, 1]] }
    const report = coreCoverage(snapshot, new Map([['r', route]]))
    expect(report.groups[0]).toMatchObject({ trips: 3, matched: 2, total: 3, carryInTrips: 1, coverage: 2 / 3 })
    expect(coreEdgePaths(snapshot)).toEqual([0])
  })
})
