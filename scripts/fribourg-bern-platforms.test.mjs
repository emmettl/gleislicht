import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseLuzernRail } from './luzern-rail-geometry.mjs'
import { bernTerminalNetwork, bernTerminalProjection, fribourgBernMatcher } from './fribourg-bern-platforms.mjs'

const json = async f => JSON.parse(await readFile(f))
let network, config, policy, previous, page, inputs, stops, routes
beforeAll(async () => {
  config = (await json('data/fribourg-policy.json')).rail
  policy = await json(config.bernPlatforms.file); previous = await json(config.review.file)
  inputs = await json(config.inputs); page = await json(`${previous.sourceDirectory}/sbb-daeniken.json`)
  network = parseLuzernRail(gunzipSync(await readFile(`${config.sourceDirectory}/network.xtf.gz`)).toString())
  stops = new Map(inputs.stops.map(s => [s.stop_id, s])); routes = new Map(inputs.inventory.map(r => [r.routeId, r]))
})
const matcher = () => fribourgBernMatcher(network, config, policy, previous, page, inputs)
const fixture = () => inputs.snapshots[0].trains.find(t => t.routeId === '91-15-B-j26-1' && t.calls[0].id === policy.stops[0].stop_id)

describe('Fribourg reviewed Bern western termini', () => {
  it('clips only the pinned western source and removes every station-centre connection in the local graph', () => {
    const original = structuredClone(network), { network: local, evidence } = bernTerminalNetwork(network, policy, policy.stops[0], policy.corridors[0])
    expect(network).toEqual(original)
    const incident = local.segments.filter(s => s.start === policy.node.id || s.end === policy.node.id)
    expect(incident).toHaveLength(1)
    expect(incident[0].id).toBe(evidence.clippedSegmentId)
    expect(incident[0].points[0]).toEqual(evidence.projection.point)
    expect(incident[0].points.at(-1)).toEqual(policy.corridors[0].segment.points[0])
    expect(evidence.removedStationCentreSegmentIds).toHaveLength(4)
    expect(evidence.projection.attachmentMetres).toBeLessThan(75)
    expect(local.nodes.get(policy.node.id).number).toBe('8507000')
  })
  it('retains original calls, coordinates and direction while resolving the terminal pair', () => {
    const t = fixture(), before = structuredClone(t), originalStops = structuredClone(stops)
    const result = matcher().match(t, stops, routes.get(t.routeId))
    expect(result.every(r => r.path)).toBe(true)
    expect(result[0].railReview.kind).toBe('bern-western-terminal')
    expect(result[0].path[0][0]).toBeCloseTo(stops.get(t.calls[0].id).stop_lon, 6)
    expect(t).toEqual(before); expect(stops).toEqual(originalStops)
    const reverse = matcher().match({ ...t, calls: [...t.calls].reverse() }, stops, routes.get(t.routeId))
    expect(reverse.at(-1).path.at(-1)).toEqual(result[0].path[0])
  })
  it('does not apply to an intermediate or repeated Bern call, or to an unknown platform', () => {
    const t = fixture(), m = matcher(), changed = new Map(stops)
    const id = 'ch:1:sloid:7000:55:99'; changed.set(id, { ...policy.stops[0], stop_id: id })
    for (const calls of [[t.calls[1], ...t.calls], [...t.calls, t.calls[0]], [{ id }, ...t.calls.slice(1)]]) {
      const result = m.match({ ...t, calls }, changed, routes.get(t.routeId))
      expect(result.every(r => !r.railReview)).toBe(true)
      expect(result.some(r => !r.path)).toBe(true)
    }
  })
  it('rejects changed exact platform records and unreviewed route identities', () => {
    const t = fixture(), changed = new Map(stops)
    changed.set(t.calls[0].id, { ...stops.get(t.calls[0].id), platform_code: '99' })
    expect(() => matcher().match(t, changed, routes.get(t.routeId))).toThrow('Changed reviewed Bern platform')
    expect(() => matcher().match({ ...t, routeId: 'unknown' }, stops, routes.get(t.routeId))).toThrow('outside Bern')
    expect(() => matcher().match(t, stops, { ...routes.get(t.routeId), agencyId: '834' })).toThrow('Unreviewed rail route identity')
  })
  it('keeps distance and trim guards and rejects changed pinned source geometry', () => {
    expect(() => bernTerminalProjection(policy.corridors[0].segment.points, [8, 47])).toThrow('too far')
    expect(() => bernTerminalNetwork(network, { ...policy, maximumTrimMetres: 300 }, policy.stops[0], policy.corridors[0])).toThrow('trim length')
    const c = structuredClone(policy.corridors[0]); c.segment.points[0][0] += 0.00001
    expect(() => bernTerminalNetwork(network, policy, policy.stops[0], c)).toThrow('Changed reviewed Bern approach')
  })
  it('composes the Bern terminal with the already reviewed Kerzers BLS mapping', () => {
    const t = inputs.snapshots[0].trains.find(t => t.routeId === previous.kerzers.routeId && t.calls.at(-1).id === policy.stops[1].stop_id)
    const result = matcher().match(t, stops, routes.get(t.routeId))
    expect(result.every(r => r.path)).toBe(true)
    expect(result.at(-1).railReview.kind).toBe('bern-western-terminal')
    expect(result.some(r => r.toOperatingPoint === '8516192' || r.fromOperatingPoint === '8516192')).toBe(true)
  })
})
