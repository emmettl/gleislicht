import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { BROC_ROUTE, BROC_STOPS, decodeBroc, brocPath, brocReview } from './fribourg-broc.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
const json = f => JSON.parse(readFileSync(f)), clone = structuredClone
const policy = json('data/fribourg-broc-policy.json'), cache = json('data/fribourg-road-cache.json')
const source = decodeBroc('data/fribourg-broc-sources/map.osm.gz')
const baseline = roadConsensus(cache, { detourRatio: 3, detourFloorMetres: 600 })
describe('Broc arrival and platform-B connection', () => {
  it('clips a positive forward source section with bounded original-call connectors', () => {
    const g = brocPath(source, policy)
    expect(g.lengthMetres).toBeCloseTo(21.577, 2); expect(g.sourceMetres).toBeCloseTo(9.229, 2)
    expect(g.path).toHaveLength(4); expect(g.sourceFraction).toBeGreaterThan(0.7)
    expect(g.path[0]).toEqual(policy.stops[0].slice(0, 2).map(n => Number(n.toFixed(7))))
    expect(g.path.at(-1)).toEqual(policy.stops[1].slice(0, 2).map(n => Number(n.toFixed(7))))
  })
  it('retains all ten patterns and changes only the failed pair in both contexts', () => {
    const r = brocReview(cache, baseline, policy, source)
    expect(r.audit.contributingPatterns).toHaveLength(2)
    const changed = [...baseline].filter(([k, v]) => r.candidates.get(k) !== v)
    expect(changed).toHaveLength(1); expect(r.candidates.get(changed[0][0]).primaryRoadFailure).toEqual(changed[0][1])
  })
  it('rejects reversal, changed source nodes and post-fixture edits', () => {
    for (const mutate of [w => w.tags.oneway = '-1', w => w.nodes.reverse(), w => w.timestamp = '2026-09-05']) {
      const s = clone(source); mutate(s.ways.find(w => w.id === '1395561049'))
      expect(() => brocPath(s, policy)).toThrow()
    }
  })
  it('rejects restricted access, barriers and touching turns', () => {
    for (const tags of [{ 'bus:conditional': 'no @ (Mo-Fr)' }, { motor_vehicle: 'no' }, { barrier: 'bollard' }]) {
      const s = clone(source); Object.assign(s.ways.find(w => w.id === '1395561049').tags, tags)
      expect(() => brocPath(s, policy)).toThrow()
    }
    const s = clone(source); s.restrictions.push({ members: [{ type: 'node', ref: '3313999352' }] })
    expect(() => brocPath(s, policy)).toThrow(/restriction/)
  })
  it('rejects displaced or collapsed calls and increased tolerances', () => {
    let p = clone(policy); p.stops[0][0] += 0.001
    expect(() => brocPath(source, p)).toThrow()
    p = clone(policy); p.stops[0].splice(0, 2, ...source.nodes.find(n => n.id === '3313999352').coordinate)
    expect(() => brocPath(source, p)).toThrow()
    p = clone(policy); p.maximumAttachmentMetres = 120
    expect(() => brocPath(source, p)).toThrow()
    p = clone(policy); p.maximumLengthMetres = 600
    expect(() => brocPath(source, p)).toThrow()
  })
  it('rejects omitted contexts, another route or other dates', () => {
    for (const mutate of [p => p.patterns.pop(), p => p.routeId = '92-262-j26-1', p => p.dates[0] = '2026-09-05']) {
      const p = clone(policy); mutate(p)
      expect(() => brocReview(cache, baseline, p, source)).toThrow()
    }
  })
  it('rejects a changed neighbouring branch even when the pattern policy is renewed', () => {
    const c = clone(cache), p = clone(policy), id = '49024979106595f6bed48697', stops = c.agencies['834'].identities[id].stops
    const index = stops.findIndex(s => s[4] === BROC_STOPS[0]); stops[index - 1][4] = 'unreviewed-platform'
    p.patterns.find(x => x.id === id).stops = clone(stops)
    expect(() => brocReview(c, baseline, p, source)).toThrow(/incoming branch/)
  })
  it('never replaces an accepted path', () => {
    const b = new Map(baseline), key = JSON.stringify([BROC_ROUTE, ...BROC_STOPS])
    b.set(key, { ...b.get(key), path: [[7, 46], [7.1, 46.1]] })
    expect(() => brocReview(cache, b, policy, source)).toThrow(/replace accepted/)
  })
})
