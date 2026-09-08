import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { applyThurgauGeometry } from './thurgau-line-geometry.mjs'
import { loadThurgauBoats } from './thurgau-boat-geometry.mjs'
import { loadThurgauFerry } from './thurgau-ferry.mjs'
import { loadThurgauShipping, thurgauShippingGeometry, thurgauRhinePolygon, THURGAU_SHIPPING_SOURCE } from './thurgau-shipping.mjs'
import { auditZugBoatWater } from './zug-boat-geometry.mjs'
const json = p => JSON.parse(readFileSync(p)), zipped = p => JSON.parse(gunzipSync(readFileSync(p)))
const timetable = zipped('data/thurgau-audit/timetable-cache.json.gz'), source = zipped('data/thurgau-sources/decoded.json.gz'), crosswalk = json('data/thurgau-line-crosswalk.json')
const routes = new Map(timetable.routes.map(r => [r.id, r])), boats = await loadThurgauBoats(timetable), ferry = await loadThurgauFerry(timetable), shipping = await loadThurgauShipping(timetable)
const previous = json('data/thurgau-boat-sources/path-review.json'), osm = zipped('data/thurgau-shipping-sources/osm.json.gz'), water = zipped('data/thurgau-shipping-sources/water.json.gz')
const lake = zipped('data/thurgau-boat-sources/lakes.json.gz').results.find(f => f.id === 124).geometry.coordinates
const apply = (raw, trains, supplement = shipping) => applyThurgauGeometry({ ...raw, trains }, routes, source, crosswalk, undefined, undefined, undefined, boats, undefined, ferry, supplement)
it('adds complete SBS and URh patterns in both directions while preserving prior boats and original successful segments', () => {
  for (const [i, raw] of timetable.snapshots.entries()) {
    const trains = raw.trains.filter(t => routes.get(t.routeId).mode === 'ferry'), before = apply(raw, trains, null), after = apply(raw, trains)
    expect(after.trains.filter(t => t.admission === 'admitted')).toHaveLength(i ? 75 : 80)
    expect(after.trains.filter(t => t.admission !== 'admitted')).toHaveLength(12)
    const added = after.trains.filter(t => t.geometrySource === THURGAU_SHIPPING_SOURCE)
    expect(added).toHaveLength(i ? 21 : 22)
    expect(added.filter(t => t.agencyId === '193')).toHaveLength(8)
    expect(new Set(added.map(t => t.directionId))).toEqual(new Set(['0', '1']))
    for (const [j, train] of after.trains.entries()) {
      expect(train.stops).toEqual(trains[j].stops); expect(train.callPermissions).toEqual(trains[j].callPermissions)
      const old = before.trains.find(t => t.id === train.id)
      if (old.admission === 'admitted') expect(train.pathSegments.map(k => after.paths[k])).toEqual(old.pathSegments.map(k => before.paths[k]))
      if (train.geometrySource !== THURGAU_SHIPPING_SOURCE) continue
      const p = after.patterns.find(p => p.id === train.patternId)
      expect(p.shippingSupplement.segments.every(s => !s.water.landCrossing)).toBe(true)
      const original = previous.patterns.find(p => p.routeId === train.routeId && p.directionId === train.directionId && JSON.stringify(p.calls) === JSON.stringify(train.stops.map(([k]) => raw.stops[k])))
      for (const [k, s] of original.segments.entries()) if (s.path) expect(after.paths[train.pathSegments[k]]).toEqual(s.path)
    }
  }
})
it('rejects a whole pattern for one failed segment and retains reservation exclusions', () => {
  const raw = timetable.snapshots[0], p = shipping.patterns.find(p => p.admitted && p.calls.length > 3)
  const train = raw.trains.find(t => t.routeId === p.routeId && t.directionId === p.directionId && JSON.stringify(t.stops.map(([i]) => raw.stops[i])) === JSON.stringify(p.calls))
  const bad = { ...shipping, patterns: shipping.patterns.map(q => q.key === p.key ? { ...q, segments: q.segments.map((s, i) => i ? s : { reason: 'missing-geometry' }) } : q) }
  const result = apply(raw, [train], bad)
  expect(result.trains[0].admission).toBe('incomplete-boat-pattern'); expect(result.trains[0].stops).toEqual(train.stops)
  expect(apply(raw, [{ ...train, reservationRequired: true }]).trains[0].admission).toBe('reservation-or-demand-responsive')
})
it('rejects changed coordinates, direction and operator identities', () => {
  const raw = timetable.snapshots[0], t = raw.trains.find(t => t.routeId === '94-382-0-j26-1' && t.stops.length === 3)
  for (const changed of [{ ...t, agencyId: '195' }, { ...t, directionId: '9' }, { ...t, stops: t.stops.slice(1) }]) expect(() => apply(raw, [changed])).toThrow()
  const modified = structuredClone(raw); modified.stops[t.stops[0][0]][0] += .001
  expect(() => apply(modified, [t])).toThrow()
})
it('pins river island membership and ferry vertices, rejecting altered or incomplete sources', () => {
  const missingHole = structuredClone(water); missingHole.elements.find(e => e.type === 'relation' && e.id === 1679977).members.pop()
  expect(() => thurgauRhinePolygon(missingHole, shipping.policy)).toThrow('island membership')
  const moved = structuredClone(osm), way = moved.elements.find(e => e.type === 'way' && e.id === 66929232)
  for (const n of moved.elements.filter(e => e.type === 'node' && e.id === way.nodes[4])) n.lon += .00001
  expect(() => thurgauShippingGeometry(moved, water, lake, previous, shipping.policy)).toThrow('Changed selected shipping geometry')
  expect(() => thurgauShippingGeometry({ ...osm, remark: 'timeout' }, water, lake, previous, shipping.policy)).toThrow('Incomplete shipping response')
})
it('retains the real Rhine island and rejects a thin lake island in a proposed replacement', () => {
  const polygon = shipping.riverPolygon, hole = polygon[1]
  const crossing = [hole[0], hole[Math.floor(hole.length / 2)]]
  expect(auditZugBoatWater(crossing, [polygon], [], 0).landCrossing).toBe(true)
  expect(auditZugBoatWater(crossing, [[polygon[0]]], [], 0).landCrossing).toBe(false)
  const p = shipping.patterns.find(p => p.admitted && p.segments.some(s => s.wayId === 96604650)), path = p.segments.find(s => s.wayId === 96604650).path, a = path[5], b = path[6], x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2
  const island = [[x - .000005, z - .001], [x + .000005, z - .001], [x + .000005, z + .001], [x - .000005, z + .001], [x - .000005, z - .001]]
  const testLake = [[[[9, 47], [10, 47], [10, 48], [9, 48], [9, 47]], island]]
  const result = thurgauShippingGeometry(osm, water, testLake, previous, shipping.policy)
  expect(result.patterns.filter(q => q.segments.some(s => s.wayId === 96604650)).every(q => !q.admitted)).toBe(true)
})
