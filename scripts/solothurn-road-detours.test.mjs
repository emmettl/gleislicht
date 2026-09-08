import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadSolothurnAccessRoads } from './solothurn-access-roads.mjs'
import { loadSolothurnRoadDetours, solothurnRoadDetourMatcher } from './solothurn-road-detours.mjs'

const json = p => JSON.parse(readFileSync(p))
const context = JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz')))
const policy = json('data/solothurn-road-detour-policy.json')
const osm = JSON.parse(gunzipSync(readFileSync(`${policy.sourceDirectory}/osm.json.gz`)))

describe('Solothurn Liesberg road-detour review', () => {
  it('replays the complete-pattern path and connected directed relation corridor, retaining other exclusions', async () => {
    const access = await loadSolothurnAccessRoads(context, { verifyEvidence: true })
    const m = await loadSolothurnRoadDetours(access), p = m.evidence[0]
    expect(m.pairs.size).toBe(1)
    expect(p.pathMetres).toBeGreaterThan(688); expect(p.pathMetres).toBeLessThan(689)
    expect(p.roadContextOccurrences).toBe(1)
    expect(p.forwardGapMetres).toBeLessThan(18); expect(p.reverseGapMetres).toBeLessThan(6)
    expect(p.sourceFeatures.map(f => f.id)).toEqual([204519958, 204513892])
    expect(m.metadata.exclusions.egerkingen.forwardGapMetres).toBeGreaterThan(170)
    expect(m.metadata.exclusions.arlesheim.nearestTrackMetres).toBeGreaterThan(80)
    expect(access.policy.limits).toEqual({ detourRatio: 3, detourFloorMetres: 600 })
  })
  it('rejects source edits, lost context consensus and a path beyond the exact exception limit', async () => {
    const access = await loadSolothurnAccessRoads(context)
    const changed = structuredClone(osm)
    changed.elements.find(e => e.type === 'way' && e.id === 204519958).nodes.reverse()
    expect(() => solothurnRoadDetourMatcher(changed, policy, access)).toThrow('Changed reviewed road way')
    const shorter = structuredClone(policy); shorter.pairs[0].maximumPathMetres = 680
    expect(() => solothurnRoadDetourMatcher(osm, shorter, access)).toThrow('lacks full-context consensus')
    const scope = structuredClone(policy); scope.pairs[0].roadPatternIds = []
    expect(() => solothurnRoadDetourMatcher(osm, scope, access)).toThrow('Changed full-pattern scope')
    expect(() => solothurnRoadDetourMatcher({ ...osm, remark: 'partial response' }, policy, access)).toThrow('Incomplete')
  })
  it('keeps earlier geometry and original stop identities; no other route, reverse pair or changed coordinate inherits admission', async () => {
    const access = await loadSolothurnAccessRoads(context), m = await loadSolothurnRoadDetours(access)
    const p = policy.pairs[0], route = context.routes.find(r => r.id === p.routeId), old = { reason: 'road-excessive-detour' }
    expect(m.match(route, p.from, p.to, old).path).toBeDefined()
    const success = { path: [[1, 2], [3, 4]] }
    expect(m.match(route, p.from, p.to, success)).toBe(success)
    for (const r of [{ ...route, id: 'other' }, { ...route, agencyId: '793' }, { ...route, name: '119' }, { ...route, mode: 'tram' }]) expect(m.match(r, p.from, p.to, old)).toBe(old)
    expect(m.match(route, p.to, p.from, old)).toBe(old)
    expect(() => m.match(route, [p.from[0] + .001, ...p.from.slice(1)], p.to, old)).toThrow('Changed reviewed bus stop')
    const other = m.metadata.exclusions.egerkingen.review
    expect(m.match(context.routes.find(r => r.id === other.routeId), other.from, other.to, old)).toBe(old)
  })
})
