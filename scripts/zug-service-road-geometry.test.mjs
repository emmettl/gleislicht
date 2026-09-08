import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { loadZugServiceRoads, matchZugServiceRoadPair } from './zug-service-road-geometry.mjs'

const bytes = readFileSync('data/zug-timetable.json.gz'), raw = JSON.parse(gunzipSync(bytes))
const policy = JSON.parse(readFileSync('data/zug-policy.json'))
const load = (p = policy.roadServiceAccess, r = raw) => loadZugServiceRoads(p, policy.roadExpansion, r, sha256(bytes))

describe('Zug scoped Chloesterli service-road review', () => {
  it('replays both complete four-pattern runs and retains the original control failures', async () => {
    const result = await load()
    expect(result.inventory).toHaveLength(4)
    expect(result.candidates.size).toBe(2)
    expect(result.source.serviceAccessWay).toMatchObject({ id: 27823989, version: 7, tags: { highway: 'service', name: 'Chlösterlistrasse' } })
    const [forward, reverse] = [...result.candidates.values()]
    expect(reverse.path).toEqual([...forward.path].reverse())
    expect(forward.lengthMetres).toBeGreaterThan(1000)
    expect(forward.lengthMetres).toBeLessThan(1100)
    for (const r of [forward, reverse]) {
      expect(r.serviceRoadControl.reason).toBe('road-matcher-rejected')
      expect(r.serviceRoadControl.path).toBeUndefined()
      expect(r.roadContextOccurrences).toBe(1)
    }
  })
  it('cannot replace a previous success or extend the exception to another route or failure', async () => {
    const service = await load(), pair = policy.roadServiceAccess.reviewedPairs[0]
    const failure = { reason: 'road-matcher-rejected', geometrySource: 'osm-road-inference', officialFailure: { reason: 'missing-reviewed-line-geometry', geometrySource: 'zug' } }
    const result = matchZugServiceRoadPair(failure, service, ...pair)
    expect(result.path).toBeDefined()
    expect(result.officialFailure).toBe(failure.officialFailure)
    expect(result.serviceRoadPreviousFailure).toBe(failure)
    expect(matchZugServiceRoadPair(result, service, ...pair)).toBe(result)
    expect(matchZugServiceRoadPair(failure, service, 'another-route', ...pair.slice(1))).toBe(failure)
    const conflicting = { reason: 'road-pattern-dependent-path' }
    expect(matchZugServiceRoadPair(conflicting, service, ...pair)).toBe(conflicting)
  })
  it('rejects altered source hashes, changed stop identity and a pair that never failed the control', async () => {
    await expect(load({ ...policy.roadServiceAccess, sourceSha256: 'changed' })).rejects.toThrow('catalogue')
    const moved = structuredClone(raw)
    moved.stops.find(s => s.stop_id === 'ch:1:sloid:95727:0:1').stop_lon = '8.58'
    await expect(load(policy.roadServiceAccess, moved)).rejects.toThrow('every complete scoped pattern')
    const changed = structuredClone(policy.roadServiceAccess)
    changed.reviewedPairs[0][2] = 'ch:1:sloid:95726:0:1'
    await expect(load(changed)).rejects.toThrow('Control must reproduce')
  })
  it('admits all fixture trips for line 619 without losing calls or erasing the old failure', () => {
    const audit = JSON.parse(readFileSync('data/zug-study-audit.json'))
    expect(audit.days.map(d => d.admittedTripsUsingServiceRoads)).toEqual([8, 9])
    for (const day of audit.days) {
      const route = day.routes.find(r => r.routeId === '92-619-j26-1')
      expect(route.admittedTrips).toBe(route.trips)
      const pairs = day.directedStopPairs.filter(p => p.geometrySource === 'osm-service-road-inference')
      expect(pairs).toHaveLength(2)
      expect(pairs.every(p => p.matched && p.serviceRoadPreviousFailure.reason === 'road-matcher-rejected')).toBe(true)
    }
  })
})
