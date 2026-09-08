import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { decodeLaupen, laupenPath, laupenReview, directedLaupenNodes, LAUPEN_ROUTE } from './fribourg-laupen.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
const json = f => JSON.parse(readFileSync(f))
const cache = json('data/fribourg-road-cache.json'), policy = json('data/fribourg-laupen-policy.json')
const source = decodeLaupen('data/fribourg-laupen-sources/map.osm.gz')
const baseline = roadConsensus(cache, { detourRatio: 3, detourFloorMetres: 600 })
const clone = structuredClone

describe('Laupen western diversion', () => {
  it('reconstructs three distinct directed paths and retains original endpoints', () => {
    const paths = policy.pairs.map((p, i) => {
      const g = laupenPath(source, policy, i)
      expect(g.path[0]).toEqual(p.stops[0].slice(0, 2).map(n => Number(n.toFixed(7))))
      expect(g.path.at(-1)).toEqual(p.stops[1].slice(0, 2).map(n => Number(n.toFixed(7))))
      expect(Math.max(...g.attachmentsMetres)).toBeLessThan(10)
      expect(g.lengthMetres).toBeCloseTo([1881.557, 1913.880, 2348.408][i], 2)
      expect(g.directedSourceSegments.find(s => s.wayId === '1311028296').direction).toBe(i === 2 ? 'forward' : 'backward')
      return g.path
    })
    expect(paths[2]).not.toEqual([...paths[1]].reverse())
    expect(paths[0].at(-1)).not.toEqual(paths[1].at(-1))
  })
  it('changes only three failed pairs with all six complete contexts', () => {
    const result = laupenReview(cache, baseline, policy, source)
    expect(result.audit.assessments.map(a => a.contributingPatterns.length)).toEqual([2, 1, 3])
    const changed = [...baseline].filter(([k, v]) => result.candidates.get(k) !== v)
    expect(changed).toHaveLength(3)
    for (const [k, v] of changed) expect(result.candidates.get(k).primaryRoadFailure).toEqual(v)
  })
  it('wraps the one-way bypass junction once in source order', () => {
    const w = source.ways.find(w => w.id === '1531474223'), c = policy.pairs[2].chain.find(c => c.wayId === w.id)
    const ids = directedLaupenNodes(w, c)
    expect(ids).toContain(w.nodes[0]); expect(new Set(ids).size).toBe(ids.length)
    expect(() => directedLaupenNodes(w, { ...c, direction: 'backward' })).toThrow(/one-way/)
    expect(() => directedLaupenNodes(w, { ...c, to: c.from })).toThrow(/collapsed/)
  })
  it('rejects reversed one-way approaches and a disconnected source chain', () => {
    let s = clone(source); s.ways.find(w => w.id === '933369888').tags.oneway = '-1'
    expect(() => laupenPath(s, policy, 0)).toThrow(/one-way/)
    const p = clone(policy); p.pairs[0].chain[1].from = '11295023853'
    expect(() => laupenPath(source, p, 0)).toThrow()
  })
  it('rejects construction, conditional access, barriers and touching restrictions', () => {
    for (const tags of [{ highway: 'construction' }, { 'bus:conditional': 'no @ (Mo-Fr)' }, { access: 'private' }]) {
      const s = clone(source); Object.assign(s.ways.find(w => w.id === '1311028296').tags, tags)
      expect(() => laupenPath(s, policy, 0)).toThrow()
    }
    let s = clone(source); s.nodes.find(n => n.id === '308077056').tags.barrier = 'bollard'
    expect(() => laupenPath(s, policy, 0)).toThrow(/barrier/)
    s = clone(source); s.restrictions.push({ members: [{ type: 'way', ref: '1311028296' }] })
    expect(() => laupenPath(s, policy, 0)).toThrow(/restriction/)
  })
  it('rejects bypass shortcuts, displaced platforms and increased limits', () => {
    let p = clone(policy); p.pairs[0].chain = p.pairs[0].chain.filter(c => c.wayId !== '1311028296')
    expect(() => laupenPath(source, p, 0)).toThrow(/western bypass/)
    p = clone(policy); p.pairs[0].stops[0][0] += 0.01
    expect(() => laupenPath(source, p, 0)).toThrow(/platform/)
    p = clone(policy); p.maximumAttachmentMetres = 120
    expect(() => laupenPath(source, p, 0)).toThrow()
    p = clone(policy); p.pairs[2].maximumLengthMetres = 3000
    expect(() => laupenPath(source, p, 0)).toThrow()
  })
  it('rejects future dates, changed routes and omitted complete contexts', () => {
    let p = clone(policy); p.dates[0] = '2026-08-04'
    expect(() => laupenReview(cache, baseline, p, source)).toThrow(/fixture dates/)
    p = clone(policy); p.routeId = '96-882-j26-1'
    expect(() => laupenReview(cache, baseline, p, source)).toThrow()
    p = clone(policy); p.patterns.pop()
    expect(() => laupenReview(cache, baseline, p, source)).toThrow(/complete/)
  })
  it('rejects an intermediate or repeated station call even if policy patterns are renewed', () => {
    const c = clone(cache), p = clone(policy)
    const id = p.patterns[0].id, identity = c.agencies['801'].identities[id]
    identity.stops.push(identity.stops[0]); p.patterns[0].stops = clone(identity.stops)
    expect(() => laupenReview(c, baseline, p, source)).toThrow(/endpoint/)
  })
  it('uses retained object versions covering both dates, before the 7 September edit', () => {
    expect(source.temporalRestoration).toHaveLength(6)
    expect(source.ways.find(w => w.id === '86162950').nodes).toContain('3978156585')
    expect(source.ways.find(w => w.id === '916903750').nodes).toContain('279600247')
    expect([...source.ways, ...source.nodes].every(n => n.timestamp < '2026-09-04T00:00:00Z')).toBe(true)
  })
  it('never overwrites already accepted paths', () => {
    const b = new Map(baseline), key = JSON.stringify([LAUPEN_ROUTE, ...policy.pairs[0].stops.map(s => s[4])])
    b.set(key, { ...b.get(key), path: [[7, 46], [7.1, 46.1]] })
    expect(() => laupenReview(cache, b, policy, source)).toThrow(/overwrite/)
  })
})
