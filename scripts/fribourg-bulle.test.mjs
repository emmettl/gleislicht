import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { BULLE_ROUTES, BULLE_PAIRS, BULLE_ANCHOR, decodeBulle, bullePrefix, bulleReview } from './fribourg-bulle.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
const json = f => JSON.parse(readFileSync(f)), clone = structuredClone
const policy = json('data/fribourg-bulle-policy.json'), cache = json('data/fribourg-road-cache.json')
const source = decodeBulle('data/fribourg-bulle-sources/map.osm.gz')
const baseline = roadConsensus(cache, { detourRatio: 3, detourFloorMetres: 600 })
describe('Bulle L/M directed station exits and unchanged shared tails', () => {
  it('retains exact platform identity, forward node joins and a sub-decimetre suffix join', () => {
    for (const i of [0, 1]) {
      const p = bullePrefix(source, policy, i)
      expect(p.lengthMetres).toBeCloseTo([202.280, 193.201][i], 2)
      expect(p.attachmentMetres).toBeLessThan(5)
      expect(p.joinMetres).toBeLessThan(0.046)
      expect(p.segments).toHaveLength(7)
      expect(p.path.at(-1)).toEqual(BULLE_ANCHOR)
      expect(p.restrictionChecks).toHaveLength(7)
      expect(p.restrictionChecks.every(r => !r.violated)).toBe(true)
    }
  })
  it('changes only the two rejected pairs and retains all six primary contexts', () => {
    const r = bulleReview(cache, baseline, policy, source)
    const changed = [...baseline].filter(([k, v]) => r.candidates.get(k) !== v)
    expect(changed).toHaveLength(2)
    for (const [k, v] of changed) expect(r.candidates.get(k).primaryRoadFailure).toEqual(v)
    for (const a of r.audit.assessments) {
      expect(a.originalPaths).toHaveLength(3)
      expect(a.destinationAttachmentMetres).toBeLessThan(0.1)
      expect(a.path.slice(-26, -1)).toEqual(a.commonTail)
      expect(new Set(a.originalPaths.map(p => JSON.stringify(p.path))).size).toBe(2)
    }
  })
  it('requires explicit bus designation on access-restricted TPF roads', () => {
    for (const mutate of [w => delete w.tags.bus, w => w.tags.bus = 'no', w => w.tags.access = 'yes', w => w.tags.operator = 'other']) {
      const s = clone(source); mutate(s.ways.find(w => w.id === '1446630640'))
      expect(() => bullePrefix(s, policy, 0)).toThrow()
    }
  })
  it('rejects opposed one-way travel, broken joins, missing nodes and post-fixture edits', () => {
    for (const mutate of [s => s.ways.find(w => w.id === '1446630640').tags.oneway = '-1', s => s.ways.find(w => w.id === '129100337').nodes.reverse(),
      s => s.nodes = s.nodes.filter(n => n.id !== '13273200096'), s => s.ways.find(w => w.id === '1446630640').timestamp = '2026-09-05']) {
      const s = clone(source); mutate(s)
      expect(() => bullePrefix(s, policy, 0)).toThrow()
    }
  })
  it('rejects changed platform identity, displaced original calls and raised limits', () => {
    const s = clone(source); s.nodes.find(n => n.id === '13273200096').tags.ref = 'K'
    expect(() => bullePrefix(s, policy, 0)).toThrow()
    for (const mutate of [p => p.cases[0].stops[0][0] += 0.001, p => p.maximumAttachmentMetres = 120, p => p.maximumPrefixMetres = 600, p => p.maximumJoinMetres = 1]) {
      const p = clone(policy); mutate(p)
      expect(() => bullePrefix(source, p, 0)).toThrow()
    }
  })
  it('rejects a prohibited transition including the onward tail exit', () => {
    for (const prohibited of [['129100337', '4459904043', '449022778'], ['449022786', '4459904042', '1075813860']]) {
      const s = clone(source); s.restrictions[0].members.forEach((m, i) => m.ref = prohibited[i])
      expect(() => bullePrefix(s, policy, 0)).toThrow(/Prohibited/)
    }
  })
  it('rejects unreviewed conditional restrictions and barriers', () => {
    for (const tags of [{ 'bus:conditional': 'no @ (Mo-Fr)' }, { motor_vehicle: 'no' }, { barrier: 'bollard' }]) {
      const s = clone(source); Object.assign(s.ways.find(w => w.id === '1446630640').tags, tags)
      expect(() => bullePrefix(s, policy, 0)).toThrow()
    }
  })
  it('rejects any context with a changed suffix beyond the local boundary', () => {
    const c = clone(cache), agency = c.agencies['834'], id = 'f40b040e1f69aed13f0a667d', pathIndex = agency.cache.patterns[id][1]
    agency.cache.paths[pathIndex].at(-2)[0] += 0.001
    expect(() => bulleReview(c, baseline, policy, source)).toThrow(/beyond reviewed/)
  })
  it('rejects omitted full contexts, other routes or changed fixture dates', () => {
    for (const mutate of [p => p.patterns.pop(), p => p.routeIds[0] = '92-262-j26-1', p => p.dates[0] = '2026-09-05']) {
      const p = clone(policy); mutate(p)
      expect(() => bulleReview(cache, baseline, p, source)).toThrow()
    }
  })
  it('never rescues rejected matcher contexts or replaces accepted geometry', () => {
    const c = clone(cache); c.agencies['834'].cache.patterns['6d86886b7caa24eb47d60b00'][0] = null
    expect(() => bulleReview(c, baseline, policy, source)).toThrow(/Rejected original/)
    const b = new Map(baseline), key = JSON.stringify([BULLE_ROUTES[0], ...BULLE_PAIRS[0]])
    b.set(key, { ...b.get(key), path: [[7, 46], [7.1, 46.1]] })
    expect(() => bulleReview(cache, b, policy, source)).toThrow(/replace accepted/)
  })
})
