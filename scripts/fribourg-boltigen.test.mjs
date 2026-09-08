import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { BOLTIGEN_ROUTE, BOLTIGEN_PAIRS, decodeBoltigen, boltigenPath, boltigenReview } from './fribourg-boltigen.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
const json = f => JSON.parse(readFileSync(f)), clone = structuredClone
const policy = json('data/fribourg-boltigen-policy.json'), cache = json('data/fribourg-road-cache.json')
const source = decodeBoltigen('data/fribourg-boltigen-sources/map.osm.gz')
const baseline = roadConsensus(cache, { detourRatio: 3, detourFloorMetres: 600 })
describe('Boltigen independently corroborated directed hairpins', () => {
  it('retains detailed roads and distinct original platforms in both directions', () => {
    for (const i of [0, 1]) {
      const g = boltigenPath(source, policy, i)
      expect(g.lengthMetres).toBeCloseTo([1135.097, 1047.686][i], 2)
      expect(g.path).toHaveLength([96, 83][i])
      expect(g.attachments.every(p => p.gapMetres < 20)).toBe(true)
      expect(g.path[0]).toEqual(policy.pairs[i].stops[0].slice(0, 2).map(n => Number(n.toFixed(7))))
      expect(g.path.at(-1)).toEqual(policy.pairs[i].stops[1].slice(0, 2).map(n => Number(n.toFixed(7))))
      expect(g.directedSourceSegments[0].direction).toBe(i ? 'backward' : 'forward')
      expect(g.comparison.bernToOsmMetres).toBeLessThan(5.3)
      expect(g.comparison.osmToBernMetres).toBeLessThan(5.3)
    }
  })
  it('changes only the two failed pairs, retaining their primary rejections', () => {
    const r = boltigenReview(cache, baseline, policy, source)
    expect(r.audit.sourceInventory.bernLineInventory).toEqual({ total: 518, selected: 1, excluded: 517 })
    const changed = [...baseline].filter(([k, v]) => r.candidates.get(k) !== v)
    expect(changed).toHaveLength(2)
    for (const [k, v] of changed) expect(r.candidates.get(k).primaryRoadFailure).toEqual(v)
    expect(r.audit.assessments.map(a => a.contributingPatterns.length)).toEqual([1, 1])
  })
  it('rejects one-way roads, reversal, missing nodes and post-fixture edits', () => {
    for (const mutate of [s => s.way.tags.oneway = 'yes', s => s.way.nodes.reverse(), s => s.nodes = s.nodes.filter(n => n.id !== s.way.nodes[0]), s => s.way.timestamp = '2026-09-05']) {
      const s = clone(source); mutate(s)
      expect(() => boltigenPath(s, policy, 0)).toThrow()
    }
  })
  it('rejects unreviewed access, barriers and touching turn restrictions', () => {
    for (const tags of [{ 'bus:conditional': 'no @ (Mo-Fr)' }, { motor_vehicle: 'no' }, { barrier: 'bollard' }]) {
      const s = clone(source); Object.assign(s.way.tags, tags)
      expect(() => boltigenPath(s, policy, 0)).toThrow()
    }
    const s = clone(source); s.restrictions.push({ members: [{ type: 'way', ref: s.way.id }] })
    expect(() => boltigenPath(s, policy, 0)).toThrow()
  })
  it('rejects displaced calls, reversed platform IDs and raised scoped limits', () => {
    for (const mutate of [p => p.pairs[0].stops[0][0] += 0.002, p => p.pairs[0].stops.reverse(), p => p.maximumAttachmentMetres = 120, p => p.maximumLengthMetres = 1500, p => p.maximumComparisonMetres = 80]) {
      const p = clone(policy); mutate(p)
      expect(() => boltigenPath(source, p, 0)).toThrow()
    }
  })
  it('requires independent Bern identity and corridor agreement', () => {
    for (const mutate of [s => s.bernFeature.properties.tucode = 'other', s => s.bernFeature.properties.objectid = 301,
      s => { s.bernFeature.geometry.coordinates = s.bernFeature.geometry.coordinates.map(line => line.map(p => [p[0] + 1000, p[1]])) }]) {
      const s = clone(source); mutate(s)
      expect(() => boltigenPath(s, policy, 0)).toThrow()
    }
  })
  it('rejects omitted complete contexts, another route or fixture dates', () => {
    for (const mutate of [p => p.patterns.pop(), p => p.routeId = '92-260-j26-1', p => p.dates[0] = '2026-09-05']) {
      const p = clone(policy); mutate(p)
      expect(() => boltigenReview(cache, baseline, p, source)).toThrow()
    }
  })
  it('rejects a nearby out-of-order call even with renewed context policy', () => {
    const c = clone(cache), p = clone(policy), id = p.patterns[0].id
    c.agencies['834'].identities[id].stops[0].splice(0, 2, ...boltigenPath(source, policy, 0).path[20])
    p.patterns[0].stops = clone(c.agencies['834'].identities[id].stops)
    expect(() => boltigenReview(c, baseline, p, source)).toThrow(/Out-of-order/)
  })
  it('never replaces accepted geometry', () => {
    const b = new Map(baseline), key = JSON.stringify([BOLTIGEN_ROUTE, ...BOLTIGEN_PAIRS[0]])
    b.set(key, { ...b.get(key), path: [[7, 46], [7.1, 46.1]] })
    expect(() => boltigenReview(cache, b, policy, source)).toThrow(/replace accepted/)
  })
})
