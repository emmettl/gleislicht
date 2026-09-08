import { beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseLuzernRail, luzernRailMatcher } from './luzern-rail-geometry.mjs'
import { fribourgAvryNetwork, fribourgAvryMatcher } from './fribourg-avry.mjs'

const json = async f => JSON.parse(await readFile(f))
let config, policy, network, pages, inputs, stops, routes, train
beforeAll(async () => {
  config = (await json('data/fribourg-policy.json')).rail
  policy = await json(config.avry.file); inputs = await json(config.inputs)
  pages = { curves: await json(`${policy.sourceDirectory}/linie-mit-polygon.json`), perron: await json(`${policy.sourceDirectory}/perron.json`), zugzahlen: await json(`${policy.sourceDirectory}/zugzahlen.json`) }
  network = parseLuzernRail(gunzipSync(await readFile(`${config.sourceDirectory}/network.xtf.gz`)).toString(), 5)
  stops = new Map(inputs.stops.map(s => [s.stop_id, s])); routes = new Map(inputs.inventory.map(r => [r.routeId, r]))
  train = inputs.snapshots[0].trains.find(t => t.routeId === policy.routes[0].routeId && t.calls.some(c => c.id === 'ch:1:sloid:1632:0:1515'))
})
const matcher = (dates = inputs.dates) => fribourgAvryMatcher(network, config, policy, pages, dates)

describe('Fribourg current Avry-Matran evidence', () => {
  it('adds the exact new node using detailed curves without mutating the old network', () => {
    const old = structuredClone(network), local = fribourgAvryNetwork(network, config, policy, pages)
    expect(network).toEqual(old)
    expect(local.network.nodes.get(policy.node.id).number).toBe('8501632')
    expect(local.network.segments.some(s => s.id === policy.replacedSegment.id)).toBe(false)
    expect(local.network.segments.filter(s => policy.curves.some(c => c.id === s.id)).map(s => s.points.length)).toEqual([152, 135])
    expect(local.assessments.every(a => a.attachmentsMetres.every(m => m < 20))).toBe(true)
  })
  it('resolves both directed stop patterns and preserves complete original calls', () => {
    const oldTrain = structuredClone(train), oldStops = structuredClone(stops), m = matcher()
    const primary = luzernRailMatcher(network, config, inputs.dates).match(train, stops, routes.get(train.routeId))
    expect(primary.some(r => r.reason === 'rail-missing-exact-operating-point')).toBe(true)
    const result = m.match(train, stops, routes.get(train.routeId))
    expect(result.every(r => r.path)).toBe(true)
    expect(result.filter(r => r.railReview)).toHaveLength(2)
    const reverse = m.match({ ...train, calls: [...train.calls].reverse() }, stops, routes.get(train.routeId))
    expect(reverse.every(r => r.path)).toBe(true)
    result.forEach((r, i) => expect(reverse.at(-1 - i).path).toEqual([...r.path].reverse()))
    expect(train).toEqual(oldTrain); expect(stops).toEqual(oldStops)
  })
  it('retains full-context out-of-order station protection', () => {
    const index = train.calls.findIndex(c => c.id === 'ch:1:sloid:1632:0:1515')
    const calls = [...train.calls]; [calls[index], calls[index + 1]] = [calls[index + 1], calls[index]]
    const result = matcher().match({ ...train, calls }, stops, routes.get(train.routeId))
    expect(result.some(r => !r.path)).toBe(true)
  })
  it('rejects truncated, duplicate, wrong-gauge or disconnected geometry records', () => {
    for (const alter of [p => { p.curves.total_count++ }, p => { p.curves.results[1] = p.curves.results[0] },
      p => { p.curves.results[0].spurweite = 'M' }, p => { p.curves.results[0].geo_shape.geometry.coordinates[0] = [8, 47] }]) {
      const changed = structuredClone(pages); alter(changed)
      expect(() => fribourgAvryNetwork(network, config, policy, changed)).toThrow()
    }
  })
  it('rejects wrong UIC, platform identity, call coordinates and routes', () => {
    const changed = structuredClone(pages); changed.perron.results[0].bpuic = '8504028'
    expect(() => fribourgAvryNetwork(network, config, policy, changed)).toThrow('platform identity')
    const s = policy.stops.find(s => train.calls.some(c => c.id === s.stop_id)), changedStops = new Map(stops)
    changedStops.set(s.stop_id, { ...s, stop_lat: s.stop_lat + 0.001 })
    expect(() => matcher().match(train, changedStops, routes.get(train.routeId))).toThrow('Changed Avry call identity')
    expect(() => matcher().match({ ...train, routeId: 'unknown' }, stops, routes.get(train.routeId))).toThrow('outside Avry')
    expect(() => matcher().match(train, stops, { ...routes.get(train.routeId), agencyId: '33' })).toThrow('rail route identity')
  })
  it('does not admit the new station before the opening date', () => {
    const result = matcher(['2025-12-12', '2025-12-13']).match(train, stops, routes.get(train.routeId))
    expect(result.some(r => !r.path)).toBe(true)
    expect(result.every(r => !r.railReview)).toBe(true)
  })
})
