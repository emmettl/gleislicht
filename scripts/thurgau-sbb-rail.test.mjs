import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadThurgauRail } from './thurgau-rail-geometry.mjs'
import { thurgauSbbNetwork } from './thurgau-sbb-rail.mjs'
import { applyThurgauGeometry } from './thurgau-line-geometry.mjs'
import { parseLuzernRail } from './luzern-rail-geometry.mjs'

const json = p => JSON.parse(readFileSync(p)), zipped = p => JSON.parse(gunzipSync(readFileSync(p)))
const timetable = zipped('data/thurgau-audit/timetable-cache.json.gz')
const source = zipped('data/thurgau-sources/decoded.json.gz'), crosswalk = json('data/thurgau-line-crosswalk.json')
const routes = new Map(timetable.routes.map(r => [r.id, r])), rail = await loadThurgauRail(timetable)
const primary = await loadThurgauRail(timetable, { sbb: false })
const policy = json('data/thurgau-sbb-rail-policy.json'), page = json('data/thurgau-sbb-rail-sources/foreign-review.json')
const network = parseLuzernRail(gunzipSync(readFileSync('data/thurgau-rail-sources/network.xtf.gz')).toString())
const apply = (d, context) => applyThurgauGeometry(d, routes, source, crosswalk, undefined, undefined, context)

it('admits every Konstanz weekday/Sunday directed pattern, keeping all calls and both border approaches', () => {
  const directions = new Map()
  for (const day of timetable.snapshots) {
    const trains = day.trains.filter(t => t.stops.some(([i]) => day.stops[i][4] === '8014586'))
    const result = apply({ ...day, trains }, rail)
    expect(result.trains.length).toBe(day.metadata.serviceDate === '2026-09-04' ? 212 : 207)
    for (const [i, t] of result.trains.entries()) {
      expect(t.admission).toBe('admitted'); expect(t.geometrySource).toBe('fot-sbb-rail-inference')
      expect(t.stops).toEqual(trains[i].stops); expect(t.callPermissions).toEqual(trains[i].callPermissions)
      for (const [j, id] of t.pathSegments.entries()) {
        const path = result.paths[id]
        expect(path[0]).toEqual(day.stops[t.stops[j][0]].slice(0, 2).map(n => Number(n.toFixed(7))))
        expect(path.at(-1)).toEqual(day.stops[t.stops[j + 1][0]].slice(0, 2).map(n => Number(n.toFixed(7))))
      }
    }
    for (const p of result.patterns) {
      expect(p.railSupplement.status).toBe('admitted')
      for (const s of p.railSupplement.segments) for (const e of s.directedSourceSegments) if (e.id.startsWith('sbb:')) {
        const seen = directions.get(e.id) ?? new Set(); seen.add(e.from); directions.set(e.id, seen)
      }
    }
  }
  expect([...directions.keys()].sort()).toEqual(policy.segments.map(s => s.id).sort())
  expect([...directions.values()].map(s => s.size)).toEqual([2, 2])
})

it('preserves every complete federal-only path and admission on both days', () => {
  for (const day of timetable.snapshots) {
    const d = { ...day, trains: day.trains.filter(t => ['11', '65'].includes(t.agencyId)) }
    const before = apply(d, primary), after = apply(d, rail), byId = new Map(after.trains.map(t => [t.id, t]))
    for (const t of before.trains.filter(t => t.admission === 'admitted')) {
      const changed = byId.get(t.id)
      expect(changed.admission).toBe('admitted')
      expect(changed.pathSegments.map(i => after.paths[i])).toEqual(t.pathSegments.map(i => before.paths[i]))
    }
  }
})

it('rejects schematic geometry, a renamed source node, a changed gauge and an excessive join', () => {
  const index = page.results.findIndex(r => r.bp_anfang === 'KRGR' && r.bp_ende === 'KODB')
  for (const mutate of [
    r => { r.geo_shape.geometry.coordinates = [r.geo_shape.geometry.coordinates[0], r.geo_shape.geometry.coordinates.at(-1)] },
    r => { r.spurweite = 'S' },
    r => { r.geo_shape.geometry.coordinates[0][0] += 0.001 },
  ]) {
    const changed = structuredClone(page); mutate(changed.results[index])
    expect(() => thurgauSbbNetwork(network, changed, policy)).toThrow()
  }
  const changed = structuredClone(network); changed.nodes.get(policy.segments[0].nodeId).name = 'Other border'
  expect(() => thurgauSbbNetwork(changed, page, policy)).toThrow()
  expect(() => thurgauSbbNetwork(network, { ...page, total_count: 60 }, policy)).toThrow('Truncated')
})

it('does not admit a distant Konstanz stop or reinterpret another foreign stop identity', () => {
  for (const change of [s => { s[0] += 0.01 }, s => { s[4] = '8014587' }]) {
    const day = structuredClone(timetable.snapshots[0]), t = day.trains.find(t => t.route === 'IR75' && t.stops.some(([i]) => day.stops[i][4] === '8014586'))
    change(day.stops.find(s => s[4] === '8014586'))
    expect(apply({ ...day, trains: [t] }, rail).trains[0].admission).not.toBe('admitted')
  }
})
