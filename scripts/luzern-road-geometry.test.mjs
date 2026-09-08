import { describe, it, expect } from 'vitest'
import { LUZERN_ROAD_SOURCE, roadConsensus, luzernRoadInputs, validateLuzernRoadScope, reviewedRoadContexts, roadContextKey, luzernRoadPatternId } from './luzern-road-geometry.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const a = [8, 47, 'A', '', 'a'], b = [8.01, 47, 'B', '', 'b'], c = [8.02, 47, 'C', '', 'c']
const limits = { detourRatio: 4.5, detourFloorMetres: 1200 }
function cacheFor(patterns) {
  const identities = {}, paths = [], references = {}
  for (const p of patterns) {
    const identity = { routeId: p.routeId ?? 'r', stops: p.stops }
    const id = roadPatternId({ routeId: identity.routeId, stops: p.stops.map((_, i) => [i]) }, p.stops)
    identities[id] = identity
    references[id] = p.paths.map(path => { if (path === null) return null; paths.push(path); return paths.length - 1 })
  }
  return { schemaVersion: 1, agencies: { '801': { patternsSha256: 'pinned', identities,
    cache: { metadata: { sourceSha256: LUZERN_ROAD_SOURCE.osmSha256, matcher: { patternsSha256: 'pinned' } }, paths, patterns: references } } } }
}
const path = [a.slice(0, 2), [8.005, 47.001], b.slice(0, 2)]
const pair = JSON.stringify(['r', 'a', 'b'])

describe('Luzern full-pattern road fallback', () => {
  it('admits only identical accepted paths across every complete pattern context', () => {
    const cache = cacheFor([{ stops: [a, b], paths: [path] }, { stops: [a, b, c], paths: [path, [b.slice(0, 2), c.slice(0, 2)]] }])
    const result = roadConsensus(cache, limits).get(pair)
    expect(result.path).toEqual(path)
    expect(result.roadPatternIds).toHaveLength(2)
    expect(result.roadContextOccurrences).toBe(2)
  })
  it('does not rescue a failed context with another context’s successful path', () => {
    const cache = cacheFor([{ stops: [a, b], paths: [path] }, { stops: [a, b, c], paths: [null, null] }])
    expect(roadConsensus(cache, limits).get(pair)).toMatchObject({ reason: 'road-matcher-rejected' })
    expect(roadConsensus(cache, limits).get(pair).path).toBeUndefined()
  })
  it('rejects differing branches and repeated occurrences within a loop', () => {
    const detour = [a.slice(0, 2), [8.005, 47.002], b.slice(0, 2)]
    const cache = cacheFor([{ stops: [a, b, a, b], paths: [path, [...path].reverse(), detour] }])
    const result = roadConsensus(cache, limits).get(pair)
    expect(result.reason).toBe('road-pattern-dependent-path')
    expect(result.roadContextOccurrences).toBe(2)
    expect(result.path).toBeUndefined()
  })
  it('keeps reversed directions and distinct route IDs separate', () => {
    const cache = cacheFor([{ stops: [a, b], paths: [path] }, { stops: [b, a], paths: [[...path].reverse()] }, { routeId: 'other', stops: [a, b], paths: [null] }])
    const results = roadConsensus(cache, limits)
    expect(results.get(pair).path).toEqual(path)
    expect(results.get(JSON.stringify(['r', 'b', 'a'])).path).toEqual([...path].reverse())
    expect(results.get(JSON.stringify(['other', 'a', 'b'])).path).toBeUndefined()
  })
  it('fails closed for changed identities, corrupted endpoints, invalid indices and changed source hashes', () => {
    const base = cacheFor([{ stops: [a, b], paths: [path] }])
    const identity = structuredClone(base); Object.values(identity.agencies['801'].identities)[0].stops[0][0] += 0.001
    expect(() => roadConsensus(identity, limits)).toThrow('identity changed')
    const endpoint = structuredClone(base); endpoint.agencies['801'].cache.paths[0][0] = [9, 47]
    expect(() => roadConsensus(endpoint, limits)).toThrow('endpoints')
    const index = structuredClone(base); Object.values(index.agencies['801'].cache.patterns)[0][0] = -1
    expect(() => roadConsensus(index, limits)).toThrow('reference')
    const source = structuredClone(base); source.agencies['801'].cache.metadata.sourceSha256 = 'changed'
    expect(() => roadConsensus(source, limits)).toThrow()
  })
  it('applies the stricter cantonal detour and collapsed-path limits', () => {
    const detour = [a.slice(0, 2), [8.005, 47.03], b.slice(0, 2)]
    expect(roadConsensus(cacheFor([{ stops: [a, b], paths: [detour] }]), limits).get(pair).reason).toBe('road-excessive-detour')
    const same = [8, 47, 'A again', '', 'again']
    expect(roadConsensus(cacheFor([{ stops: [a, same], paths: [[[8, 47], [8, 47]]] }]), limits).get(JSON.stringify(['r', 'a', 'again'])).reason).toBe('road-collapsed-path')
  })
  it('includes every agency, preserves all calls and shifts carry-in times only for routing', () => {
    const raw = { dates: ['2026-09-04', '2026-09-06'], inventory: [{ routeId: 'r', agencyId: '801', agency: 'Bus', routeType: 700, line: '1' }],
      stops: [a, b].map(s => ({ stop_id: s[4], stop_lon: s[0], stop_lat: s[1], stop_name: s[2], platform_code: '' })),
      snapshots: [{ date: '2026-09-04', trains: [{ id: 't', routeId: 'r', calls: [{ id: 'a', arrival: -60, departure: -60 }, { id: 'b', arrival: 300, departure: 300 }] }] }] }
    const original = structuredClone(raw), result = luzernRoadInputs(raw)
    expect(result.agencies.get('801').trains[0].stops).toEqual([[0, 86340, 86340], [1, 86700, 86700]])
    expect(raw).toEqual(original)
    const cache = cacheFor([{ stops: [a, b], paths: [path] }]); cache.metadata = { dates: raw.dates }
    expect(() => validateLuzernRoadScope(raw, cache)).not.toThrow()
    delete cache.agencies['801'].identities[Object.keys(cache.agencies['801'].identities)[0]]
    expect(() => validateLuzernRoadScope(raw, cache)).toThrow('every full bus pattern')
  })
})

describe('reviewed Luzern road pattern exceptions', () => {
  const detour = [a.slice(0, 2), [8.005, 47.002], b.slice(0, 2)]
  function fixture() {
    const cache = cacheFor([{ stops: [a, b], paths: [path] }, { stops: [a, b, c], paths: [detour, [b.slice(0, 2), c.slice(0, 2)]] }])
    const ids = Object.keys(cache.agencies['801'].identities)
    const reviews = ids.map((patternId, i) => ({ id: `review-${i}`, agencyId: '801', routeId: 'r', fromId: 'a', toId: 'b', patternId,
      geometrySha256: sha256(JSON.stringify(i ? detour : path)) }))
    return { cache, ids, reviews }
  }
  it('keeps two different accepted paths separate without changing reusable consensus', () => {
    const { cache, ids, reviews } = fixture(), contexts = reviewedRoadContexts(cache, limits, reviews)
    expect(roadConsensus(cache, limits).get(pair).path).toBeUndefined()
    expect(contexts.get(roadContextKey('r', 'a', 'b', ids[0])).path).toEqual(path)
    expect(contexts.get(roadContextKey('r', 'a', 'b', ids[1])).path).toEqual(detour)
    expect(contexts.has(pair)).toBe(false)
    expect(contexts.has(roadContextKey('r', 'b', 'a', ids[0]))).toBe(false)
    expect(contexts.has(roadContextKey('other-route', 'a', 'b', ids[0]))).toBe(false)
  })
  it('only makes explicitly reviewed contexts available and pins their geometry', () => {
    const { cache, reviews } = fixture()
    expect(reviewedRoadContexts(cache, limits).size).toBe(0)
    expect(reviewedRoadContexts(cache, limits, reviews.slice(0, 1)).size).toBe(1)
    expect(() => reviewedRoadContexts(cache, limits, [reviews[0], reviews[0]])).toThrow('Duplicate')
    expect(() => reviewedRoadContexts(cache, limits, [{ ...reviews[0], geometrySha256: 'changed' }])).toThrow('Changed reviewed context path')
    expect(() => reviewedRoadContexts(cache, limits, [{ ...reviews[0], routeId: 'other' }])).toThrow('identity')
  })
  it('cannot rescue a failed occurrence, including another full pattern', () => {
    const { cache, ids, reviews } = fixture()
    cache.agencies['801'].cache.patterns[ids[1]][0] = null
    expect(() => reviewedRoadContexts(cache, limits, [reviews[0]])).toThrow('valid but differing')
    const loop = cacheFor([{ stops: [a, b, a, b], paths: [path, [...path].reverse(), detour] }])
    const patternId = Object.keys(loop.agencies['801'].identities)[0]
    expect(() => reviewedRoadContexts(loop, limits, [{ ...reviews[0], patternId }])).toThrow('ambiguous occurrence')
  })
  it('binds the full ordered coordinate/platform sequence, including repeated calls', () => {
    const { cache, ids } = fixture()
    const stops = new Map([a, b, c].map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1], stop_name: s[2], platform_code: s[3] }]))
    const train = { routeId: 'r', calls: [{ id: 'a' }, { id: 'b' }] }
    expect(luzernRoadPatternId(train, stops)).toBe(ids[0])
    expect(luzernRoadPatternId({ ...train, calls: [...train.calls, { id: 'c' }] }, stops)).toBe(ids[1])
    expect(luzernRoadPatternId({ ...train, calls: [...train.calls, { id: 'a' }, { id: 'b' }] }, stops)).not.toBe(ids[0])
    stops.get('a').stop_lon += 0.00001
    expect(luzernRoadPatternId(train, stops)).not.toBe(ids[0])
    expect(Object.keys(cache.agencies['801'].identities)).toEqual(ids)
  })
})
