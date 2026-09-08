import { it, expect } from 'vitest'
import { loadBernInterlaken } from './bern-interlaken-geometry.mjs'
import { loadBernCrosscantonRail } from './bern-crosscanton-rail.mjs'
import { bernRailCandidates } from './bern-rail-geometry.mjs'
const rail = await loadBernInterlaken(), policy = rail.policy
const route = { id: '91-8-L-j26-1', agencyId: '33', name: 'RE8', line: 'RE8', mode: 'rail' }
const stops = new Map(policy.originalStops.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
const train = p => ({ routeId: route.id, directionId: p.directionId, calls: p.stopIds.map(id => ({ id })) })
it('retains only the original standard-gauge West–Ost curve and explicit tracks 5–8 node', () => {
  expect(rail.metadata.sourceSegments).toHaveLength(1)
  expect(rail.metadata.sourceSegments[0]).toMatchObject({ id: 'ch14uvag00087489', gauge: 'mm1435', infrastructureOperator: 'BLS' })
  expect(policy.interlaken.curve.points).toHaveLength(183)
  expect(policy.interlaken.targetNode.number).toBe('8519309')
  expect(policy.interlaken.excludedPlatformGroups.map(n => n.number)).toEqual(['8515183', '8519310'])
  expect(rail.metadata.sourceSegments.some(s => s.id === policy.interlaken.excludedDepotCurve)).toBe(false)
  expect(policy.limits.stationAttachmentMetres).toBe(120)
})
it('resolves both dated directions without changing original endpoints or source vertex order', async () => {
  const previous = await loadBernCrosscantonRail()
  for (const p of policy.originalPatterns) {
    const t = train(p), results = rail.matcher.matchPattern(t, stops, route)
    const index = p.stopIds.findIndex(id => id.includes(':7492:'))
    const i = index === 0 ? 0 : index - 1, r = results[i]
    expect(results.filter(r => r.path)).toHaveLength(1)
    expect(r.path[0]).toEqual(policy.originalStops.find(s => s[4] === p.stopIds[i]).slice(0, 2))
    expect(r.path.at(-1)).toEqual(policy.originalStops.find(s => s[4] === p.stopIds[i + 1]).slice(0, 2))
    const vertices = index === 0 ? [...policy.interlaken.curve.points].reverse() : policy.interlaken.curve.points
    let cursor = 0
    for (const point of r.path) if (JSON.stringify(point) === JSON.stringify(vertices[cursor])) cursor++
    expect(cursor).toBe(vertices.length)
    expect(Math.max(...r.stationAttachmentsMetres)).toBeLessThan(65)
    expect(r.maximumTopologyAttachmentMetres).toBeLessThan(10)
    expect(previous.matcher.matchPattern(t, stops, route)[i].path).toBeUndefined()
  }
})
it('rejects shortened, reordered, repeated and other-platform contexts and wrong identities/dates', () => {
  const t = train(policy.originalPatterns[0])
  for (const calls of [t.calls.slice(-2), [...t.calls].reverse(), [...t.calls, t.calls.at(-1)],
    t.calls.map((c, i) => i === t.calls.length - 1 ? { id: 'ch:1:sloid:7492:0:460848' } : c),
    t.calls.map((c, i) => i === t.calls.length - 1 ? { id: '8515183' } : c)]) {
    expect(rail.matcher.matchPattern({ ...t, calls }, stops, route).every(r => !r.path)).toBe(true)
  }
  for (const changed of [{ agencyId: '11' }, { line: 'IC61' }, { mode: 'tram' }]) expect(() => rail.matcher.matchPattern(t, stops, { ...route, ...changed })).toThrow()
  expect(() => rail.matcher.matchPattern({ ...t, routeId: '91-61-A-j26-1' }, stops, route)).toThrow()
  expect(() => bernRailCandidates({ metadata: { serviceDate: '2026-12-06' }, stops: [], trains: [] }, new Map(), rail)).toThrow('Unreviewed Bern rail date')
})
it('rechecks coordinates of every original call before reusing cached geometry', () => {
  for (const p of policy.originalPatterns) {
    const t = train(p); rail.matcher.matchPattern(t, stops, route)
    for (const id of p.stopIds) {
      const changed = new Map(stops); changed.set(id, { ...changed.get(id), stop_lon: changed.get(id).stop_lon + .001 })
      expect(() => rail.matcher.matchPattern(t, changed, route)).toThrow('Changed reviewed RE8 source coordinates')
    }
  }
})
