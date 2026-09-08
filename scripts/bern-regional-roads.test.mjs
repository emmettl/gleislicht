import { describe, it, expect } from 'vitest'
import { loadBernRegionalRoads, BERN_REGIONAL_ROUTES } from './bern-regional-roads.mjs'
import { BERN_URBAN_ROUTES, BERN_ROAD_LIMITS } from './bern-urban-geometry.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
import { BERN_LIMITS } from './bern-line-geometry.mjs'
const regional = await loadBernRegionalRoads()
describe('Bern regional road evidence', () => {
  it('retains every full pattern in a separate scope with unchanged limits', () => {
    expect(Object.values(regional.cache.agencies).reduce((n, a) => n + Object.keys(a.identities).length, 0)).toBe(120)
    expect(BERN_REGIONAL_ROUTES.some(id => BERN_URBAN_ROUTES.includes(id))).toBe(false)
    for (const a of Object.values(regional.cache.agencies)) expect(a.cache.metadata.limits).toEqual(BERN_ROAD_LIMITS)
    expect([...regional.roads.values()].filter(p => p.reason === 'road-pattern-dependent-path').length).toBeGreaterThan(0)
    expect([...regional.roads.values()].filter(p => p.reason === 'road-matcher-rejected').length).toBeGreaterThan(0)
  })
  it('rejects conflicting geometry in a second otherwise successful pattern context', () => {
    const cache = structuredClone(regional.cache), contexts = new Map()
    for (const [agencyId, a] of Object.entries(cache.agencies)) for (const [id, identity] of Object.entries(a.identities)) {
      for (let i = 1; i < identity.stops.length; i++) {
        const key = JSON.stringify([identity.routeId, identity.stops[i - 1][4], identity.stops[i][4]])
        const list = contexts.get(key) ?? []; list.push({ agencyId, id, i: i - 1 }); contexts.set(key, list)
      }
    }
    const [key, values] = [...contexts].find(([key, c]) => c.length > 1 && regional.roads.get(key)?.path?.length > 3)
    const { agencyId, id, i } = values[0], a = cache.agencies[agencyId]
    const path = structuredClone(a.cache.paths[a.cache.patterns[id][i]])
    path[1][0] += .000001
    a.cache.patterns[id][i] = a.cache.paths.length; a.cache.paths.push(path)
    const changed = roadConsensus(cache, BERN_LIMITS.bus).get(key)
    expect(changed.path).toBeUndefined(); expect(changed.reason).toContain('road-pattern-dependent-path')
  })
})
