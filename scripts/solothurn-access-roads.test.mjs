import { beforeAll, describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadSolothurnAccessRoads } from './solothurn-access-roads.mjs'
const context = JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz')))
const routes = new Map(context.routes.map(r => [r.id, r])), stops = new Map(context.snapshots.flatMap(d => d.stops.map(s => [s[4], s])))
let access
beforeAll(async () => { access = await loadSolothurnAccessRoads(context, { verifyEvidence: true }) })
describe('Solothurn service-road review', () => {
  it('reproduces 72 complete patterns from raw matcher output and confines admission to six agreed pairs', () => {
    expect(access.metadata.patterns).toBe(72); expect(access.metadata.matcherIssues).toEqual([])
    expect(access.metadata.maximumImportedSnapMetres).toBeLessThan(25)
    expect(access.pairs.size).toBe(6)
    for (const review of access.policy.pairs) {
      const route = routes.get(review.routeId), a = stops.get(review.fromId), b = stops.get(review.toId)
      const result = access.match(route, a, b, { reason: 'previously-excluded' })
      expect(result.path).toBeDefined(); expect(result.agencyId).toBe(route.agencyId)
      expect(result.roadPatternIds.length).toBeGreaterThan(0)
      expect(result.path[0]).toEqual(a.slice(0, 2).map(n => +n.toFixed(7)))
      expect(result.path.at(-1)).toEqual(b.slice(0, 2).map(n => +n.toFixed(7)))
    }
    const liestal = access.pairs.get(JSON.stringify(['96-131-1-j26-1', 'ch:1:sloid:3662:0:869147', 'ch:1:sloid:72212:1:4']))
    expect(liestal.roadPatternIds).toHaveLength(3); expect(liestal.lengthMetres).toBeGreaterThan(530); expect(liestal.lengthMetres).toBeLessThan(540)
    for (const id of ['92-501-A-j26-1', '92-EV4-M-j26-1', '92-M53-j26-1', '96-131-8-j26-1']) {
      expect([...access.pairs.keys()].some(k => JSON.parse(k)[0] === id)).toBe(false)
      expect([...access.all].some(([k, v]) => JSON.parse(k)[0] === id && !v.path)).toBe(true)
    }
  })
  it('preserves successes and rejects wrong route/operator/mode, changed coordinates and incomplete context scope', async () => {
    const review = access.policy.pairs[0], route = routes.get(review.routeId), a = stops.get(review.fromId), b = stops.get(review.toId), old = { reason: 'old-failure' }
    for (const r of [{ ...route, id: 'other' }, { ...route, agencyId: '37' }, { ...route, mode: 'tram' }]) expect(access.match(r, a, b, old)).toBe(old)
    expect(access.match(route, b, a, old)).toBe(old)
    const success = { path: [a.slice(0, 2), b.slice(0, 2)] }
    expect(access.match(route, a, b, success)).toBe(success)
    expect(() => access.match(route, [a[0] + .001, ...a.slice(1)], b, old)).toThrow('Changed access-road stop coordinate')
    const missing = structuredClone(context)
    for (const d of missing.snapshots) d.trains = d.trains.filter(t => t.routeId !== review.routeId)
    await expect(loadSolothurnAccessRoads(missing)).rejects.toThrow('Access-road scope must contain every complete seasonal pattern')
  })
})
