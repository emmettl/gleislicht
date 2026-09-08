import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadLuzernBoats, luzernBoatSources, luzernBoatMatcher, luzernBoatConsensus } from './luzern-boat-geometry.mjs'
import { luzernCategory } from './build-luzern-region.mjs'
const json = p => JSON.parse(readFileSync(p)), config = json('data/luzern-policy.json').boatFallback
const boats = await loadLuzernBoats(config), policy = boats.policy, inputs = boats.inputs
const requests = json(`${policy.sourceDirectory}/requests.json`)
const pages = new Map(requests.map(r => [r.file, JSON.parse(gunzipSync(readFileSync(`${policy.sourceDirectory}/${r.file}`)))]))

it('retains all boat patterns, source candidates and opposite dock order without reversing a cached path', () => {
  expect(boats.inventory).toHaveLength(79)
  expect(boats.inventory.filter(f => f.lakes.length)).toHaveLength(65)
  expect(boats.patterns).toHaveLength(45)
  expect(boats.pairs.size).toBe(115)
  expect([...boats.pairs.values()].filter(p => p.path)).toHaveLength(92)
  const key = ids => JSON.stringify(['94-360-2-j26-1', ...ids])
  const keys = [...boats.pairs.keys()].map(k => JSON.parse(k)).filter(k => k[0] === '94-360-2-j26-1')
  const [, a, b] = keys[0]
  expect(boats.pairs.get(key([a, b])).path).toEqual([...boats.pairs.get(key([b, a])).path].reverse())
  for (const [key, result] of boats.pairs) if (result.path) {
    const [, a, b] = JSON.parse(key), stop = id => inputs.stops.find(s => s.stop_id === id)
    const coordinate = id => [+stop(id).stop_lon, +stop(id).stop_lat].map(n => result.geometrySource === 'osm-boat-pattern-inference' ? n : +n.toFixed(7))
    expect(result.path[0]).toEqual(coordinate(a))
    expect(result.path.at(-1)).toEqual(coordinate(b))
    expect(result.water.landCrossing).toBe(false)
  }
  expect(luzernCategory({ mode: 'boat' })).toBe('ferry')
})

it('preserves full Hallwilersee circuits and distinguishes the Sunday land-crossing exclusion', () => {
  for (const p of boats.patterns.filter(p => ['94-365-2-j26-1', '94-365-3-j26-1'].includes(p.routeId))) {
    expect(p.stopIds[0]).toBe(p.stopIds.at(-1))
    expect(p.results.every(r => r.geometrySha256)).toBe(true)
  }
  const rejected = boats.patterns.find(p => p.id === 'a54c8947555d19d0ae31')
  expect(rejected.stopIds).toHaveLength(5)
  const bad = rejected.results.filter(r => r.reason)
  expect(bad).toHaveLength(1); expect(bad[0].reason).toBe('boat-land-crossing')
  expect(bad[0].water.outsideIntervals.some(i => i.dock === null)).toBe(true)
  expect(bad[0].rejectedGeometrySha256).toBeTruthy()
  expect(rejected.results.filter(r => r.geometrySha256)).toHaveLength(3)
})

it('rejects a missing or capped tile and inconsistent duplicate source features', () => {
  expect(() => luzernBoatSources(pages, requests.slice(1), policy)).toThrow('source request')
  const capped = structuredClone(requests); capped[0].count = 200
  const changed = structuredClone(pages); changed.get(capped[0].file).results = Array(200).fill(changed.get(capped[0].file).results[0])
  expect(() => luzernBoatSources(changed, capped, policy)).toThrow('Capped')
  const duplicate = structuredClone(pages), seen = new Set(); let mutated = false
  for (const [name, page] of duplicate) if (name !== 'lakes.json.gz') for (const f of page.results.filter(f => f.properties.objval?.trim() === 'Kursschiff_Linie')) {
    if (seen.has(f.id) && !mutated) { f.geometry.coordinates[0][0] += .001; mutated = true }
    seen.add(f.id)
  }
  expect(mutated).toBe(true)
  expect(() => luzernBoatSources(duplicate, requests, policy)).toThrow('Conflicting')
})

it('rejects substituted lake identities, route operators and unreviewed docks', () => {
  const altered = structuredClone(pages); altered.get('lakes.json.gz').results.find(f => f.id === 93).properties.gewaesserkennzahl = 9172
  expect(() => luzernBoatSources(altered, requests, policy)).toThrow()
  const m = luzernBoatMatcher(boats.lakes, policy), train = inputs.snapshots[0].trains[0], route = inputs.inventory.find(r => r.routeId === train.routeId), stops = new Map(inputs.stops.map(s => [s.stop_id, s]))
  expect(() => m.match(train, stops, { ...route, agencyId: '181' })).toThrow('route identity')
  const changedTrain = structuredClone(train); changedTrain.calls[1].id = 'unknown'
  expect(() => m.match(changedTrain, stops, route)).toThrow()
})

it('refuses pair reuse if one complete context rejects it or returns a different accepted curve', () => {
  const selected = inputs.snapshots[0].trains.find(t => t.routeId === '94-360-2-j26-1')
  const second = { ...selected, directionId: 'new-context' }, raw = { ...inputs, snapshots: [{ trains: [selected, second] }] }
  const base = luzernBoatMatcher(boats.lakes, policy)
  const reject = { match(t, s, r) { return t.directionId === 'new-context' ? [{ reason: 'review-failure' }] : base.match(t, s, r) } }
  expect([...luzernBoatConsensus(raw, reject).pairs.values()][0].path).toBeUndefined()
  const divergent = { match(t, s, r) { const rs = base.match(t, s, r); if (t.directionId === 'new-context') rs[0].path[1][0] += .001; return rs } }
  const result = [...luzernBoatConsensus(raw, divergent).pairs.values()][0]
  expect(result.path).toBeUndefined(); expect(result.reason).toContain('boat-pattern-dependent-path')
})
