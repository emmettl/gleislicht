import { beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { roadConsensus } from './luzern-road-geometry.mjs'
import { decodeMontCarmel, montCarmelPath, montCarmelReview } from './fribourg-mont-carmel.mjs'

let policy, source, cache, baseline
beforeAll(async () => {
  const json = async f => JSON.parse(await readFile(f))
  const config = (await json('data/fribourg-policy.json')).roads
  policy = await json(config.montCarmel.file); cache = await json(config.cacheFile)
  source = decodeMontCarmel(`${policy.sourceDirectory}/map.osm.gz`)
  baseline = roadConsensus(cache, config.limits)
})

describe('Fribourg Mont-Carmel directed terminal movement', () => {
  it('uses forward connected source nodes and preserves both original platform endpoints', () => {
    const original = structuredClone(source), result = montCarmelPath(source, policy)
    expect(result.path[0]).toEqual(policy.stops[0].slice(0, 2).map(n => +n.toFixed(7)))
    expect(result.path.at(-1)).toEqual(policy.stops[1].slice(0, 2).map(n => +n.toFixed(7)))
    expect(result.lengthMetres).toBeCloseTo(132.745, 2)
    expect(result.attachmentsMetres.every(m => m < 6)).toBe(true)
    expect(result.directedSourceSegments.map(s => s.direction)).toEqual(['forward', 'forward', 'forward'])
    expect(source).toEqual(original)
  })
  it('checks all four full patterns and changes only the one rejected pair', () => {
    const old = structuredClone(baseline), result = montCarmelReview(cache, baseline, policy, source)
    const changed = [...result.candidates].filter(([key, p]) => JSON.stringify(p) !== JSON.stringify(baseline.get(key)))
    expect(changed).toHaveLength(1); expect(policy.patterns).toHaveLength(4)
    expect(result.audit.contributingPatterns).toHaveLength(2)
    expect(changed[0][1].primaryRoadFailure.reason).toBe('road-matcher-rejected')
    expect(baseline).toEqual(old)
  })
  it('rejects a reversed, disconnected or restricted source path', () => {
    for (const alter of [s => { s.ways.find(w => w.id === '1097802067').nodes.reverse() },
      s => { s.ways.find(w => w.id === '1095950865').nodes[0] = '999' },
      s => { s.restrictions.push({ members: [{ type: 'way', ref: '55700630', role: 'from' }] }) },
      s => { s.ways[0].tags['access:conditional'] = 'no @ (Mo-Fr)' },
      s => { s.ways[0].tags.bus = 'no' }]) {
      const changed = structuredClone(source); alter(changed)
      expect(() => montCarmelPath(changed, policy)).toThrow()
    }
  })
  it('rejects changed stop identity, displaced platforms and missing trolley wires', () => {
    const changed = structuredClone(source); changed.nodes.find(n => n.id === '947021993').tags.uic_ref = '8588888'
    expect(() => montCarmelPath(changed, policy)).toThrow()
    const p = structuredClone(policy); p.stops[0][0] += 0.001
    expect(() => montCarmelPath(source, p)).toThrow('too far')
    const wireless = structuredClone(source); delete wireless.ways[0].tags.trolley_wire
    expect(() => montCarmelPath(wireless, policy)).toThrow()
  })
  it('rejects a shortened input inventory or a nonterminal occurrence', () => {
    const p = structuredClone(policy); p.patterns.pop()
    expect(() => montCarmelReview(cache, baseline, p, source)).toThrow('full route-3')
    const c = structuredClone(cache), q = structuredClone(policy)
    const changed = q.patterns.find(p => p.stops.at(-1)[4] === policy.stops[1][4])
    changed.stops.push(changed.stops[0])
    c.agencies['834'].identities[changed.id].stops = changed.stops
    expect(() => montCarmelReview(c, baseline, q, source)).toThrow('terminate')
  })
  it('does not overwrite an already accepted path or infer a reverse platform movement', () => {
    const b = new Map(baseline), key = JSON.stringify([policy.routeId, ...policy.stops.map(s => s[4])])
    b.set(key, { path: [[7, 46], [7.1, 46.1]] })
    expect(() => montCarmelReview(cache, b, policy, source)).toThrow('Primary terminal failure')
    const p = { ...policy, stops: [...policy.stops].reverse() }
    expect(() => montCarmelReview(cache, baseline, p, source)).toThrow()
  })
  it('rejects a date refresh without a renewed review', () => {
    expect(() => montCarmelReview(cache, baseline, { ...policy, dates: ['2026-09-11', '2026-09-13'] }, source)).toThrow('validation dates')
  })
})
