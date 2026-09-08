import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadZugRoadContexts, reviewZugRoadContexts, matchZugRoadContext } from './zug-road-contexts.mjs'

const json = path => JSON.parse(readFileSync(path))
const policy = json('data/zug-policy.json'), cache = json(policy.roadExpansion.cacheFile)
const source = json(`${policy.roadContexts.sourceDirectory}/sources.json`)
const raw = JSON.parse(gunzipSync(readFileSync('data/zug-timetable.json.gz')))
const stops = new Map(raw.stops.map(s => [s.stop_id, s]))

describe('Zug N6 full-pattern road contexts', () => {
  it('retains every context and both source variants within the bounded station approach', async () => {
    const contexts = await loadZugRoadContexts(policy.roadContexts, policy.roadExpansion, raw)
    expect(contexts.candidates.size).toBe(3)
    expect(contexts.pairKeys.size).toBe(1)
    expect(contexts.inventory[0].sharedPairAssessment.reason).toBe('road-pattern-dependent-path')
    expect(contexts.inventory[0].commonPrefixVertices).toBe(35)
    expect(contexts.inventory[0].maximumDivergenceMetres).toBeLessThan(110)
    expect(new Set([...contexts.candidates.values()].map(p => JSON.stringify(p.path))).size).toBe(2)
  })
  it('rejects an omitted context, a failed occurrence, or a broader unreviewed divergence', () => {
    expect(() => reviewZugRoadContexts(cache, policy.roadExpansion.limits, { ...source, reviews: source.reviews.slice(1) })).toThrow('every complete input context')
    const broken = structuredClone(cache)
    broken.agencies['839'].cache.patterns[source.reviews[0].patternId][16] = null
    expect(() => reviewZugRoadContexts(broken, policy.roadExpansion.limits, source)).toThrow('valid but differing')
    expect(() => reviewZugRoadContexts(cache, policy.roadExpansion.limits, { ...source, maximumDivergenceFromStopMetres: 5 })).toThrow('outside the reviewed station')
  })
  it('uses the complete source calls, cannot borrow another branch and preserves previous successes', async () => {
    const contexts = await loadZugRoadContexts(policy.roadContexts, policy.roadExpansion, raw)
    const r = source.reviews[0], identity = cache.agencies['839'].identities[r.patternId]
    const train = { routeId: r.routeId, calls: identity.stops.map(s => ({ id: s[4] })) }
    const original = { reason: 'road-pattern-dependent-path', officialFailure: { reason: 'missing-reviewed-line-geometry' } }
    const result = matchZugRoadContext(original, contexts, train, stops, r.fromId, r.toId)
    expect(result.roadPatternId).toBe(r.patternId)
    expect(result.officialFailure).toBe(original.officialFailure)
    expect(matchZugRoadContext(result, contexts, train, stops, r.fromId, r.toId)).toBe(result)
    expect(matchZugRoadContext(original, contexts, { ...train, calls: train.calls.slice(1) }, stops, r.fromId, r.toId)).toBe(original)
    const failed = { reason: 'road-matcher-rejected' }
    expect(matchZugRoadContext(failed, contexts, train, stops, r.fromId, r.toId)).toBe(failed)
  })
  it('admits the three complete Sunday patterns with distinct pair contexts', () => {
    const audit = json('data/zug-study-audit.json')
    expect(audit.days.map(d => d.admittedTripsUsingRoadContexts)).toEqual([0, 3])
    const sunday = audit.days[1], pairs = sunday.directedStopPairs.filter(p => p.geometrySource === 'osm-road-pattern-inference')
    expect(pairs).toHaveLength(3)
    expect(new Set(pairs.map(p => p.contextPatternId)).size).toBe(3)
    const route = sunday.routes.find(r => r.routeId === source.reviews[0].routeId)
    expect(route.admittedTrips).toBe(6)
    expect(route.admittedTrips).toBe(route.trips)
  })
})
