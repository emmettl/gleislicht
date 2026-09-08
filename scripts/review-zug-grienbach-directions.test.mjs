import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { grienbachPoster, compareGrienbachPoster, reviewZugGrienbachDirections } from './review-zug-grienbach-directions.mjs'
const p = JSON.parse(readFileSync('data/zug-policy.json')), bytes = readFileSync('data/zug-timetable.json.gz'), raw = JSON.parse(gunzipSync(bytes))
const poster = grienbachPoster(readFileSync('data/zug-grienbach-direction-sources/poster.txt', 'utf8'))
const review = (policy = p.grienbachDirectionReview, r = raw, hash = sha256(bytes)) => reviewZugGrienbachDirections(policy, p, r, hash)
describe('Grienbach directed relation and operator timetable review', () => {
  it('reconciles service-day poster columns, holiday-only departures and civil-window spillover', () => {
    expect(poster.weekday).toHaveLength(66); expect(poster.sunday).toHaveLength(37)
    expect(poster.sunday).not.toContain(20640)
    expect(poster.weekday.at(-1)).toBe(87000); expect(poster.sunday.at(-1)).toBe(87180)
    const days = compareGrienbachPoster(poster, raw, '92-604-B-j26-1')
    expect(days.map(d => [d.fullTrips, d.sourceDayCalls])).toEqual([[67, 66], [38, 37]])
    expect(days.every(d => d.carryIn[0].departure === 600 && d.followingCivilDayCalls.length === 1)).toBe(true)
    expect(days.flatMap(d => d.calls).every(c => c.downstreamSeconds === 60)).toBe(true)
  })
  it('rejects missing or shifted departures, wrong carry-in provenance and an altered one-minute interval', () => {
    const missing = structuredClone(raw); missing.snapshots[0].trains = missing.snapshots[0].trains.filter(t => !t.calls.some(c => c.id === 'ch:1:sloid:93448:0:1' && c.departure === 20640))
    expect(() => compareGrienbachPoster(poster, missing, '92-604-B-j26-1')).toThrow('source-day departures')
    const wrong = structuredClone(raw), trip = wrong.snapshots[1].trains.find(t => t.routeId === '92-604-B-j26-1' && t.sourceServiceDate === '2026-09-05')
    trip.sourceServiceDate = '2026-09-04'
    expect(() => compareGrienbachPoster(poster, wrong, '92-604-B-j26-1')).toThrow()
    const interval = structuredClone(raw), train = interval.snapshots[0].trains.find(t => t.calls.some(c => c.id === 'ch:1:sloid:93448:0:1'))
    train.calls.find(c => c.id === 'ch:1:sloid:87279:0:1').arrival++
    expect(() => compareGrienbachPoster(poster, interval, '92-604-B-j26-1')).toThrow('downstream interval')
  })
  it('binds all four complete patterns to directed stop roles and retains both projection failures', async () => {
    const result = await review()
    expect(result.relations.map(r => r.id)).toEqual([2098892, 6260163, 12044343, 12044344])
    expect(result.patterns.reduce((n, p) => n + p.occurrences.length, 0)).toBe(209)
    const grienbach = result.patterns.flatMap(p => p.platformComparisons).filter(p => p.stopId === 'ch:1:sloid:93448:0:1')
    expect(grienbach.every(p => p.nodeId === 13426824598 && p.gapMetres > 188 && p.gapMetres < 189)).toBe(true)
    expect(result.trials).toHaveLength(2); expect(result.trials.every(t => !t.result.path)).toBe(true)
    expect(result.restrictions).toHaveLength(11)
    expect(result.restrictions.filter(r => r.touchesLocalWays).map(r => r.id)).toEqual([12889523])
    expect(result.admittedFromReview).toBe(0); expect(result.coordinateCorrections).toBe(0); expect(result.matchPair).toBeUndefined()
  })
  it('rejects changed source identity and full-pattern scope', async () => {
    await expect(review({ ...p.grienbachDirectionReview, sourceSha256: 'changed' })).rejects.toThrow('catalogue')
    await expect(review(p.grienbachDirectionReview, raw, 'changed')).rejects.toThrow('timetable')
    const changed = structuredClone(raw), train = changed.snapshots[0].trains.find(t => t.routeId === '92-604-B-j26-1')
    train.calls.splice(4, 1)
    await expect(review(p.grienbachDirectionReview, changed)).rejects.toThrow('stop sequence')
  })
})
