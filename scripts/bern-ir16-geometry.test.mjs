import { it, expect } from 'vitest'
import { loadBernIr16 } from './bern-ir16-geometry.mjs'
import { bernRailCandidates } from './bern-rail-geometry.mjs'
const rail = await loadBernIr16()
const original = [[8.53672608,47.37920422,'Zürich HB','15','ch:1:sloid:3000:8:15'],[8.30726042,47.47599724,'Baden','3','ch:1:sloid:3504:2:3'],[8.2094249,47.48104259,'Brugg AG','4','ch:1:sloid:309:3:4'],[8.05159989,47.39104625,'Aarau','5','ch:1:sloid:2113:3:5'],[7.90794131,47.35220757,'Olten','8','ch:1:sloid:218:5:8'],[7.4333344,46.94822398,'Bern','49','ch:1:sloid:7000:55:49']]
const route = { id: '91-16-B-j26-1', agencyId: '11', line: 'IR16', name: 'IR16', mode: 'rail' }
const stops = new Map(original.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
const train = { routeId: route.id, directionId: '0', calls: original.map(s => ({ id: s[4] })) }
it('pins source geometry, bounded Zürich terminal projections and the Bern eastern spur', () => {
  expect(rail.policy.routes[0].pairs).toHaveLength(30)
  expect(rail.metadata.sourceSegments).toHaveLength(58)
  expect(rail.metadata.sourceSegments.every(s => !s.reason && s.gauge === 'mm1435' && s.attachmentMetres <= 120)).toBe(true)
  for (const e of rail.metadata.zurichTerminalEvidence) {
    expect(e.sourceSegmentId).toBe('ch14uvag00088173')
    expect(e.projection.attachmentMetres).toBeLessThan(35)
    expect(e.projection.removedMetres).toBeGreaterThan(280)
    expect(e.projection.removedMetres).toBeLessThan(291)
  }
  expect(rail.metadata.bernTerminalEvidence.sourceCurveId).toBe('ch14uvag00087328')
  expect(rail.metadata.bernTerminalEvidence.easternApproachId).toBe('ch14uvag00139673')
  expect(rail.metadata.bernTerminalEvidence.retainedMetres).toBeCloseTo(430.7005, 3)
})
it('routes both complete directions without changing original call coordinates', () => {
  const forward = rail.matcher.matchPattern(train, stops, route)
  const reverse = rail.matcher.matchPattern({ ...train, directionId: '1', calls: [...train.calls].reverse() }, stops, route)
  expect(forward.every(r => r.path && r.stationAttachmentsMetres.every(m => m <= 120))).toBe(true)
  for (let i = 0; i < forward.length; i++) {
    expect(forward[i].path[0]).toEqual(original[i].slice(0, 2))
    expect(forward[i].path.at(-1)).toEqual(original[i + 1].slice(0, 2))
    expect(reverse[4 - i].path).toEqual([...forward[i].path].reverse())
  }
  expect(forward[0].directedSourceSegments[0].id).toBe('ch14uvag00088173:zurich-terminal:15')
  expect(forward.at(-1).directedSourceSegments.at(-1).id).toBe('bern:ir16-terminal:49:inferred-station-spur')
})
it('rejects cropped, reordered or through-station patterns and unknown platform variants', () => {
  for (const calls of [train.calls.slice(1), [train.calls[1], train.calls[0], ...train.calls.slice(2)], [...train.calls, train.calls[0]],
    [{ id: 'ch:1:sloid:3000:501:33' }, ...train.calls.slice(1)]]) {
    expect(rail.matcher.matchPattern({ ...train, calls }, stops, route).every(r => !r.path)).toBe(true)
  }
  expect(() => rail.matcher.matchPattern(train, stops, { ...route, line: 'IC5' })).toThrow()
  const raw = { metadata: { serviceDate: '2026-12-06' }, stops: original, trains: [{ ...train, stops: original.map((_, i) => [i]) }] }
  expect(() => bernRailCandidates(raw, new Map([[route.id, route]]), rail)).toThrow('Unreviewed Bern rail date')
})
it('rechecks original terminal coordinates before using a cached pattern', () => {
  rail.matcher.matchPattern(train, stops, route)
  for (const i of [0, 5]) {
    const id = original[i][4], changed = new Map(stops)
    changed.set(id, { ...changed.get(id), stop_lon: changed.get(id).stop_lon + .001 })
    expect(() => rail.matcher.matchPattern(train, changed, route)).toThrow('Changed reviewed IR16 terminal coordinates')
  }
})
