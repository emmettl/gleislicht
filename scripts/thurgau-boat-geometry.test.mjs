import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { applyThurgauGeometry } from './thurgau-line-geometry.mjs'
import { loadThurgauBoats, thurgauBoatGeometry } from './thurgau-boat-geometry.mjs'
import { distanceMetres } from './water-paths.mjs'

const zipped = p => JSON.parse(gunzipSync(readFileSync(p)))
const timetable = zipped('data/thurgau-audit/timetable-cache.json.gz'), source = zipped('data/thurgau-sources/decoded.json.gz')
const crosswalk = JSON.parse(readFileSync('data/thurgau-line-crosswalk.json')), routes = new Map(timetable.routes.map(r => [r.id, r]))
const boats = await loadThurgauBoats(timetable)
const apply = (raw, trains, context = boats) => applyThurgauGeometry({ ...raw, trains }, routes, source, crosswalk, undefined, undefined, undefined, context)

it('retains both dated directions, complete foreign dock chains, times and permissions', () => {
  for (const raw of timetable.snapshots) {
    const trains = raw.trains.filter(t => routes.get(t.routeId).mode === 'ferry'), result = apply(raw, trains)
    expect(result.trains.filter(t => t.admission === 'admitted')).toHaveLength(26)
    expect(new Set(result.trains.filter(t => t.admission === 'admitted').map(t => t.directionId))).toEqual(new Set(['0', '1']))
    for (const [i, train] of result.trains.entries()) {
      expect(train.stops).toEqual(trains[i].stops); expect(train.callPermissions).toEqual(trains[i].callPermissions)
      const p = result.patterns.find(p => p.id === train.patternId)
      if (train.admission !== 'admitted') {
        expect(train.admission).toBe('incomplete-boat-pattern')
        expect(p.boatSupplement.segments.some(s => s.reason)).toBe(true)
        continue
      }
      expect(p.boatSupplement.segments.every(s => !s.water.landCrossing && s.maximumSnapMetres <= 150)).toBe(true)
      for (const [j, index] of train.pathSegments.entries()) {
        expect(distanceMetres(result.paths[index][0], raw.stops[train.stops[j][0]])).toBeLessThan(.02)
        expect(distanceMetres(result.paths[index].at(-1), raw.stops[train.stops[j + 1][0]])).toBeLessThan(.02)
      }
    }
    expect(result.trains.filter(t => t.routeId === '94-T-Y-j26-1' && t.admission === 'admitted')).toHaveLength(18)
    expect(result.trains.filter(t => t.routeId === '94-382-A-j26-1' && t.admission === 'admitted')).toHaveLength(4)
    expect(result.trains.filter(t => t.routeId === '94-382-0-j26-1').every(t => t.admission !== 'admitted')).toBe(true)
  }
})
it('rejects the whole journey for one failed segment and preserves reservation exclusion', () => {
  const raw = timetable.snapshots[0], train = raw.trains.find(t => t.routeId === '94-382-A-j26-1')
  const failure = { ...boats, matchPattern(...args) { return boats.matchPattern(...args).map((s, i) => i ? s : { reason: 'missing-water' }) } }
  const result = apply(raw, [train], failure)
  expect(result.trains[0].admission).toBe('incomplete-boat-pattern'); expect(result.trains[0].stops).toEqual(train.stops)
  expect(apply(raw, [{ ...train, reservationRequired: true }]).trains[0].admission).toBe('reservation-or-demand-responsive')
})
it('requires the exact reviewed route, operator, direction and original dock coordinates', () => {
  const raw = timetable.snapshots[0], train = raw.trains.find(t => t.routeId === '94-T-Y-j26-1'), route = routes.get(train.routeId)
  expect(() => boats.matchPattern({ ...train, agencyId: '195' }, raw, route)).toThrow('Changed boat route identity')
  expect(() => boats.matchPattern({ ...train, directionId: '99' }, raw, route)).toThrow('Unreviewed boat dock chain')
  const changed = structuredClone(raw); changed.stops[train.stops[0][0]][0] += .001
  expect(() => boats.matchPattern(train, changed, route)).toThrow('Unreviewed boat dock chain')
})
it('rejects a thin remote island even when endpoints and the source line match', () => {
  const a = [9, 47.6], b = [9.02, 47.6]
  const feature = { id: 'shipping', layerBodId: 'ch.swisstopo.vec200-transportation-oeffentliche-verkehr', properties: { objval: 'Kursschiff_Linie' }, geometry: { type: 'LineString', coordinates: [a, b] } }
  const polygon = [[[8.99, 47.59], [9.03, 47.59], [9.03, 47.61], [8.99, 47.61], [8.99, 47.59]],
    [[9.00999, 47.599], [9.01001, 47.599], [9.01001, 47.601], [9.00999, 47.601], [9.00999, 47.599]]]
  const match = thurgauBoatGeometry([feature], [polygon], { ...boats.policy, sourceFeatureIds: ['shipping'] })
  const result = match(a, b)
  expect(result.reason).toBe('boat-outside-reviewed-water'); expect(result.path).toBeUndefined()
  expect(result.water.outsideIntervals.some(i => i.dock === null && i.lengthMetres < 2)).toBe(true)
})
