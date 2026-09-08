import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { applyThurgauGeometry } from './thurgau-line-geometry.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'

const load = path => JSON.parse(gunzipSync(readFileSync(path)))
const source = load('data/thurgau-sources/decoded.json.gz')
const timetable = load('data/thurgau-audit/timetable-cache.json.gz')
const bundle = load('data/thurgau-city-roads/cache.json.gz')
const crosswalk = JSON.parse(readFileSync('data/thurgau-line-crosswalk.json'))
const routes = new Map(timetable.routes.map(r => [r.id, r]))
const raw = timetable.snapshots[0]
const train = raw.trains.find(t => t.agencyId === '797' && t.route === '811')
const match = (t, roads = bundle) => applyThurgauGeometry({ ...raw, trains: [t] }, routes, source, crosswalk, roads)

it('admits the complete Sunday/evening loop while preserving every call and time', () => {
  const result = match(train)
  expect(result.trains[0].admission).toBe('admitted')
  expect(result.trains[0].stops).toEqual(train.stops)
  expect(result.trains[0].pathSegments).toHaveLength(train.stops.length - 1)
  expect(result.patterns[0].geometrySource).toBe('osm-city-road')
  expect(result.patterns[0].sourceLines).toEqual([])
})
it('rejects a moved platform instead of reusing a nearby or same-number route', () => {
  const changed = structuredClone(raw)
  changed.trains = [train]; changed.stops[train.stops[1][0]][0] += 0.00001
  expect(() => applyThurgauGeometry(changed, routes, source, crosswalk, bundle)).toThrow('city road pattern')
})
it('fails closed when a source road segment is missing', () => {
  const changed = structuredClone(bundle)
  changed.caches['797'].patterns[roadPatternId(train, raw.stops)][0] = null
  expect(() => match(train, changed)).toThrow('city road pattern')
})
it('requires ordered platform chains, not reverse reuse or stop-pair borrowing', () => {
  const changed = { ...train, stops: [...train.stops] }
  ;[changed.stops[1], changed.stops[2]] = [changed.stops[2], changed.stops[1]]
  expect(() => match(changed)).toThrow('city road pattern')
})
it('retains the explicit night-taxi exclusion and reservation policy', () => {
  const night = raw.trains.find(t => t.agencyId === '797' && t.route === 'NT')
  expect(match(night).trains[0].admission).toBe('demand-responsive-night-taxi')
  expect(match({ ...train, reservationRequired: true }).trains[0].admission).toBe('reservation-or-demand-responsive')
})
