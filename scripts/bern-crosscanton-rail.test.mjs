import { it, expect } from 'vitest'
import { loadBernCrosscantonRail } from './bern-crosscanton-rail.mjs'
import { bernRailCandidates } from './bern-rail-geometry.mjs'
const rail = await loadBernCrosscantonRail()
it('pins the six route identities, 45 directed bindings and all twelve source failures', () => {
  expect(rail.policy.routes).toHaveLength(6)
  const pairs = rail.policy.routes.flatMap(r => r.pairs)
  expect(pairs).toHaveLength(45)
  expect(pairs.filter(p => !p.sourceSegments.length)).toHaveLength(12)
  expect(rail.metadata.sourceSegments).toHaveLength(81)
  expect(rail.metadata.sourceSegments.every(s => !s.reason && s.gauge === 'mm1435' && s.attachmentMetres < 51)).toBe(true)
})
it('rejects Fribourg platforms 4/5 and does not authorize unreviewed dates or platform variants', () => {
  const route = { id: '91-20-B-j26-1', agencyId: '53', name: 'S20', mode: 'rail' }
  const stops = [[7.12996434, 46.81677991, 'Givisiez', '1', 'ch:1:sloid:4181:1:1'],
    [7.14911642, 46.80110772, 'Fribourg/Freiburg', '4', 'ch:1:sloid:4100:3:4']]
  const raw = { metadata: { serviceDate: '2026-09-04' }, stops, trains: [{ routeId: route.id, directionId: '0', stops: [[0], [1]] }] }
  const routes = new Map([[route.id, route]])
  const match = [...bernRailCandidates(raw, routes, rail).values()][0]
  expect(match.path).toBeUndefined()
  expect(match.contextReason).toBe('rail-station-attachment-too-far')
  expect(match.contexts[0].assessment.stationAttachmentsMetres[1]).toBeCloseTo(270.82, 2)
  expect(rail.policy.limits.stationAttachmentMetres).toBe(120)
  const altered = structuredClone(raw); altered.stops[1][4] = 'ch:1:sloid:4100:unreviewed-platform'
  expect(bernRailCandidates(altered, routes, rail).size).toBe(0)
  expect(() => bernRailCandidates(raw, new Map([[route.id, { ...route, agencyId: '11' }]]), rail)).toThrow()
  expect(() => bernRailCandidates({ ...raw, metadata: { serviceDate: '2026-12-06' } }, routes, rail)).toThrow('Unreviewed Bern rail date')
})
