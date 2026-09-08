import { beforeAll, describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadSolothurnRailReview } from './solothurn-rail-review.mjs'
import { loadZugRail } from './zug-rail-geometry.mjs'
const context = JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz')))
const config = JSON.parse(readFileSync('data/solothurn-supplement-policy.json')).rail
const routes = new Map(context.routes.map(r => [r.id, r]))
let review, rail
beforeAll(async () => {
  const dates = context.snapshots.map(d => d.metadata.serviceDate)
  review = await loadSolothurnRailReview(config, dates); rail = await loadZugRail(config, dates)
})
const original = (t, d, r) => rail.matchPattern({ ...t, calls: t.stops.map(([i]) => ({ id: d.stops[i][4] })) },
  new Map(d.stops.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }])), { ...r, line: r.name })
describe('Solothurn Interlaken platform-group crosswalk', () => {
  it('routes every observed IC61/ICE/IC81 Interlaken West–Ost pair in its full seasonal context, preserving successful paths', () => {
    const directions = new Set(), platforms = new Set(); let checked = 0, ic81 = 0
    for (const d of context.snapshots) for (const t of d.trains) {
      const r = routes.get(t.routeId)
      if (!review.metadata.policy.routes.some(p => p.routeId === r.id)) continue
      const before = original(t, d, r), after = review.matchPattern(t, d.stops, r, before)
      for (let i = 0; i < before.length; i++) {
        if (before[i].path) expect(after[i]).toBe(before[i])
        const a = d.stops[t.stops[i][0]], b = d.stops[t.stops[i + 1][0]]
        if (![a[2], b[2]].includes('Interlaken Ost') || ![a[2], b[2]].includes('Interlaken West')) continue
        expect(after[i].path).toBeDefined()
        expect(after[i].directedSourceSegments.some(s => s.id === 'ch14uvag00087489')).toBe(true)
        expect(after[i].path[0]).toEqual(a.slice(0, 2)); expect(after[i].path.at(-1)).toEqual(b.slice(0, 2))
        expect(Math.max(...after[i].stationAttachmentsMetres)).toBeLessThan(350)
        directions.add(`${a[2]}→${b[2]}`); platforms.add(a[2] === 'Interlaken Ost' ? a[3] : b[3]); checked++; if (r.name === 'IC81') ic81++
      }
    }
    expect(ic81).toBe(5); expect(checked).toBeGreaterThan(20); expect(directions.size).toBe(2); expect([...platforms].sort()).toEqual(['5', '7'])
  })
  it('rejects unreviewed route/operator/platform identities and detects changed original platform coordinates', () => {
    const d = context.snapshots.find(d => d.trains.some(t => t.routeId === '91-61-A-j26-1' && t.stops.some(([i]) => d.stops[i][2] === 'Interlaken Ost')))
    const t = d.trains.find(t => t.routeId === '91-61-A-j26-1' && t.stops.some(([i]) => d.stops[i][2] === 'Interlaken Ost')), r = routes.get(t.routeId)
    const before = original(t, d, r)
    for (const changed of [{ ...r, agencyId: '33' }, { ...r, id: 'unreviewed' }, { ...r, mode: 'bus' }]) expect(review.matchPattern(t, d.stops, changed, before)).toBe(before)
    const unknown = structuredClone(d.stops), i = t.stops.find(([i]) => d.stops[i][2] === 'Interlaken Ost')[0]
    unknown[i][4] = 'ch:1:sloid:7492:0:unknown'
    expect(review.matchPattern(t, unknown, r, before)).toBe(before)
    for (const field of [0, 3]) {
      const changed = structuredClone(d.stops); changed[i][field] = field === 0 ? changed[i][field] + .001 : '2'
      expect(() => review.matchPattern(t, changed, r, before)).toThrow('Changed reviewed Interlaken platform')
    }
  })
})
