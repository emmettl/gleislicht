import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseLuzernRail, luzernRailMatcher } from './luzern-rail-geometry.mjs'
import { fribourgRailReviewMatcher } from './fribourg-rail-review.mjs'

const json = async f => JSON.parse(await readFile(f))
let network, config, policy, page, input, stops, routes
beforeAll(async () => {
  config = (await json('data/fribourg-policy.json')).rail
  policy = await json('data/fribourg-rail-review-policy.json')
  page = await json('data/fribourg-rail-review-sources/sbb-daeniken.json')
  input = await json(config.inputs)
  network = parseLuzernRail(gunzipSync(await readFile(`${config.sourceDirectory}/network.xtf.gz`)).toString())
  stops = new Map(input.stops.map(s => [s.stop_id, s])); routes = new Map(input.inventory.map(r => [r.routeId, r]))
})
const matcher = (p = policy, source = page, net = network) => fribourgRailReviewMatcher(net, config, p, source, input.dates)
const train = ids => ({ routeId: policy.kerzers.routeId, directionId: '0', calls: ids.map(id => ({ id })) })

describe('Fribourg reviewed BLS platforms and SBB infrastructure', () => {
  it('resolves the BLS platform without merging the SBB station or changing original calls', () => {
    const t = train(['ch:1:sloid:4483:0:457050', 'ch:1:sloid:4400:3:6']), original = structuredClone(t), originalStops = structuredClone(stops)
    const baseline = luzernRailMatcher(network, config, input.dates).match(t, stops, routes.get(t.routeId))[0]
    expect(baseline.path).toBeUndefined()
    const result = matcher().match(t, stops, routes.get(t.routeId))[0]
    expect(result.path).toBeTruthy(); expect(result.railReview.targetNumber).toBe('8516192')
    expect(result.toOperatingPoint).toBe('8516192')
    expect(t).toEqual(original); expect(stops).toEqual(originalStops)
    expect(result.path.at(-1)[0]).toBeCloseTo(stops.get(t.calls[1].id).stop_lon, 6)
    expect(result.path.at(-1)[1]).toBeCloseTo(stops.get(t.calls[1].id).stop_lat, 6)
  })
  it('keeps unknown Kerzers platforms and other route identities outside the exception', () => {
    const id = 'ch:1:sloid:4400:99:99', changed = new Map(stops)
    changed.set(id, { ...policy.kerzers.stops[0], stop_id: id })
    const t = train(['ch:1:sloid:4483:0:457050', id])
    expect(matcher().match(t, changed, routes.get(t.routeId))[0].path).toBeUndefined()
    expect(() => matcher().match({ ...t, routeId: 'unreviewed' }, changed, routes.get(t.routeId))).toThrow('outside rail review')
    expect(() => matcher().match(t, changed, { ...routes.get(t.routeId), agencyId: '11' })).toThrow('Unreviewed rail route identity')
  })
  it('rejects moved reviewed platforms and changed infrastructure identities', () => {
    const id = policy.kerzers.stops[0].stop_id, changed = new Map(stops)
    changed.set(id, { ...stops.get(id), stop_lon: stops.get(id).stop_lon + 0.00001 })
    expect(() => matcher().match(train(['ch:1:sloid:4483:0:457050', id]), changed, routes.get(policy.kerzers.routeId))).toThrow('Changed reviewed Kerzers platform')
    const p = structuredClone(policy); p.kerzers.node.number = '8504400'
    expect(() => matcher(p)).toThrow('Changed reviewed Kerzers BLS node')
  })
  it('adds one detailed SBB curve and preserves the rejected FOT metre-gauge record', () => {
    const before = structuredClone(network), m = matcher()
    expect(m.inventory.filter(r => r.usedBy)).toHaveLength(1)
    expect(m.sourceSegment.reason).toBe(null); expect(m.attachments.every(x => x <= 120)).toBe(true)
    expect(network).toEqual(before)
    expect(network.segments.find(s => s.id === policy.daeniken.originalSegment.id).gauge).toBe('mm1000')
    const t = { routeId: policy.daeniken.routeId, directionId: '0', calls: [{ id: 'ch:1:sloid:218:4:7' }, { id: 'ch:1:sloid:2113:2:3' }] }
    const r = m.match(t, stops, routes.get(t.routeId))[0]
    expect(r.pathMetres).toBeLessThan(15000)
    expect(r.railReview.kind).toBe('sbb-daeniken-curve')
    expect(r.directedSourceSegments.some(s => s.id === policy.daeniken.id)).toBe(true)
    const reverse = m.match({ ...t, calls: [...t.calls].reverse() }, stops, routes.get(t.routeId))[0]
    expect(reverse.path[0]).toEqual(r.path.at(-1)); expect(reverse.path.at(-1)).toEqual(r.path[0])
  })
  it('fails closed for truncated, duplicate, changed-gauge or schematic SBB evidence', () => {
    for (const mutate of [p => p.total_count++, p => p.results.push(p.results[0]),
      p => { p.results.find(r => r.bp_anfang === 'DK' && r.bp_ende === 'DKO').spurweite = 'M' },
      p => { p.results.find(r => r.bp_anfang === 'DK' && r.bp_ende === 'DKO').geo_shape.geometry.coordinates = [[7, 47], [8, 47]] }]) {
      const changed = structuredClone(page); mutate(changed)
      expect(() => matcher(policy, changed)).toThrow()
    }
  })
})
