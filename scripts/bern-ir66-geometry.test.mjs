import { it, expect } from 'vitest'
import { loadBernIr66 } from './bern-ir66-geometry.mjs'
const rail = await loadBernIr66()
const route = { id: '91-66-A-j26-1', agencyId: '33', line: 'IR66', mode: 'rail' }
const bern = rail.policy.terminal.stops.find(s => s[3] === '49')
const kerzers = rail.policy.kerzers.stops[0]
const stops = new Map([[bern[4], { stop_id: bern[4], stop_lon: bern[0], stop_lat: bern[1] }],
  [kerzers.stop_id, { stop_id: kerzers.stop_id, stop_lon: kerzers.stop_lon, stop_lat: kerzers.stop_lat }]])
const train = { routeId: route.id, directionId: '0', calls: [{ id: bern[4] }, { id: kerzers.stop_id }] }
it('pins the IR66 source curve and nine bounded terminal projections', () => {
  expect(rail.policy.routes[0].pairs).toHaveLength(41)
  expect(rail.metadata.sourceSegments).toHaveLength(42)
  expect(rail.metadata.sourceSegments.every(s => !s.reason && s.attachmentMetres <= 120)).toBe(true)
  expect(rail.metadata.terminalEvidence).toHaveLength(9)
  for (const e of rail.metadata.terminalEvidence) {
    expect(e.sourceSegmentId).toBe('ch14uvag00087196')
    expect(e.projection.attachmentMetres).toBeLessThanOrEqual(75)
    expect(e.projection.removedMetres).toBeGreaterThanOrEqual(50)
    expect(e.projection.removedMetres).toBeLessThanOrEqual(450)
    expect(e.originalOperatingPoint.coordinate).toEqual([7.439136, 46.948831])
  }
})
it('routes both directions to the exact BLS operating point and preserves original endpoints', () => {
  const forward = rail.matcher.matchPattern(train, stops, route)[0]
  const reverse = rail.matcher.matchPattern({ ...train, directionId: '1', calls: [...train.calls].reverse() }, stops, route)[0]
  expect(forward.fromOperatingPoint).toBe('8507000'); expect(forward.toOperatingPoint).toBe('8516192')
  expect(forward.path[0]).toEqual(bern.slice(0, 2))
  expect(forward.path.at(-1)).toEqual([kerzers.stop_lon, kerzers.stop_lat])
  expect(reverse.path).toEqual([...forward.path].reverse())
  expect(forward.stationAttachmentsMetres.every(m => m < 120)).toBe(true)
  expect(forward.directedSourceSegments[0].id).toBe('ch14uvag00087196:bern-terminal:49')
})
it('refuses through/repeated Bern calls and unknown Bern or Kerzers platforms', () => {
  for (const calls of [[...train.calls, train.calls[0]], [train.calls[1], train.calls[0], train.calls[1]],
    [{ id: 'ch:1:sloid:7000:unknown' }, train.calls[1]], [train.calls[0], { id: 'ch:1:sloid:4400:unknown' }]]) {
    expect(rail.matcher.matchPattern({ ...train, calls }, stops, route).every(r => !r.path && r.reason === 'rail-unreviewed-ir66-platform-context')).toBe(true)
  }
  expect(() => rail.matcher.matchPattern(train, stops, { ...route, agencyId: '11' })).toThrow()
})
it('checks original coordinates even after a pattern has been cached', () => {
  rail.matcher.matchPattern(train, stops, route)
  for (const id of [bern[4], kerzers.stop_id]) {
    const changed = new Map(stops); changed.set(id, { ...changed.get(id), stop_lon: changed.get(id).stop_lon + .001 })
    expect(() => rail.matcher.matchPattern(train, changed, route)).toThrow('Changed original')
  }
})
