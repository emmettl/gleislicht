import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { reviewZugGrienbach } from './review-zug-grienbach.mjs'

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
})
