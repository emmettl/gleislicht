import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { loadThurgauWittenbach, wittenbachTurnaround } from './thurgau-wittenbach.mjs'
import { applyThurgauGeometry } from './thurgau-line-geometry.mjs'
const z = p => JSON.parse(gunzipSync(readFileSync(p))), j = p => JSON.parse(readFileSync(p))
const timetable = z('data/thurgau-audit/timetable-cache.json.gz'), roads = z('data/thurgau-regional-roads/cache.json.gz'), source = z('data/thurgau-sources/decoded.json.gz')
const routes = new Map(timetable.routes.map(r => [r.id, r])), crosswalk = j('data/thurgau-line-crosswalk.json')
const supplement = await loadThurgauWittenbach(timetable, roads), ids = new Set(supplement.policy.patterns.map(p => p.routeId))
const apply = (raw, trains, extra) => applyThurgauGeometry({ ...raw, trains }, routes, source, crosswalk, undefined, roads, undefined, undefined, extra)
it('adds exactly the four Friday patterns while retaining all calls and their own subsequent road slices', () => {
  for (const raw of timetable.snapshots) {
    const trains = raw.trains.filter(t => ids.has(t.routeId)), before = apply(raw, trains), after = apply(raw, trains, supplement)
    const newly = after.trains.filter((t, i) => t.admission === 'admitted' && before.trains[i].admission !== 'admitted')
    expect(newly).toHaveLength(raw.metadata.serviceDate === '2026-09-04' ? 37 : 0)
    expect(after.trains.every(t => t.admission === 'admitted')).toBe(true)
    for (const [i, t] of after.trains.entries()) {
      expect(t.stops).toEqual(trains[i].stops); expect(t.callPermissions).toEqual(trains[i].callPermissions)
      if (before.trains[i].admission === 'admitted') expect(t.pathSegments.map(p => after.paths[p])).toEqual(before.trains[i].pathSegments.map(p => before.paths[p]))
      else {
        const p = after.patterns.find(p => p.id === t.patternId), cache = roads.caches['801']
        expect(p.wittenbachSupplement.previousRoadFailure.status).toBe('rejected-incomplete-pattern')
        for (let k = 1; k < t.pathSegments.length; k++) {
          const expected = structuredClone(cache.paths[cache.patterns[p.roadPatternId][k]])
          expected[0] = raw.stops[t.stops[k][0]].slice(0, 2); expected[expected.length - 1] = raw.stops[t.stops[k + 1][0]].slice(0, 2)
          expect(after.paths[t.pathSegments[k]]).toEqual(expected)
        }
      }
    }
  }
})
it('keeps reservation exclusion and cannot reuse the turnaround for a changed chain or direction', () => {
  const raw = timetable.snapshots[0], train = raw.trains.find(t => ids.has(t.routeId) && raw.stops[t.stops[0][0]][4] === supplement.policy.from[4] && raw.stops[t.stops[1][0]][4] === supplement.policy.to[4])
  expect(apply(raw, [{ ...train, reservationRequired: true }], supplement).trains[0].admission).toBe('reservation-or-demand-responsive')
  expect(() => apply(raw, [{ ...train, directionId: '0' }], supplement)).toThrow()
  const changed = structuredClone(raw); changed.stops[train.stops[0][0]][0] += .00001
  expect(() => apply(changed, [train], supplement)).toThrow('Changed/missing regional road pattern')
})
it('rejects reversed ring direction, new restrictions and changed reviewed road tags', () => {
  const osm = z('data/thurgau-wittenbach-sources/osm.json.gz'), restrictions = z('data/thurgau-wittenbach-sources/restrictions.json.gz')
  const changed = structuredClone(osm)
  for (const e of changed.elements.filter(e => e.type === 'way' && e.id === 1111858974)) e.tags.bus = 'no'
  expect(() => wittenbachTurnaround(changed, restrictions, supplement.policy)).toThrow('Changed reviewed source element')
  expect(() => wittenbachTurnaround(osm, { ...restrictions, elements: [...restrictions.elements, { id: 42 }] }, supplement.policy)).toThrow('Changed restriction inventory')
  const reverse = structuredClone(osm), p = structuredClone(supplement.policy)
  for (const e of reverse.elements.filter(e => e.type === 'way' && e.id === 26647200)) e.nodes.reverse()
  p.features.find(e => e.type === 'way' && e.id === 26647200).sha256 = createHash('sha256').update(JSON.stringify(reverse.elements.find(e => e.type === 'way' && e.id === 26647200))).digest('hex')
  expect(() => wittenbachTurnaround(reverse, restrictions, p)).toThrow('Reversed roundabout traffic direction')
})
it('requires opposite platform sides and bounded attachment without moving either stop', () => {
  const osm = z('data/thurgau-wittenbach-sources/osm.json.gz'), restrictions = z('data/thurgau-wittenbach-sources/restrictions.json.gz')
  expect(supplement.turn.roadMetres).toBeGreaterThan(220); expect(supplement.turn.roadMetres).toBeLessThan(225)
  expect(supplement.turn.attachmentsMetres.every(m => m < 7)).toBe(true)
  const p = structuredClone(supplement.policy); p.to[1] = p.from[1]
  expect(() => wittenbachTurnaround(osm, restrictions, p)).toThrow('Platforms no longer lie on opposite')
  p.to[1] += .001
  expect(() => wittenbachTurnaround(osm, restrictions, p)).toThrow('Changed platform attachment')
})
