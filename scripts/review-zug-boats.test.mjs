import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { reviewZugBoats, waterFilteredBoatGraph } from './review-zug-boats.mjs'

const json = path => JSON.parse(readFileSync(path))
const policy = json('data/zug-policy.json'), bytes = readFileSync('data/zug-timetable.json.gz')
const raw = JSON.parse(gunzipSync(bytes))
const review = (p = policy.boatReview, r = raw, hash = sha256(bytes)) => reviewZugBoats(p, policy.boat, r, hash)

describe('Zugersee alternate-path exclusion review', () => {
  it('removes original land-crossing edges without reconnecting their ends or mutating the source', () => {
    const points = [[8.01, 47.01], [8.02, 47.01], [8.04, 47.01], [8.05, 47.01]]
    const graph = lineGraph([{ geometry: { type: 'LineString', coordinates: points } }])
    const outer = [[8, 47], [8.06, 47], [8.06, 47.02], [8, 47.02], [8, 47]]
    const island = [[8.02999, 47.005], [8.03001, 47.005], [8.03001, 47.015], [8.02999, 47.015], [8.02999, 47.005]]
    const trial = waterFilteredBoatGraph(graph, [[outer, island]], [points[0], points[3]], 200)
    expect(trial.blocked.map(e => e.edgeIndex)).toEqual([1])
    expect(graph.edges).toHaveLength(3)
    expect(trial.graph.edges).toEqual([graph.edges[0], graph.edges[2]])
    expect(trial.graph.points).toBe(graph.points)
    expect(matchBaselSegment(trial.graph, points[0], points[3], policy.boat.limits).reason).toBe('disconnected-line')
  })
  it('replays every failed pair, records exact source edges and keeps timing distinct from water validity', async () => {
    const result = await review(), [walchwil, zug] = result.trials
    expect(result.admittedFromTrials).toBe(0)
    expect(result.matchPair).toBeUndefined()
    expect(walchwil.intervals.map(i => [i.date, i.seconds])).toEqual([['2026-09-04', 1980], ['2026-09-06', 1980]])
    expect(zug.intervals.map(i => [i.date, i.seconds])).toEqual([['2026-09-06', 1200]])
    for (const trial of result.trials) {
      expect(trial.blockedEdges.map(e => e.edgeIndex)).toEqual([0, 1, 17, 184])
      expect(trial.blockedEdges.every(e => e.sourceFeatureIds.length === 1 && e.water.landCrossing)).toBe(true)
      expect(trial.sourceEdgeCount - trial.retainedEdgeCount).toBe(4)
      expect(trial.original.reason).toBe('boat-land-crossing')
    }
    expect(walchwil.water.landCrossing).toBe(false)
    expect(walchwil.fullPathMetres).toBeGreaterThan(walchwil.candidate.pathMetres)
    expect(walchwil.intervals.every(i => i.fullPathMeanKmh > 27 && i.fullPathMeanKmh < 28)).toBe(true)
    expect(zug.candidate.reason).toBe('implausible-detour')
    expect(zug.candidate.path).toBeUndefined()
    expect(zug.intervals[0].graphMeanKmh).toBeGreaterThan(49)
    expect(zug.water).toBeNull()
  })
  it('rejects unpinned evidence, altered timetables and omitted failure patterns', async () => {
    await expect(review({ ...policy.boatReview, sourceSha256: 'changed' })).rejects.toThrow('catalogue')
    await expect(review(policy.boatReview, raw, 'changed')).rejects.toThrow('timetable')
    const changed = structuredClone(raw)
    for (const day of changed.snapshots) day.trains = day.trains.filter(t => !t.calls.some((c, i) => c.id === 'ch:1:sloid:2258' && t.calls[i - 1]?.id === 'ch:1:sloid:2251'))
    await expect(review(policy.boatReview, changed)).rejects.toThrow('failure scope')
  })
})
