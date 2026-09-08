import { expect, test } from 'vitest'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadSeasonalGaps, seasonalGapMatcher, seasonalGapSources, SEASONAL_GAP_POLICY } from './aargau-seasonal-gaps.mjs'
import { applyAargauGeometry } from './build-aargau-study.mjs'

const loaded = await loadSeasonalGaps(), policy = loaded.policy
const train = r => ({ agencyId: r.agencyId, routeId: r.routeId, route: r.line, category: r.mode, directionId: r.directionId, calls: r.stops.map(s => [s[4], 0, 0]) })

test('all finite seasonal rules preserve exact endpoints and expose only reviewed segments', () => {
  let count = 0
  for (const rule of policy.rules) {
    const result = loaded.forDate(rule.date).matchPattern(train(rule), rule.stops)
    expect(result.flatMap((s, i) => s ? [i] : [])).toEqual(rule.segments.map(s => s.index).sort((a, b) => a - b))
    for (const [i, s] of result.entries()) if (s) {
      expect(s.path[0]).toEqual(rule.stops[i].slice(0, 2))
      expect(s.path.at(-1)).toEqual(rule.stops[i + 1].slice(0, 2))
      expect(s.seasonalGapRuleId).toBe(rule.id)
      count += rule.occurrences
    }
  }
  expect(count).toBe(583)
})

test('a changed identity, direction, ordered chain or platform coordinate receives no rule', () => {
  for (const kind of ['waldshut', 'seasonal-rail', 'brugg-service-loop', 'bern-platform-49']) {
    const r = policy.rules.find(r => r.kind === kind), m = loaded.forDate(r.date), t = train(r)
    for (const change of [{ agencyId: 'other' }, { routeId: 'other' }, { route: 'other' }, { category: 'other' }, { directionId: 'other' }]) expect(m.matchPattern({ ...t, ...change }, r.stops)).toBeUndefined()
    expect(m.matchPattern(t, [...r.stops].reverse())).toBeUndefined()
    const moved = structuredClone(r.stops); moved[0][0] += 0.00001
    expect(m.matchPattern(t, moved)).toBeUndefined()
    expect(m.matchPattern(t, r.stops.slice(1))).toBeUndefined()
  }
})

test('September, unsampled dates and the announced Waldshut closure cannot inherit seasonal rules', async () => {
  const r = policy.rules.find(r => r.kind === 'waldshut')
  for (const date of ['2026-09-04', '2026-09-06', '2026-07-18', '2026-09-14', '2026-10-02']) expect(loaded.forDate(date).matchPattern(train(r), r.stops)).toBeUndefined()
  // Even an accidentally widened date rule cannot override the closure guard.
  const changed = { rules: [{ ...r, date: '2026-09-14' }] }
  expect(seasonalGapMatcher(changed, await seasonalGapSources(), '2026-09-14').matchPattern(train(r), r.stops)).toBeUndefined()
})

test('tampered geometry or source evidence fails closed', async () => {
  const sources = await seasonalGapSources()
  for (const field of ['pathSha256', 'evidence']) {
    const changed = JSON.parse(await readFile(SEASONAL_GAP_POLICY, 'utf8'))
    const r = changed.rules.find(r => r.kind === 'seasonal-rail')
    r.segments[0][field] = field === 'pathSha256' ? 'changed' : {}
    expect(() => seasonalGapMatcher(changed, sources, r.date).matchPattern(train(r), r.stops)).toThrow(/Changed reviewed seasonal/)
  }
})

test('Brig to Domodossola remains explicitly excluded without a foreign operating point', async () => {
  const { network } = await seasonalGapSources()
  expect([...network.nodes.values()].filter(n => n.number === '8301003')).toHaveLength(0)
  expect(policy.rules.some(r => r.stops.some(s => s[4] === '8301003'))).toBe(false)
})

test('seasonal evidence tolerates platform rounding but rejects changed measurements and source identities', async () => {
  const sources = await seasonalGapSources()
  const original = policy.rules.find(r => r.kind === 'seasonal-rail' && r.segments.some(s => s.evidence.stationAttachmentsMetres))
  for (const change of ['rounding', 'distance', 'source']) {
    const rule = structuredClone(original)
    const evidence = rule.segments.find(s => s.evidence.stationAttachmentsMetres).evidence
    if (change === 'source') evidence.directedSourceSegments[0].id = 'changed'
    else evidence.stationAttachmentsMetres[1] += change === 'rounding' ? 1e-12 : 1e-6
    const match = () => seasonalGapMatcher({ rules: [rule] }, sources, rule.date).matchPattern(train(rule), rule.stops)
    if (change === 'rounding') expect(match().some(Boolean)).toBe(true)
    else expect(match).toThrow(/Changed reviewed seasonal source evidence/)
  }
})

test('new-route fallback evidence survives an exact JSON round trip when no earlier rail policy applied', async () => {
  const raw = JSON.parse(gunzipSync(await readFile('data/aargau-seasonal/input/2026-04-03-timetable.json.gz')))
  raw.trains = raw.trains.filter(t => t.routeId === '91-5F-Y-j26-1')
  expect(raw.trains).toHaveLength(2)
  const result = applyAargauGeometry(raw, new Map(), [], undefined, undefined, undefined, loaded.forDate('2026-04-03'))
  expect(result.patterns.every(p => p.completeGeometry)).toBe(true)
  expect(JSON.parse(JSON.stringify(result.patterns))).toEqual(result.patterns)
  expect(result.patterns.every(p => p.segments.every(s => !Object.hasOwn(s, 'priorPlatformRejection')))).toBe(true)
})
