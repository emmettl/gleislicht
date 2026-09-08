import { describe, it, expect } from 'vitest'
import { luzernRailMatcher, luzernRailConsensus, luzernOperatingPoint, LUZERN_RAIL_LIMITS } from './luzern-rail-geometry.mjs'
import { luzernCategory } from './build-luzern-region.mjs'

const node = (id, number, coordinate) => ({ id, number, name: id, coordinate })
const a = node('a', '8500001', [8, 47]), b = node('b', '8500002', [8.01, 47]), c = node('c', '8500003', [8.02, 47]), d = node('d', '8500004', [8.01, 47.005])
const edge = (a, b, extra = {}) => ({ id: `${a.id}-${b.id}`, start: a.id, end: b.id, points: [a.coordinate, b.coordinate], gauge: 'mm1435', validFrom: '2020-01-01', sourceDate: '2021-07-06', ...extra })
const network = (segments = [edge(a, b), edge(b, c), edge(a, d), edge(d, c)], nodes = [a, b, c, d]) => ({ nodes: new Map(nodes.map(n => [n.id, n])), segments })
const route = { routeId: 'r', agencyId: '11', line: 'IR', gauge: 'mm1435' }
const config = { limits: LUZERN_RAIL_LIMITS, routes: [route] }
const dates = ['2026-09-04', '2026-09-06']
const stop = n => ({ stop_id: `ch:1:sloid:${Number(n.number) - 8500000}:1:1`, stop_name: n.name, stop_lon: String(n.coordinate[0]), stop_lat: String(n.coordinate[1]), didok: n.number })
const stops = new Map([a, b, c, d].map(n => { const s = stop(n); return [s.stop_id, s] }))
const train = nodes => ({ routeId: 'r', directionId: '0', calls: nodes.map(n => ({ id: stop(n).stop_id, pickupType: '0', dropOffType: '0' })) })

describe('Luzern federal rail inference', () => {
  it('classifies the newly admitted intercity, interregio and special services correctly', () => {
    for (const [line, category] of [['IC21', 'intercity'], ['IC', 'intercity'], ['EC', 'international'], ['VAE', 'interregio'], ['IR26', 'interregio'], ['S44', 's-bahn'], ['RE7', 'regional-express'], ['EXT', 'other']]) expect(luzernCategory({ mode: 'rail', line })).toBe(category)
  })
  it('joins exact operating points and follows reversed source geometry in the call direction', () => {
    const matcher = luzernRailMatcher(network([edge(a, b, { points: [b.coordinate, a.coordinate] })]), config, dates)
    const result = matcher.match(train([b, a]), stops, route)[0]
    expect(result.path[0]).toEqual(b.coordinate); expect(result.path.at(-1)).toEqual(a.coordinate)
    expect(result.directedSourceSegments).toEqual([{ id: 'a-b', from: 'b', to: 'a' }])
    expect(result.fromOperatingPoint).toBe('8500002')
  })
  it('never substitutes a nearby station with a matching name when the exact number is absent or ambiguous', () => {
    const changed = new Map(stops), wrong = { ...stop(a), didok: '8500999' }; changed.set(wrong.stop_id, wrong)
    expect(luzernRailMatcher(network(), config, dates).match(train([a, b]), changed, route)[0].reason).toBe('rail-missing-exact-operating-point')
    const ambiguous = network(undefined, [a, b, c, d, { ...a, id: 'duplicate' }])
    expect(luzernRailMatcher(ambiguous, config, dates).match(train([a, b]), stops, route)[0].reason).toBe('rail-ambiguous-operating-point')
    expect(luzernOperatingPoint({ stop_id: '8301307', didok: '8301307' })).toBe('8301307')
    expect(luzernOperatingPoint({ stop_id: 'ch:1:sloid:5000:4:8' })).toBe('8505000')
  })
  it('blocks called stations out of order and rejects the whole pair if no compatible corridor remains', () => {
    const result = luzernRailMatcher(network(), config, dates).match(train([a, c, b]), stops, route)[0]
    expect(result.directedSourceSegments.map(e => e.id)).toEqual(['a-d', 'd-c'])
    const disconnected = luzernRailMatcher(network([edge(a, b), edge(b, c)]), config, dates).match(train([a, c, b]), stops, route)[0]
    expect(disconnected.reason).toBe('rail-disconnected-detour-or-stop-order')
  })
  it('does not reuse a pair when complete pattern contexts select different infrastructure paths', () => {
    const raw = { inventory: [route], dates, stops: [...stops.values()], snapshots: [{ trains: [train([a, c]), train([a, c, b])] }] }
    const result = luzernRailConsensus(raw, luzernRailMatcher(network(), config, dates), config)
    expect(result.patterns).toHaveLength(2)
    expect(result.pairs.get(JSON.stringify(['r', stop(a).stop_id, stop(c).stop_id])).reason).toBe('rail-pattern-dependent-path')
  })
  it('respects gauge and source validity; mixed-gauge infrastructure remains explicit', () => {
    for (const extra of [{ gauge: 'mm1000' }, { validFrom: '2027-01-01' }, { validUntil: '2025-12-31' }]) {
      const matcher = luzernRailMatcher(network([edge(a, b, extra)]), config, dates)
      expect(matcher.sourceInventory[0].reason).toBeTruthy()
      expect(matcher.match(train([a, b]), stops, route)[0].path).toBeUndefined()
    }
    expect(luzernRailMatcher(network([edge(a, b, { gauge: 'mm1000_1435' })]), config, dates).match(train([a, b]), stops, route)[0].path).toBeTruthy()
  })
  it('rejects distant platform and source topology attachments without increasing thresholds', () => {
    const changed = new Map(stops), moved = { ...stop(a), stop_lat: '47.01' }; changed.set(moved.stop_id, moved)
    expect(luzernRailMatcher(network(), config, dates).match(train([a, b]), changed, route)[0].reason).toBe('rail-station-attachment-too-far')
    const matcher = luzernRailMatcher(network([edge(a, b, { points: [[8, 47.002], b.coordinate] })]), config, dates)
    expect(matcher.sourceInventory[0].reason).toBe('topology-attachment-too-far')
  })
  it('rejects unreviewed route identities, excessive detours and coincident operating points', () => {
    const matcher = luzernRailMatcher(network([edge(a, b, { points: [a.coordinate, [8, 48], b.coordinate] })]), config, dates)
    expect(() => matcher.match(train([a, b]), stops, { ...route, agencyId: '86' })).toThrow('Unreviewed')
    expect(matcher.match(train([a, b]), stops, route)[0].reason).toBe('rail-disconnected-detour-or-stop-order')
    expect(matcher.match(train([a, a]), stops, route)[0].reason).toBe('rail-coincident-operating-points')
  })
})
