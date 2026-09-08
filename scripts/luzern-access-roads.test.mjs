import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { reviewedAccessPairs, ACCESS_ROUTES, accessRoadInputs } from './luzern-access-roads.mjs'

const json = file => JSON.parse(readFileSync(file, 'utf8'))
const cache = json('data/luzern-access-road-cache.json'), source = json('data/luzern-access-road-sources/source.json')
const config = json('data/luzern-policy.json').accessRoadFallback

describe('Luzern strict access-road supplement', () => {
  it('exposes only the eight reviewed directed pairs, retaining all 19 routing contexts', () => {
    const result = reviewedAccessPairs(cache, source, config)
    expect(result.all.size).toBe(93)
    expect([...result.all.values()].filter(p => p.path)).toHaveLength(92)
    expect(result.pairs.size).toBe(8)
    expect(Object.values(cache.agencies).reduce((n, a) => n + Object.keys(a.identities).length, 0)).toBe(19)
    for (const [key, pair] of result.pairs) {
      expect(pair.geometrySource).toBe('osm-access-road-inference')
      expect(config.pairs.some(r => key === JSON.stringify([r.routeId, r.fromId, r.toId]))).toBe(true)
    }
    expect(reviewedAccessPairs(cache, source, { ...config, pairs: [] }).pairs.size).toBe(0)
  })
  it('rejects changed routes, source hashes, geometry hashes and duplicate reviews', () => {
    expect(() => reviewedAccessPairs(cache, { ...source, osmSha256: 'changed' }, config)).toThrow()
    expect(() => reviewedAccessPairs(cache, source, { ...config, pairs: [{ ...config.pairs[0], geometrySha256: 'changed' }] })).toThrow('geometry')
    expect(() => reviewedAccessPairs(cache, source, { ...config, pairs: [{ ...config.pairs[0], routeId: 'other-route' }] })).toThrow('route')
    expect(() => reviewedAccessPairs(cache, source, { ...config, pairs: [config.pairs[0], config.pairs[0]] })).toThrow('Duplicate')
  })
  it('does not rescue a reviewed pair with a failed full-pattern occurrence', () => {
    const broken = structuredClone(cache), review = config.pairs[0]
    let changed = false
    for (const agency of Object.values(broken.agencies)) for (const [id, p] of Object.entries(agency.identities)) {
      if (p.routeId !== review.routeId) continue
      const index = p.stops.findIndex((s, i) => s[4] === review.fromId && p.stops[i + 1]?.[4] === review.toId)
      if (index >= 0) { agency.cache.patterns[id][index] = null; changed = true }
    }
    expect(changed).toBe(true)
    expect(() => reviewedAccessPairs(broken, source, config)).toThrow('Rejected or missing')
  })
  it('prepares all fixture trips only for exact reviewed operator/route identities', () => {
    const raw = { inventory: ACCESS_ROUTES.map(r => ({ ...r, mode: 'bus', routeType: 700, agency: r.agencyId })),
      stops: [{ stop_id: 'a', stop_lon: 8, stop_lat: 47, stop_name: 'A' }, { stop_id: 'b', stop_lon: 8.01, stop_lat: 47, stop_name: 'B' }],
      snapshots: ['2026-09-04', '2026-09-06'].map(date => ({ date, trains: ACCESS_ROUTES.map(r => ({ id: `${date}:${r.routeId}`, routeId: r.routeId, calls: [{ id: 'a', arrival: -30, departure: -30 }, { id: 'b', arrival: 300, departure: 300 }] })) })) }
    const original = structuredClone(raw), result = accessRoadInputs(raw)
    expect(result.agencies).toHaveLength(3)
    expect(result.agencies.every(a => a.trains.length === 2)).toBe(true)
    expect(raw).toEqual(original)
    raw.inventory[0].agencyId = 'wrong-operator'
    expect(() => accessRoadInputs(raw)).toThrow('identity')
  })
})
