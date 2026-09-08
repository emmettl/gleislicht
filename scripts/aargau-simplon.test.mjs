import { expect, test } from 'vitest'
import { loadSimplon, simplonMatcher, simplonGeometry } from './aargau-simplon.mjs'
const loaded = await loadSimplon(), policy = loaded.policy
const train = r => ({ ...r, category: r.mode, route: r.line })
const failure = { railFailure: 'no-exact-operating-point', reason: 'missing-operator-mode-line' }

test('both exact IC 1303 journeys retain the original endpoints and official foreign identity', () => {
  for (const r of policy.rules) {
    const segment = loaded.forDate(r.date).overrideSegment(train(r), r.stops, r.segmentIndex, failure)
    expect(segment.path[0]).toEqual(r.stops.at(-2).slice(0, 2))
    expect(segment.path.at(-1)).toEqual(r.stops.at(-1).slice(0, 2))
    expect(segment.toOperatingPoint).toBe('8301003')
    expect(segment.identityEvidence.comment).toBe('Fahrplan unter 8301003 (Ausland)')
    expect(segment.pathMetres).toBeGreaterThan(40000)
    expect(segment.pathMetres).toBeLessThan(42000)
    expect(Math.max(...segment.trackAttachmentsMetres)).toBeLessThan(35)
    expect(segment.geometrySource).toBe('osm-rail')
  }
})

test('wrong date, identity, calls, direction or coordinates cannot inherit the fallback', () => {
  const r = policy.rules[0], t = train(r), m = loaded.forDate(r.date)
  for (const change of [{ routeId: 'other' }, { sourceTripId: 'other' }, { agencyId: '65' }, { directionId: '1' }, { category: 'bus' }, { shortName: 'other' }, { calls: r.calls.slice(1) }]) expect(m.overrideSegment({ ...t, ...change }, r.stops, r.segmentIndex, failure)).toBe(failure)
  const moved = structuredClone(r.stops); moved.at(-1)[0] += 0.00001
  expect(m.overrideSegment(t, moved, r.segmentIndex, failure)).toBe(failure)
  expect(m.overrideSegment(t, r.stops, 0, failure)).toBe(failure)
  for (const date of ['2026-09-04', '2026-06-27', '2026-04-04']) expect(loaded.forDate(date).overrideSegment(t, r.stops, r.segmentIndex, failure)).toBe(failure)
})

test('prior accepted geometry is preserved and altered inferred paths fail closed', () => {
  const r = policy.rules[0], previous = { path: [[8, 46], [8.1, 46.1]], geometrySource: 'agis' }
  expect(loaded.forDate(r.date).overrideSegment(train(r), r.stops, r.segmentIndex, previous)).toBe(previous)
  const changed = structuredClone(loaded.geometry); changed.path[1][0] += 0.00001
  expect(() => simplonMatcher(policy, changed, r.date).overrideSegment(train(r), r.stops, r.segmentIndex, failure)).toThrow('Changed Simplon geometry')
})

test('a disconnected source is not repaired by relaxing track-attachment limits', async () => {
  const changed = structuredClone(policy); changed.graph.reviewedCrossoverWayIds = []
  await expect(simplonGeometry(changed)).rejects.toThrow('border-disconnected-detour-or-turn')
})
