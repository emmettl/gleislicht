import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadLuzernBoats } from './luzern-boat-geometry.mjs'
import { luzernFerryRelation, loadLuzernOsmBoats } from './luzern-osm-boats.mjs'
const json = p => JSON.parse(readFileSync(p)), boats = await loadLuzernBoats(json('data/luzern-policy.json').boatFallback)
const policy = boats.osm.policy, binding = policy.binding
const elements = new Map(JSON.parse(gunzipSync(readFileSync(`${policy.sourceDirectory}/ferries.json.gz`))).elements.map(e => [`${e.type}/${e.id}`, e]))
const relation = elements.get(`relation/${binding.relationId}`), stops = new Map(boats.inputs.stops.map(s => [s.stop_id, s]))
const key = JSON.stringify([binding.routeId, binding.fromId, binding.toId]), pair = boats.pairs.get(key)
const original = new Map([[key, pair.primaryAssessment]])

it('admits the one complete Sunday pattern using the exact Greppen–Meggen source vertices and times', () => {
  expect(pair.geometrySource).toBe('osm-boat-pattern-inference')
  expect(pair.path).toHaveLength(13)
  expect(pair.attachmentMetres.every(m => m <= 30)).toBe(true)
  expect(pair.water.landCrossing).toBe(false)
  expect(pair.primaryAssessment.water.landCrossing).toBe(true)
  expect(boats.osm.intervals).toHaveLength(1)
  expect(boats.osm.intervals[0].date).toBe('2026-09-06')
  expect(boats.osm.intervals[0].meanKmh).toBeLessThan(25)
  expect(boats.osm.inventory.filter(e => e.status === 'admitted-reviewed-directed-pair')).toHaveLength(1)
})

it('rejects another dock platform, changed UIC or a conflicting operator', () => {
  const changed = structuredClone(stops); changed.get(binding.docks.at(-1).stopId).platform_code = '4'
  expect(() => luzernFerryRelation(relation, elements, binding, changed)).toThrow()
  const wrongUic = structuredClone(elements); wrongUic.get('node/2393265378').tags.uic_ref = '8508484'
  expect(() => luzernFerryRelation(relation, wrongUic, binding, stops)).toThrow('UIC')
  expect(() => luzernFerryRelation({ ...relation, tags: { ...relation.tags, operator: 'Verkehrshaus' } }, elements, binding, stops)).toThrow()
})

it('rejects disconnected, oppositely directed or reordered ferry relation members', () => {
  const disconnected = structuredClone(relation); disconnected.members = disconnected.members.filter(m => m.ref !== 1355336513)
  expect(() => luzernFerryRelation(disconnected, elements, binding, stops)).toThrow('Disconnected')
  const opposite = structuredClone(relation); opposite.members.find(m => m.ref === 1355336513).role = 'backward'
  expect(() => luzernFerryRelation(opposite, elements, binding, stops)).toThrow('direction')
  const calls = structuredClone(relation); [calls.members[1], calls.members[2]] = [calls.members[2], calls.members[1]]
  expect(() => luzernFerryRelation(calls, elements, binding, stops)).toThrow('ordered')
})

it('refuses reuse in a different complete call context and preserves a successful primary path', async () => {
  const inputs = structuredClone(boats.inputs)
  const train = inputs.snapshots.flatMap(d => d.trains).find(t => t.routeId === binding.routeId && t.calls.some((c, i) => c.id === binding.fromId && t.calls[i + 1]?.id === binding.toId))
  train.directionId = 'unreviewed'
  await expect(loadLuzernOsmBoats(boats.policy.osmSupplement, inputs, boats.lakes, original)).rejects.toThrow('complete ferry pattern')
  await expect(loadLuzernOsmBoats(boats.policy.osmSupplement, boats.inputs, boats.lakes, new Map([[key, pair]]))).rejects.toThrow()
})
