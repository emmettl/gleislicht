import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PORTALBAN_ROUTE, PORTALBAN_PAIRS, decodePortalban, portalbanPath, portalbanReview } from './fribourg-portalban.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
const json = f => JSON.parse(readFileSync(f)), clone = structuredClone
const policy = json('data/fribourg-portalban-policy.json'), cache = json('data/fribourg-road-cache.json')
const source = decodePortalban('data/fribourg-portalban-sources/map.osm.gz')
const baseline = roadConsensus(cache, { detourRatio: 3, detourFloorMetres: 600 })
describe('Portalban school streets in every complete context', () => {
  it('follows exact connected street nodes and preserves distinct village platforms', () => {
    for (const i of [0, 1]) {
      const g = portalbanPath(source, policy, i)
      expect(g.lengthMetres).toBeCloseTo([112.368, 103.598][i], 2)
      expect(g.path).toHaveLength(16)
      expect(g.attachments.every(p => p.gapMetres < 4.6)).toBe(true)
      expect(g.path[0]).toEqual(policy.pairs[i].stops[0].slice(0, 2).map(n => Number(n.toFixed(7))))
      expect(g.path.at(-1)).toEqual(policy.pairs[i].stops[1].slice(0, 2).map(n => Number(n.toFixed(7))))
      expect(g.nodeIds).toContain('540239211'); expect(g.nodeIds).toContain('5141566792')
    }
  })
  it('changes only two failed pairs and retains every differing matcher path', () => {
    const r = portalbanReview(cache, baseline, policy, source)
    const changed = [...baseline].filter(([k, v]) => r.candidates.get(k) !== v)
    expect(changed).toHaveLength(2)
    for (const [k, v] of changed) expect(r.candidates.get(k).primaryRoadFailure).toEqual(v)
    expect(r.audit.assessments.map(a => a.originalPaths.length)).toEqual([5, 4])
    for (const a of r.audit.assessments) expect(new Set(a.originalPaths.map(p => JSON.stringify(p.path))).size).toBe(2)
  })
  it('rejects one-way streets, broken joins, missing nodes and post-fixture edits', () => {
    for (const mutate of [s => s.ways[0].tags.oneway = 'yes', s => s.ways.find(w => w.id === '43121098').nodes.reverse(),
      s => s.nodes = s.nodes.filter(n => n.id !== '540239211'), s => s.ways[0].timestamp = '2026-09-05']) {
      const s = clone(source); mutate(s)
      expect(() => portalbanPath(s, policy, 0)).toThrow()
    }
  })
  it('rejects unreviewed access, barriers and touching turn restrictions', () => {
    for (const tags of [{ 'bus:conditional': 'no @ (Mo-Fr)' }, { motor_vehicle: 'destination' }, { barrier: 'bollard' }]) {
      const s = clone(source); Object.assign(s.ways[0].tags, tags)
      expect(() => portalbanPath(s, policy, 0)).toThrow()
    }
    const s = clone(source); s.restrictions.push({ members: [{ type: 'way', ref: s.ways[0].id }] })
    expect(() => portalbanPath(s, policy, 0)).toThrow(/restriction/)
  })
  it('rejects displaced or reversed calls and raised scoped limits', () => {
    for (const mutate of [p => p.pairs[0].stops[0][0] += 0.002, p => p.pairs[0].stops.reverse(), p => p.maximumAttachmentMetres = 120, p => p.maximumLengthMetres = 600]) {
      const p = clone(policy); mutate(p)
      expect(() => portalbanPath(source, p, 0)).toThrow()
    }
  })
  it('rejects omitted full contexts, another route or fixture dates', () => {
    for (const mutate of [p => p.patterns.pop(), p => p.routeId = '92-545-j26-1', p => p.dates[0] = '2026-09-05']) {
      const p = clone(policy); mutate(p)
      expect(() => portalbanReview(cache, baseline, p, source)).toThrow()
    }
  })
  it('rejects nearby out-of-order calls even with renewed context policy', () => {
    const c = clone(cache), p = clone(policy), id = '0aabaf4f1b4a9d1249f1f90a'
    c.agencies['834'].identities[id].stops[0].splice(0, 2, ...portalbanPath(source, policy, 0).path[6])
    p.patterns.find(x => x.id === id).stops = clone(c.agencies['834'].identities[id].stops)
    expect(() => portalbanReview(c, baseline, p, source)).toThrow(/Out-of-order/)
  })
  it('never rescues a rejected matcher occurrence or replaces accepted geometry', () => {
    const c = clone(cache); c.agencies['834'].cache.patterns.cc5c142c4aa99f991dc749d3[0] = null
    expect(() => portalbanReview(c, baseline, policy, source)).toThrow(/Rejected original/)
    const b = new Map(baseline), key = JSON.stringify([PORTALBAN_ROUTE, ...PORTALBAN_PAIRS[0]])
    b.set(key, { ...b.get(key), path: [[7, 46], [7.1, 46.1]] })
    expect(() => portalbanReview(cache, b, policy, source)).toThrow(/replace accepted/)
  })
})
