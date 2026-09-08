import { describe, it, expect } from 'vitest'
import { aargauRailMatcher, railStopNumber } from './aargau-rail-geometry.mjs'
const node = (id, number, x, y = 47) => ({ id, number, coordinate: [x, y] })
const nodes = [node('a', '8500001', 8), node('b', '8500002', 8.01), node('c', '8500003', 8.02), node('d', '8500004', 8.01, 47.005)]
const segment = (a, b, id = a + b) => ({ id, start: a, end: b, points: [nodes.find(n => n.id === a).coordinate, nodes.find(n => n.id === b).coordinate] })
const network = (segments = [segment('a', 'b'), segment('b', 'c')]) => ({ nodes: new Map(nodes.map(n => [n.id, n])), segments })
const stops = nodes.map(n => [...n.coordinate, n.id, '', `ch:1:sloid:${Number(n.number.slice(2))}:1:1`])
const policy = { routes: [{ routeId: 's36', agencyId: '65', line: 'S36' }] }
const train = indices => ({ routeId: 's36', agencyId: '65', route: 'S36', category: 'rail', directionId: '0', stops: indices.map(i => [i, 0, 0]) })
describe('Aargau scoped FOT fallback', () => {
  it('resolves only explicit Swiss or foreign operating-point IDs', () => {
    expect(railStopNumber('ch:1:sloid:1_gen:ch:1:sloid:1:1:1_pf:1A')).toBe('8500001')
    expect(railStopNumber('8014474_gen:missingSLOID_pf:5')).toBe('8014474')
    expect(railStopNumber('similar-name')).toBeUndefined()
  })
  it('preserves directed source order and exact platform coordinates in both directions', () => {
    const matcher = aargauRailMatcher(network(), policy), shifted = structuredClone(stops); shifted[0][1] += .0001
    const forward = matcher.matchPattern(train([0, 1, 2]), shifted), reverse = matcher.matchPattern(train([2, 1, 0]), shifted)
    expect(forward.map(s => s.directedSourceSegments[0])).toEqual([{ id: 'ab', from: 'a', to: 'b' }, { id: 'bc', from: 'b', to: 'c' }])
    expect(reverse[1].path).toEqual([...forward[0].path].reverse())
    expect(forward[0].path[0]).toEqual(shifted[0].slice(0, 2))
  })
  it('does not apply a rail route to another agency, mode or line', () => {
    const matcher = aargauRailMatcher(network(), policy)
    for (const change of [{ agencyId: '11' }, { category: 'bus' }, { route: 'S6' }, { routeId: 'other' }]) expect(matcher.matchPattern({ ...train([0, 1]), ...change }, stops)).toBeUndefined()
  })
  it('blocks a shortcut through a later scheduled call and finds the valid alternative', () => {
    const matcher = aargauRailMatcher(network([segment('a', 'b'), segment('b', 'c'), segment('a', 'd'), segment('d', 'c')]), policy)
    const result = matcher.matchPattern(train([0, 2, 1]), stops)
    expect(result[0].directedSourceSegments.map(e => e.id)).toEqual(['ad', 'dc'])
    expect(result[1].directedSourceSegments[0]).toEqual({ id: 'bc', from: 'c', to: 'b' })
  })
  it('leaves out-of-order, disconnected and coincident segments unresolved', () => {
    const matcher = aargauRailMatcher(network(), policy)
    expect(matcher.matchPattern(train([0, 2, 1]), stops)[0].railFailure).toContain('stop-order')
    expect(matcher.matchPattern(train([0, 3]), stops)[0].path).toBeUndefined()
    expect(matcher.matchPattern(train([0, 0]), stops)[0].railFailure).toBe('coincident-operating-points')
  })
  it('rejects distant, ambiguous and missing identities even beside a rail line', () => {
    const changed = structuredClone(stops); changed[0][4] = 'ch:1:sloid:99:1:1'
    expect(aargauRailMatcher(network(), policy).matchPattern(train([0, 1]), changed)[0].railFailure).toBe('no-exact-operating-point')
    changed[0] = [...stops[0]]; changed[0][1] += .01
    expect(aargauRailMatcher(network(), policy).matchPattern(train([0, 1]), changed)[0].railFailure).toBe('station-attachment-too-far')
    const n = network(); n.nodes.set('duplicate', { ...nodes[0], id: 'duplicate' })
    expect(aargauRailMatcher(n, policy).matchPattern(train([0, 1]), stops)[0].railFailure).toBe('ambiguous-operating-point')
  })
  it('rejects malformed topology attachments and excessive detours', () => {
    const n = network(); n.segments[0].points = [[9, 48], stops[1].slice(0, 2)]
    const matcher = aargauRailMatcher(n, policy)
    expect(matcher.rejectedSourceSegments).toHaveLength(1)
    expect(matcher.matchPattern(train([0, 1]), stops)[0].path).toBeUndefined()
    const detour = network([segment('a', 'b')]); detour.segments[0].points.splice(1, 0, [8, 48])
    expect(aargauRailMatcher(detour, policy).matchPattern(train([0, 1]), stops)[0].path).toBeUndefined()
  })
})
