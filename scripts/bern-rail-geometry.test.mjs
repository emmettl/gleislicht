import { describe, it, expect } from 'vitest'
import { loadBernRail, bernRailCandidates, bernRailConsensus } from './bern-rail-geometry.mjs'

const rail = await loadBernRail()
const route = { id: '91-4-C-j26-1', agencyId: '33', name: 'S4', mode: 'rail' }
const routes = new Map([[route.id, route]])
const stops = [[7.46273626, 47.0012861, 'Zollikofen', '', 'ch:1:sloid:4410:1:1'],
  [7.4987587, 47.01882908, 'Schönbühl SBB', '', 'ch:1:sloid:8001:1:3']]
const train = { routeId: route.id, agencyId: '33', route: 'S4', directionId: '0', stops: [[0, 0, 0], [1, 600, 600]] }
const raw = { metadata: { serviceDate: '2026-09-04' }, stops, trains: [train] }

describe('Bern reviewed federal rail gaps', () => {
  it('loads the complete pinned source but routes only on three reviewed standard-gauge segments', () => {
    expect(rail.metadata.source.nodes).toBe(3210); expect(rail.metadata.source.segments).toBe(3424)
    expect(rail.metadata.sourceSegments).toHaveLength(3)
    expect(rail.metadata.sourceSegments.every(s => !s.reason && s.gauge === 'mm1435' && s.attachmentMetres < 16)).toBe(true)
    expect(rail.policy.limits.stationAttachmentMetres).toBe(120)
    expect(rail.metadata.source.validOn).toBe(null)
  })
  it('uses exact route and station identities and keeps directed source segment order', () => {
    const candidates = bernRailCandidates(raw, routes, rail), match = [...candidates.values()][0]
    expect(match.path).toBeTruthy(); expect(match.maximumSnapMetres).toBeLessThan(62)
    expect(match.directedSourceSegments.map(s => s.id)).toEqual(['ch14uvag00087657', 'ch14uvag00087656'])
    expect(match.path[0]).toEqual(stops[0].slice(0, 2).map(v => Number(v.toFixed(7))))
    const reverse = { ...raw, trains: [{ ...train, directionId: '1', stops: [...train.stops].reverse() }] }
    expect([...bernRailCandidates(reverse, routes, rail).values()][0].path).toEqual([...match.path].reverse())
    expect(() => bernRailCandidates(raw, new Map([[route.id, { ...route, agencyId: '11' }]]), rail)).toThrow()
    expect(bernRailCandidates({ ...raw, trains: [{ ...train, routeId: 'unreviewed' }] }, routes, rail).size).toBe(0)
    expect(() => bernRailCandidates({ ...raw, metadata: { serviceDate: '2026-12-06' } }, routes, rail)).toThrow('Unreviewed Bern rail date')
    const distant = { ...raw, stops: [[7, 47, ...stops[0].slice(2)], stops[1]] }
    // A fresh matcher prevents an intentionally mutated fixture from reusing a
    // full-pattern cache keyed by immutable source stop identities.
    return loadBernRail().then(fresh => expect([...bernRailCandidates(distant, routes, fresh).values()][0].path).toBeUndefined())
  })
  it('rejects a directed pair if any complete-pattern context fails or chooses a different path', () => {
    const ok = { patternId: 'a', assessment: { path: [[7, 47], [7.1, 47.1]] } }
    expect(bernRailConsensus([ok, { patternId: 'b', assessment: { reason: 'rail-disconnected-detour-or-stop-order' } }]).path).toBeUndefined()
    expect(bernRailConsensus([ok, { patternId: 'b', assessment: { path: [[7, 47], [7.05, 47.2], [7.1, 47.1]] } }]).reason).toBe('different-full-pattern-paths')
    expect(bernRailConsensus([ok, { ...ok, patternId: 'b' }]).railPatternIds).toEqual(['a', 'b'])
  })
  it('keeps later calls blocked while matching an earlier missing pair', async () => {
    const junction = [7.465887, 47.00769, 'Zollikofen Nord (Abzw)', '', 'ch:1:sloid:15371']
    const otherContext = { ...train, stops: [...train.stops, [2, 900, 900]] }
    const candidates = bernRailCandidates({ ...raw, stops: [...stops, junction], trains: [train, otherContext] }, routes, await loadBernRail())
    const candidate = [...candidates.values()][0]
    expect(candidate.contexts).toHaveLength(2)
    expect(candidate.reason).toBe('rejected-full-pattern-context')
    expect(candidate.contextReason).toBe('rail-disconnected-detour-or-stop-order')
    expect(candidate.path).toBeUndefined()
  })
})
