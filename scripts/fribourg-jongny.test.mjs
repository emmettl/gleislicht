import { beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { roadConsensus } from './luzern-road-geometry.mjs'
import { decodeJongny, jongnyPath, jongnyReview, jongnyCantonalEvidence, JONGNY_ROUTES } from './fribourg-jongny.mjs'
let policy, source, cache, baseline
beforeAll(async () => {
  const json = async f => JSON.parse(await readFile(f)), config = (await json('data/fribourg-policy.json')).roads
  policy = await json(config.jongny.file); cache = await json(config.cacheFile)
  source = decodeJongny(`${policy.sourceDirectory}/map.osm.gz`); baseline = roadConsensus(cache, config.limits)
})
describe('Fribourg Jongny source-chain review', () => {
  it('reproduces the same ten-way chain from three exact j26 relations', () => {
    const old = structuredClone(source), r = jongnyPath(source, policy)
    expect(r.directedSourceSegments).toHaveLength(10); expect(r.path).toHaveLength(140)
    expect(r.lengthMetres).toBeCloseTo(2007.496, 2)
    expect(r.path[0]).toEqual(policy.stops[0].slice(0, 2).map(n => +n.toFixed(7)))
    expect(r.path.at(-1)).toEqual(policy.stops[1].slice(0, 2).map(n => +n.toFixed(7)))
    expect(r.attachmentsMetres.every(m => m < 10)).toBe(true); expect(source).toEqual(old)
  })
  it('reviews all twelve patterns, changes only three failed pairs and preserves all other candidates', () => {
    const old = structuredClone(baseline), r = jongnyReview(cache, baseline, policy, source)
    const changed = [...r.candidates].filter(([key, p]) => JSON.stringify(p) !== JSON.stringify(baseline.get(key)))
    expect(changed).toHaveLength(3); expect(policy.patterns).toHaveLength(12)
    expect(r.audit.assessments.flatMap(a => a.contributingPatterns)).toHaveLength(7)
    expect(changed.every(([, p]) => p.primaryRoadFailure.reason === 'road-excessive-detour')).toBe(true)
    expect(baseline).toEqual(old)
  })
  it('rejects stale route identity, differing relation ways or reversed relation stops', () => {
    for (const alter of [s => { s.relations[0].tags['gtfs:route_id'] = '92-213-j25-1' },
      s => { s.relations[0].members = s.relations[0].members.filter(m => m.ref !== '26834441') },
      s => { s.relations[0].members.reverse() }]) {
      const s = structuredClone(source); alter(s); expect(() => jongnyPath(s, policy)).toThrow()
    }
  })
  it('rejects one-way violations, conditional access and intersecting turn restrictions', () => {
    for (const alter of [s => { s.ways.find(w => w.id === '26834441').tags.oneway = 'yes' },
      s => { s.ways[0].tags['bus:conditional'] = 'no @ (Su)' },
      s => { s.restrictions.push({ members: [{ type: 'way', ref: '26834438' }] }) }]) {
      const s = structuredClone(source); alter(s); expect(() => jongnyPath(s, policy)).toThrow()
    }
  })
  it('rejects moved platforms and changes to the bounded exception', () => {
    const p = structuredClone(policy); p.stops[0][0] += 0.001
    expect(() => jongnyPath(source, p)).toThrow('platform location')
    expect(() => jongnyPath(source, { ...policy, maximumLengthMetres: 2500 })).toThrow()
  })
  it('rejects omitted complete contexts, an extra route and repeated source stops', () => {
    const p = structuredClone(policy); p.patterns.pop()
    expect(() => jongnyReview(cache, baseline, p, source)).toThrow('complete VMCV')
    expect(() => jongnyReview(cache, baseline, { ...policy, routeIds: [...JONGNY_ROUTES, 'other'] }, source)).toThrow()
    const c = structuredClone(cache), q = structuredClone(policy)
    const pattern = q.patterns.find(p => p.stops.some(s => s[4] === policy.stops[0][4]))
    pattern.stops.push(policy.stops[0]); c.agencies['876'].identities[pattern.id].stops = pattern.stops
    expect(() => jongnyReview(c, baseline, q, source)).toThrow('Repeated source stop')
  })
  it('cannot overwrite an accepted pair', () => {
    const b = new Map(baseline), key = JSON.stringify([JONGNY_ROUTES[0], ...policy.stops.map(s => s[4])])
    b.set(key, { path: [[6, 46], [7, 47]] })
    expect(() => jongnyReview(cache, b, policy, source)).toThrow('primary Jongny failure')
  })
  it('requires independent cantonal curve agreement and preserves original detour rejection', async () => {
    const decoded = JSON.parse(gunzipSync(await readFile('data/fribourg-sources/decoded.json.gz')))
    const path = jongnyPath(source, policy).path, evidence = jongnyCantonalEvidence(decoded, policy, path)
    expect(evidence).toHaveLength(3)
    expect(evidence.every(e => e.primary.reason === 'implausible-detour' && e.cantonalToOsmMetres < 9)).toBe(true)
    expect(() => jongnyCantonalEvidence(decoded, policy, path.map(([x, y]) => [x + 0.01, y]))).toThrow('disagrees')
  })
})
