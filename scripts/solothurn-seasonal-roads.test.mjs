import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadSolothurnAccessRoads } from './solothurn-access-roads.mjs'
const context = JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz')))
const policyPath = 'data/solothurn-seasonal-road-policy.json'
describe('Solothurn seasonal service-road review', () => {
  it('replays all 50 full contexts and only the five reviewed unanimous pairs, retaining two EV1 disagreements', async () => {
    const review = await loadSolothurnAccessRoads(context, { verifyEvidence: true, policyPath })
    expect(review.metadata.patterns).toBe(50); expect(review.metadata.matcherIssues).toEqual([])
    expect(review.metadata.maximumImportedSnapMetres).toBeLessThan(20)
    expect(review.pairs.size).toBe(5)
    const stops = new Map(context.snapshots.flatMap(d => d.stops.map(s => [s[4], s])))
    for (const pair of review.policy.pairs) {
      const route = context.routes.find(r => r.id === pair.routeId), from = stops.get(pair.fromId), to = stops.get(pair.toId), previous = { reason: 'old-failure' }
      const value = review.match(route, from, to, previous)
      expect(value.geometrySource).toBe('osm-solothurn-seasonal-road-inference')
      expect(value.roadPatternIds).toEqual(pair.roadPatternIds)
      expect(value.path[0]).toEqual(from.slice(0, 2).map(n => +n.toFixed(7)))
      expect(value.path.at(-1)).toEqual(to.slice(0, 2).map(n => +n.toFixed(7)))
      const old = { path: [[1, 2], [3, 4]] }; expect(review.match(route, from, to, old)).toBe(old)
      expect(review.match({ ...route, agencyId: 'other' }, from, to, previous)).toBe(previous)
      expect(review.match(route, [...from.slice(0, 4), 'unknown'], to, previous)).toBe(previous)
      expect(() => review.match(route, [from[0] + .001, ...from.slice(1)], to, previous)).toThrow('Changed access-road stop coordinate')
    }
    for (const [from, to] of [['ch:1:sloid:82651', 'ch:1:sloid:90406'], ['ch:1:sloid:88650', 'ch:1:sloid:2996']]) {
      const key = JSON.stringify(['92-A01-T-j26-1', from, to])
      expect(review.all.get(key).reason).toBe('road-pattern-dependent-path'); expect(review.pairs.has(key)).toBe(false)
    }
  })
})
