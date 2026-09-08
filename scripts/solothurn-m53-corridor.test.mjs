import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadSolothurnAccessRoads } from './solothurn-access-roads.mjs'
import { loadSolothurnM53, solothurnM53Matcher } from './solothurn-m53-corridor.mjs'
const json = p => JSON.parse(readFileSync(p))
const policy = json('data/solothurn-m53-policy.json'), feature = json(`${policy.sourceDirectory}/bern-9353.json`)
const context = JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz')))

describe('Solothurn M53 official night-line corridor', () => {
  it('replays the original Bern feature and all retained complete contexts, preserving both road alternatives', async () => {
    const access = await loadSolothurnAccessRoads(context), before = JSON.stringify(feature)
    const m = await loadSolothurnM53(context, access)
    expect(m.patterns.map(p => p.stops.length).sort()).toEqual([43, 44])
    expect(m.result.pathMetres).toBeGreaterThan(847); expect(m.result.pathMetres).toBeLessThan(848)
    expect(m.result.maximumSnapMetres).toBeLessThan(30)
    expect(m.original.reason).toBe('road-pattern-dependent-path')
    expect(JSON.parse(JSON.stringify(m.metadata))).toEqual(m.metadata)
    expect(m.metadata.roadContextReview.map(r => r.variants.length)).toEqual([2, 2])
    expect(JSON.stringify(feature)).toBe(before)
    expect(m.result.path[0]).toEqual(policy.from.slice(0, 2).map(n => +n.toFixed(7)))
    expect(m.result.path.at(-1)).toEqual(policy.to.slice(0, 2).map(n => +n.toFixed(7)))
  })
  it('rejects changed line identity, altered full-context scope, coordinates and widened limits', async () => {
    const access = await loadSolothurnAccessRoads(context)
    const changed = structuredClone(feature); changed.properties.tucode = 'Other'
    expect(() => solothurnM53Matcher(changed, policy, context, access)).toThrow('Changed M53 source feature')
    expect(() => solothurnM53Matcher(feature, { ...policy, patternIds: policy.patternIds.slice(1) }, context, access)).toThrow('Changed complete M53 context scope')
    expect(() => solothurnM53Matcher(feature, { ...policy, limits: { ...policy.limits, snapMetres: 120 } }, context, access)).toThrow('unchanged bus limits')
    const m = await loadSolothurnM53(context, access), route = context.routes.find(r => r.id === policy.route.id), old = { reason: 'road-pattern-dependent-path' }
    expect(m.match(route, policy.from, policy.to, old).geometrySource).toBe('bern-official-m53-corridor')
    const prior = { path: [[1, 2], [3, 4]] }; expect(m.match(route, policy.from, policy.to, prior)).toBe(prior)
    for (const r of [{ ...route, agencyId: '894' }, { ...route, id: '92-M51-j26-1' }, { ...route, name: 'M52' }, { ...route, mode: 'rail' }]) expect(m.match(r, policy.from, policy.to, old)).toBe(old)
    expect(m.match(route, policy.to, policy.from, old)).toBe(old)
    expect(() => m.match(route, [policy.from[0] + .001, ...policy.from.slice(1)], policy.to, old)).toThrow('Changed M53 stop coordinate')
  })
})
