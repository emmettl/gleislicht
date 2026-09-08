import { it, expect } from 'vitest'
import { loadBernRegionalRail } from './bern-regional-rail.mjs'
import { bernRailCandidates } from './bern-rail-geometry.mjs'
const rail = await loadBernRegionalRail()
it('pins 131 directed platform bindings and retains thirteen reviewed exclusions', () => {
  expect(rail.policy.routes).toHaveLength(9)
  const pairs = rail.policy.routes.flatMap(r => r.pairs)
  expect(pairs).toHaveLength(131)
  expect(pairs.filter(p => !p.sourceSegments.length)).toHaveLength(13)
  expect(rail.metadata.sourceSegments).toHaveLength(167)
  expect(rail.metadata.sourceSegments.every(s => !s.reason && s.gauge === 'mm1435' && s.attachmentMetres < 51)).toBe(true)
})
it('requires the reviewed directed platform identities as well as station and line identities', () => {
  const route = { id: '91-5-j26-1', agencyId: '33', name: 'S5', mode: 'rail' }
  const stops = [[6.93534434, 46.99665438, 'Neuchâtel', '1', 'ch:1:sloid:4221:1:1'], [6.98468879, 47.01210414, 'St-Blaise-Lac', '', 'ch:1:sloid:4480']]
  const raw = { metadata: { serviceDate: '2026-09-04' }, stops, trains: [{ routeId: route.id, directionId: '0', stops: [[0], [1]] }] }
  const routes = new Map([[route.id, route]])
  const match = [...bernRailCandidates(raw, routes, rail).values()][0]
  expect(match.path).toBeTruthy()
  expect(match.directedSourceSegments.map(s => s.id)).toEqual(['ch14uvag00087170', 'ch14uvag00087215'])
  const altered = structuredClone(raw); altered.stops[0][4] = 'ch:1:sloid:4221:unreviewed-platform'
  expect(bernRailCandidates(altered, routes, rail).size).toBe(0)
  expect(() => bernRailCandidates(raw, new Map([[route.id, { ...route, name: 'S55' }]]), rail)).toThrow()
  expect(() => bernRailCandidates({ ...raw, metadata: { serviceDate: '2026-12-06' } }, routes, rail)).toThrow('Unreviewed Bern rail date')
})
it('keeps the original Morges platform beyond the 120 m guard excluded', () => {
  const route = { id: '91-15-B-j26-1', agencyId: '11', name: 'IR15', mode: 'rail' }
  const stops = [[6.49522375, 46.51194644, 'Morges', '1', 'ch:1:sloid:1037:1:1'], [6.23574538, 46.38429444, 'Nyon', '1', 'ch:1:sloid:1030:1:1']]
  const raw = { metadata: { serviceDate: '2026-09-04' }, stops, trains: [{ routeId: route.id, directionId: '0', stops: [[0], [1]] }] }
  const match = [...bernRailCandidates(raw, new Map([[route.id, route]]), rail).values()][0]
  expect(match.path).toBeUndefined(); expect(match.contextReason).toBe('rail-station-attachment-too-far')
  expect(match.contexts[0].assessment.stationAttachmentsMetres[0]).toBeGreaterThan(134)
  expect(rail.policy.limits.stationAttachmentMetres).toBe(120)
})
