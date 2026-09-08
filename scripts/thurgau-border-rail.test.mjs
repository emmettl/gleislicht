import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadThurgauBorderRail, thurgauBorderGraph } from './thurgau-border-rail.mjs'
import { loadThurgauRail } from './thurgau-rail-geometry.mjs'
import { applyThurgauGeometry } from './thurgau-line-geometry.mjs'
const zipped = p => JSON.parse(gunzipSync(readFileSync(p))), json = p => JSON.parse(readFileSync(p))
const timetable = zipped('data/thurgau-audit/timetable-cache.json.gz'), source = zipped('data/thurgau-sources/decoded.json.gz')
const crosswalk = json('data/thurgau-line-crosswalk.json'), routes = new Map(timetable.routes.map(r => [r.id, r]))
const rail = await loadThurgauRail(timetable), before = await loadThurgauRail(timetable, { border: false }), border = await loadThurgauBorderRail(timetable)
const stop = s => ({ stop_id: s[4], stop_lon: s[0], stop_lat: s[1] })
it('admits complete Bregenz patterns through platform 3 on both dates and in both directions', () => {
  for (const day of timetable.snapshots) {
    const trains = day.trains.filter(t => t.stops.some(([i]) => day.stops[i][4] === '8102336'))
    const apply = m => applyThurgauGeometry({ ...day, trains }, routes, source, crosswalk, undefined, undefined, m)
    const result = apply(rail), old = apply(before)
    expect(old.trains.every(t => t.admission !== 'admitted')).toBe(true)
    for (const [i, t] of result.trains.entries()) {
      const platform = trains[i].stops.map(([i]) => day.stops[i]).find(s => /6314:2:/.test(s[4]))[3]
      expect(t.admission === 'admitted').toBe(platform === '3')
      expect(t.stops).toEqual(trains[i].stops); expect(t.callPermissions).toEqual(trains[i].callPermissions)
      if (platform === '3') {
        expect(t.geometrySource).toBe('fot-osm-border-rail-inference')
        for (const [j, index] of t.pathSegments.entries()) {
          expect(result.paths[index][0]).toEqual(day.stops[t.stops[j][0]].slice(0, 2).map(n => Number(n.toFixed(7))))
          expect(result.paths[index].at(-1)).toEqual(day.stops[t.stops[j + 1][0]].slice(0, 2).map(n => Number(n.toFixed(7))))
        }
      }
    }
    expect(new Set(result.trains.filter(t => t.admission === 'admitted').map(t => t.directionId)).size).toBe(2)
  }
})
it('rejects the platform-2 route that requires a reversing movement at a rail junction', () => {
  const day = timetable.snapshots[0], a = stop(day.stops.find(s => s[4] === 'ch:1:sloid:6314:2:2')), b = stop(day.stops.find(s => s[4] === '8102336'))
  expect(border.match(a, b).reason).toBe('border-disconnected-detour-or-turn')
  const policy = { ...border.policy, limits: { ...border.policy.limits, maximumTurnDegrees: 180 } }
  const permissive = thurgauBorderGraph(zipped('data/thurgau-border-rail-sources/osm.json.gz'), policy)
  expect(permissive.match(a, b).path).toBeDefined()
})
it('rejects changed UIC identity, source gauge, distant stop and future way metadata', () => {
  const osm = zipped('data/thurgau-border-rail-sources/osm.json.gz'), p = border.policy
  const changed = structuredClone(osm); changed.elements.find(n => n.id === p.stations[1].nodeId && n.tags).tags.uic_ref = '8100000'
  expect(() => thurgauBorderGraph(changed, p)).toThrow()
  const future = structuredClone(osm); future.elements.find(n => n.type === 'way').timestamp = '2026-10-01T00:00:00Z'
  expect(() => thurgauBorderGraph(future, p)).toThrow('Way newer')
  const day = timetable.snapshots[0], a = stop(day.stops.find(s => s[4] === 'ch:1:sloid:6314:2:3')), b = stop(day.stops.find(s => s[4] === '8102336'))
  const narrow = structuredClone(osm); for (const w of narrow.elements.filter(n => n.type === 'way')) w.tags.gauge = '1000'
  expect(thurgauBorderGraph(narrow, p).match(a, b).path).toBeUndefined()
  expect(border.match(a, { ...b, stop_lat: b.stop_lat + .01 }).reason).toBe('border-station-identity-too-far')
})
it('does not connect coincident coordinates with different OSM node IDs', () => {
  const p = structuredClone(border.policy); p.stations[0].nodeId = 1; p.stations[1].nodeId = 4
  const coords = [9.63, 9.645, 9.645, 9.66]
  const elements = coords.map((lon, i) => ({ type: 'node', id: i + 1, lon, lat: 47.45,
    tags: i === 0 || i === 3 ? { uic_ref: p.stations[i === 0 ? 0 : 1].number, name: p.stations[i === 0 ? 0 : 1].name } : undefined }))
  for (const [id, nodes] of [[11, [1, 2]], [12, [3, 4]]]) elements.push({ type: 'way', id, nodes, timestamp: p.snapshot, tags: { railway: 'rail', gauge: '1435', usage: 'main' } })
  const a = { stop_id: '8506314', stop_lon: 9.63, stop_lat: 47.45 }, b = { stop_id: '8102336', stop_lon: 9.66, stop_lat: 47.45 }
  expect(thurgauBorderGraph({ elements }, p).match(a, b).path).toBeUndefined()
})
