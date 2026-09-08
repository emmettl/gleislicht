import { it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadBernIc61Platforms, bernIc61StationVariant } from './bern-ic61-platforms.mjs'
import { parseZugRail } from './zug-rail-geometry.mjs'
import { bernRailCandidates } from './bern-rail-geometry.mjs'
const rail = await loadBernIc61Platforms(), policy = rail.policy
const parsed = parseZugRail(gunzipSync(await readFile(`${policy.sourceDirectory}/network.xtf.gz`)).toString(), 0)
const route = { id: '91-61-A-j26-1', agencyId: '11', line: 'IC61', mode: 'rail' }
const stops = new Map(policy.originalStops.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
const train = p => ({ routeId: route.id, directionId: p.directionId, calls: p.stopIds.map(id => ({ id })) })
it('preserves original graph and nodes while deriving bounded Bern return sections and Basel terminals', () => {
  const original = JSON.stringify([...parsed.nodes]), segments = JSON.stringify(parsed.segments)
  for (const bern of policy.bern.stops) for (const basel of policy.basel.stops) {
    const v = bernIc61StationVariant(parsed, policy, bern, basel)
    expect(v.network.nodes.get(policy.bern.node.id)).toEqual(policy.bern.node)
    expect(v.network.nodes.get(policy.basel.node.id)).toEqual(policy.basel.node)
    const [b, bs] = v.evidence
    expect(b.retainedMetres).toBeGreaterThan(100); expect(b.retainedMetres).toBeLessThan(200)
    expect(b.projection.attachmentMetres).toBeLessThan(14)
    expect(bs.projection.removedMetres).toBeGreaterThan(200); expect(bs.projection.removedMetres).toBeLessThan(300)
    expect(v.network.segments.filter(s => [s.start, s.end].includes(policy.bern.node.id)).map(s => s.id).sort()).toEqual([b.spurId, policy.bern.easternApproach.id].sort())
    expect(v.network.segments.filter(s => [s.start, s.end].includes(policy.basel.node.id))).toEqual([])
  }
  expect(JSON.stringify([...parsed.nodes])).toBe(original); expect(JSON.stringify(parsed.segments)).toBe(segments)
  expect(() => bernIc61StationVariant(parsed, policy, null, [...policy.basel.stops[0].slice(0, 3), '14', 'unreviewed'])).toThrow('Unreviewed Basel platform')
  const changed = { ...parsed, segments: parsed.segments.map(s => s.id === policy.bern.stationCurve.id ? { ...s, gauge: 'mm1000' } : s) }
  expect(() => bernIc61StationVariant(changed, policy, policy.bern.stops[0])).toThrow('Changed reviewed Bern source curve')
})
it('checks all 59 full directed contexts, retaining exact endpoints and the remaining attachment failures', () => {
  let success = 0, failures = 0
  for (const p of policy.originalPatterns) {
    const results = rail.matcher.matchPattern(train(p), stops, route)
    results.forEach((r, i) => {
      if (r.path) {
        success++
        expect(r.path[0]).toEqual(policy.originalStops.find(s => s[4] === p.stopIds[i]).slice(0, 2))
        expect(r.path.at(-1)).toEqual(policy.originalStops.find(s => s[4] === p.stopIds[i + 1]).slice(0, 2))
      } else { failures++; expect(r.reason).toBe('rail-station-attachment-too-far') }
    })
  }
  expect(success).toBeGreaterThan(200); expect(failures).toBeGreaterThan(0)
  expect(rail.metadata.stationEvidence).toHaveLength(10)
  expect(policy.documents).toHaveLength(2)
})
it('rejects cropped, reversed, unknown-platform and changed-coordinate contexts before cache reuse', () => {
  const t = train(policy.originalPatterns[0]); rail.matcher.matchPattern(t, stops, route)
  for (const calls of [t.calls.slice(-2), [...t.calls].reverse(), [...t.calls, t.calls[0]], t.calls.map((c, i) => i ? c : { id: 'unknown' })]) expect(rail.matcher.matchPattern({ ...t, calls }, stops, route).every(r => !r.path)).toBe(true)
  expect(() => rail.matcher.matchPattern({ ...t, routeId: 'IC6' }, stops, route)).toThrow()
  for (const id of t.calls.map(c => c.id)) {
    const changed = new Map(stops); changed.set(id, { ...changed.get(id), stop_lat: changed.get(id).stop_lat + .001 })
    expect(() => rail.matcher.matchPattern(t, changed, route)).toThrow('Changed IC61 original station-context coordinates')
  }
  expect(() => bernRailCandidates({ metadata: { serviceDate: '2026-12-06' }, stops: [], trains: [] }, new Map(), rail)).toThrow('Unreviewed Bern rail date')
})
