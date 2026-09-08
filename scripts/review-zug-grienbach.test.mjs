import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { reviewZugGrienbach, grienbachPlatformDistances } from './review-zug-grienbach.mjs'

const json = path => JSON.parse(readFileSync(path))
const policy = json('data/zug-policy.json'), bytes = readFileSync('data/zug-timetable.json.gz')
const raw = JSON.parse(gunzipSync(bytes))
const review = (p = policy.grienbachReview, r = raw) => reviewZugGrienbach(p, policy.roadExpansion, r, sha256(bytes))

describe('Grienbach negative admission review', () => {
  it('reimports all three controlled runs and distinguishes geometric success from admission', async () => {
    const result = await review()
    expect(result.admittedFromTrials).toBe(0)
    expect(result.days.map(d => d.affectedTrips)).toEqual([67, 38])
    expect(result.days.map(d => d.intervalSeconds)).toEqual([[60], [60]])
    const [control, radius, coordinates] = result.runs
    expect(control.report.issues).toHaveLength(4)
    expect(control.report.issues.every(i => i.reason === 'stop-too-far' && i.snap > 188 && i.snap < 189)).toBe(true)
    for (const run of [radius, coordinates]) {
      expect(run.report.issues).toEqual([])
      expect(run.pairs.every(p => p.geometryPasses && p.occurrences === 2)).toBe(true)
      expect(run.pairs[1].repeatedVertices).toBeGreaterThan(0)
      expect(run.pairs[1].lengthMetres).toBeGreaterThan(980)
      expect(run.pairs[1].lengthMetres).toBeLessThan(1000)
      expect(run.impliedAverageKmh[0].values[0]).toBeGreaterThan(58)
    }
  })
  it('rejects changed evidence hashes and incomplete source-pattern membership', async () => {
    await expect(review({ ...policy.grienbachReview, sourceSha256: 'changed' })).rejects.toThrow('catalogue')
    const changed = structuredClone(raw)
    changed.stops.find(s => s.stop_id === 'ch:1:sloid:93448:0:1').stop_lon = '8.5'
    await expect(review(policy.grienbachReview, changed)).rejects.toThrow('every complete scoped pattern')
  })
  it('leaves all affected complete trips excluded and exposes no candidate-matching API', async () => {
    const result = await review(), audit = json('data/zug-study-audit.json')
    expect(result.candidates).toBeUndefined()
    expect(result.matchPair).toBeUndefined()
    for (const day of audit.days) {
      const route = day.routes.find(r => r.routeId === '92-604-B-j26-1')
      expect(route.trips - route.admittedTrips).toBe(result.days.find(d => d.date === day.date).affectedTrips)
      expect(day.directedStopPairs.filter(p => p.routeId === route.routeId && !p.matched)).toHaveLength(2)
    }
  })
  it('compares all adjacent platform identities and keeps later closures outside both fixtures', async () => {
    const result = await review(), p = result.platformReview
    expect(p.coordinateCorrections).toBe(0)
    expect(p.admittedFromReview).toBe(0)
    expect(p.platforms).toHaveLength(6)
    const inbound = p.platforms.find(s => s.stopId === 'ch:1:sloid:93448:0:1')
    const outbound = p.platforms.find(s => s.stopId === 'ch:1:sloid:93448:0:2')
    expect(inbound.candidates.map(c => c.distanceMetres)).toEqual([expect.closeTo(199.504, 2), expect.closeTo(188.511, 2)])
    expect(outbound.minimumSameUicDistanceMetres).toBeCloseTo(3.674, 2)
    expect(inbound.days.map(d => d.contexts[0].trips)).toEqual([67, 38])
    expect(outbound.days.map(d => d.contexts[0].trips)).toEqual([66, 38])
    expect(inbound.days.every(d => d.contexts[0].nextId === 'ch:1:sloid:87279:0:1')).toBe(true)
    expect(outbound.days.every(d => d.contexts[0].previousId === 'ch:1:sloid:87279:0:2')).toBe(true)
    expect(p.noticeDates.cityFullClosure[0] > raw.dates[1]).toBe(true)
    expect(p.noticeDates.outboundRelocation[0] < raw.dates[0]).toBe(true)
    expect(p.ignoredConstructionPopups).toEqual(['4720c634-cae1-4caa-aebb-dfa54a76845b'])
  })
  it('cannot use a nearby stop with another station code or silently accept a newer platform snapshot', () => {
    const source = json(`${policy.grienbachReview.sourceDirectory}/sources.json`)
    const osm = JSON.parse(gunzipSync(readFileSync(`${policy.grienbachReview.sourceDirectory}/platforms.json.gz`)))
    const wrong = structuredClone(osm)
    wrong.elements.find(n => n.id === 13426824598).tags.uic_ref = '8587279'
    expect(() => grienbachPlatformDistances(wrong, raw, source.platformReview, source.route.routeId)).toThrow('same-UIC')
    const newer = structuredClone(osm)
    newer.elements.find(n => n.id === 13426824598).timestamp = '2026-09-03T00:00:00Z'
    expect(() => grienbachPlatformDistances(newer, raw, source.platformReview, source.route.routeId)).toThrow('newer')
    expect(() => grienbachPlatformDistances({ ...osm, elements: osm.elements.slice(1) }, raw, source.platformReview, source.route.routeId)).toThrow('inventory')
  })
})
