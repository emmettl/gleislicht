import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { applyThurgauGeometry } from './thurgau-line-geometry.mjs'
import { loadThurgauBoats } from './thurgau-boat-geometry.mjs'
import { loadThurgauFerry, thurgauFerryGeometry, THURGAU_FERRY_SOURCE } from './thurgau-ferry.mjs'
import { distanceMetres } from './water-paths.mjs'
const zipped = p => JSON.parse(gunzipSync(readFileSync(p)))
const timetable = zipped('data/thurgau-audit/timetable-cache.json.gz'), source = zipped('data/thurgau-sources/decoded.json.gz')
const crosswalk = JSON.parse(readFileSync('data/thurgau-line-crosswalk.json')), routes = new Map(timetable.routes.map(r => [r.id, r]))
const boats = await loadThurgauBoats(timetable), ferry = await loadThurgauFerry(timetable)
const osm = zipped('data/thurgau-ferry-sources/osm.json.gz')
const apply = (raw, trains, supplement = ferry) => applyThurgauGeometry({ ...raw, trains }, routes, source, crosswalk, undefined, undefined, undefined, boats, undefined, supplement)

it('adds both original SBS/BSB directions on Friday and Sunday and retains every existing boat path', () => {
  for (const [i, raw] of timetable.snapshots.entries()) {
    const trains = raw.trains.filter(t => routes.get(t.routeId).mode === 'ferry')
    const before = apply(raw, trains, null), after = apply(raw, trains), previous = new Map(before.trains.map(t => [t.id, t]))
    expect(after.trains.filter(t => t.admission === 'admitted')).toHaveLength(i ? 54 : 58)
    const added = after.trains.filter(t => t.geometrySource === THURGAU_FERRY_SOURCE)
    expect(added).toHaveLength(i ? 28 : 32)
    expect(new Set(added.map(t => `${t.agencyId}:${t.directionId}`))).toEqual(new Set(['195:0', '195:1', '360:0', '360:1']))
    for (const [j, t] of after.trains.entries()) {
      expect(t.stops).toEqual(trains[j].stops); expect(t.callPermissions).toEqual(trains[j].callPermissions)
      const old = previous.get(t.id)
      if (old.admission === 'admitted') expect(t.pathSegments.map(k => after.paths[k])).toEqual(old.pathSegments.map(k => before.paths[k]))
      if (t.geometrySource !== THURGAU_FERRY_SOURCE) continue
      const path = after.paths[t.pathSegments[0]], p = after.patterns.find(p => p.id === t.patternId)
      expect(p.boatSupplement.status).toBe('rejected-incomplete-pattern')
      expect(p.ferrySupplement.water.landCrossing).toBe(false)
      expect(p.ferrySupplement.maximumSnapMetres).toBeLessThan(5)
      expect(p.ferrySupplement.pathMetres).toBeGreaterThan(13000); expect(path).toHaveLength(35)
      const way = osm.elements.find(e => e.type === 'way' && e.id === ferry.policy.wayId)
      const vertices = way.nodes.map(id => { const n = osm.elements.find(e => e.type === 'node' && e.id === id); return [n.lon, n.lat] })
      expect(path.slice(1, -1)).toEqual(p.ferrySupplement.direction === 'forward' ? vertices : vertices.reverse())
      expect(distanceMetres(path[0], raw.stops[t.stops[0][0]])).toBeLessThan(.02)
      expect(distanceMetres(path.at(-1), raw.stops[t.stops[1][0]])).toBeLessThan(.02)
      expect(t.stops[1][1] - t.stops[0][2]).toBe(46 * 60)
    }
  }
})
it('fails closed for a changed dock, operator, direction or intermediate call and retains reservation exclusion', () => {
  const raw = timetable.snapshots[0], t = raw.trains.find(t => t.routeId === '94-381-0-j26-1')
  for (const changed of [{ ...t, agencyId: '360' }, { ...t, directionId: '9' }, { ...t, stops: [...t.stops, t.stops[0]] }]) expect(() => apply(raw, [changed])).toThrow()
  const changed = structuredClone(raw); changed.stops[t.stops[0][0]][0] += .001
  expect(() => apply(changed, [t])).toThrow()
  expect(apply(raw, [{ ...t, reservationRequired: true }]).trains[0].admission).toBe('reservation-or-demand-responsive')
})
it('rejects any changed selected source vertex, missing node or incomplete response', () => {
  const nodeId = osm.elements.find(e => e.type === 'way' && e.id === ferry.policy.wayId).nodes[5]
  const changed = structuredClone(osm); for (const e of changed.elements.filter(e => e.type === 'node' && e.id === nodeId)) e.lon += .00001
  expect(() => thurgauFerryGeometry(changed, ferry.polygons, ferry.policy)).toThrow('Changed selected ferry geometry')
  expect(() => thurgauFerryGeometry({ ...osm, elements: osm.elements.filter(e => !(e.type === 'node' && e.id === nodeId)) }, ferry.polygons, ferry.policy)).toThrow('Missing ferry source node')
  expect(() => thurgauFerryGeometry({ ...osm, remark: 'timeout' }, ferry.polygons, ferry.policy)).toThrow('Incomplete ferry source')
})
it('rejects entire ferry journeys for a thin remote island and for attachments outside the tight bound', () => {
  const p = ferry.paths[0].path, a = p[17], b = p[18], x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2
  const polygons = [[[[9, 47], [10, 47], [10, 48], [9, 48], [9, 47]], [[x - .000005, y - .001], [x + .000005, y - .001], [x + .000005, y + .001], [x - .000005, y + .001], [x - .000005, y - .001]]]]
  const bad = { ...ferry, ...thurgauFerryGeometry(osm, polygons, ferry.policy) }
  expect(bad.paths.every(p => p.reason === 'ferry-outside-reviewed-water' && !p.path)).toBe(true)
  const raw = timetable.snapshots[0], t = raw.trains.find(t => t.routeId === '94-381-0-j26-1')
  const result = apply(raw, [t], bad)
  expect(result.trains[0].admission).toBe('incomplete-boat-pattern'); expect(result.trains[0].stops).toEqual(t.stops)
  const tight = thurgauFerryGeometry(osm, ferry.polygons, { ...ferry.policy, limits: { ...ferry.policy.limits, snapMetres: 1 } })
  expect(tight.paths.every(p => p.reason === 'endpoint-gap' && !p.path)).toBe(true)
})
