import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { validateZugRoadScope, loadZugRoads, matchZugRoadPair, zugOfficialAttempt } from './zug-road-geometry.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const bytes = readFileSync('data/zug-timetable.json.gz'), raw = JSON.parse(gunzipSync(bytes))
const policy = JSON.parse(readFileSync('data/zug-policy.json')).road
const cache = JSON.parse(readFileSync(policy.cacheFile))

describe('Zug complete-pattern OSM fallback', () => {
  it('reimports retained matcher output and requires all six 653 and two N73 patterns', async () => {
    const result = await loadZugRoads(policy, raw, sha256(bytes))
    expect(result.inventory.filter(p => p.agencyId === '839')).toHaveLength(6)
    expect(result.inventory.filter(p => p.agencyId === '801')).toHaveLength(2)
    expect(result.source.attribution).toBe('© OpenStreetMap contributors')
    expect(result.source.license).toBe('ODbL-1.0')
  })
  it('rejects missing short branches, changed stop coordinates and a wrong operator', () => {
    const missing = structuredClone(cache)
    delete missing.agencies['839'].identities[Object.keys(missing.agencies['839'].identities)[0]]
    expect(() => validateZugRoadScope(raw, missing, policy)).toThrow('every complete')
    const moved = structuredClone(raw)
    moved.stops.find(s => s.stop_id === raw.snapshots[0].trains.find(t => t.routeId === policy.routes[0].routeId).calls[0].id).stop_lon = '8.6'
    expect(() => validateZugRoadScope(moved, cache, policy)).toThrow('every complete')
    const wrong = structuredClone(policy); wrong.routes[0].agencyId = '801'
    expect(() => validateZugRoadScope(raw, cache, wrong)).toThrow('identity')
  })
  it('keeps successful official paths and retains every failed official attempt', () => {
    const official = { path: [[8.5, 47.1], [8.51, 47.1]], geometrySource: 'zug' }
    const fallback = { path: [[8.5, 47.1], [8.52, 47.1]], geometrySource: 'osm-road-inference' }
    const roads = { candidates: new Map([[JSON.stringify(['r', 'a', 'b']), fallback]]) }
    expect(matchZugRoadPair(official, roads, 'r', 'a', 'b')).toBe(official)
    const failure = { reason: 'disconnected-line', geometrySource: 'luzern', sourceFeatures: ['luzern-bus:B653'], primaryFailure: { reason: 'endpoint-gap' } }
    const result = matchZugRoadPair(failure, roads, 'r', 'a', 'b')
    expect(result.officialFailure).toEqual(failure)
    expect(zugOfficialAttempt({ ...result, matched: true, occurrences: 10 })).toMatchObject({ ...failure, matched: false, occurrences: 10 })
    expect(matchZugRoadPair(failure, roads, 'different-route', 'a', 'b')).toBe(failure)
  })
  it('rejects a shared pair if any complete-pattern occurrence failed matching', () => {
    const changed = structuredClone(cache), agency = changed.agencies['839']
    const candidates = roadConsensus(cache, policy.limits)
    const [key, shared] = [...candidates].find(([, c]) => c.roadContextOccurrences === 3)
    const [routeId, from, to] = JSON.parse(key), patternId = shared.roadPatternIds[0]
    const stops = agency.identities[patternId].stops
    const index = stops.findIndex((s, i) => s[4] === from && stops[i + 1]?.[4] === to)
    agency.cache.patterns[patternId][index] = null
    const failed = roadConsensus(changed, policy.limits).get(key)
    expect(failed.path).toBeUndefined()
    expect(failed.reason).toContain('road-matcher-rejected')
    expect(matchZugRoadPair({ reason: 'disconnected-line' }, { candidates: new Map([[key, failed]]) }, routeId, from, to).officialFailure.reason).toBe('disconnected-line')
  })
})
