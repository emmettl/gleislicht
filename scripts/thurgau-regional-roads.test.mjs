import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { applyThurgauGeometry } from './thurgau-line-geometry.mjs'
import { thurgauCoverage } from './build-thurgau-region.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'

const load = path => JSON.parse(gunzipSync(readFileSync(path)))
const source = load('data/thurgau-sources/decoded.json.gz')
const timetable = load('data/thurgau-audit/timetable-cache.json.gz')
const bundle = load('data/thurgau-regional-roads/cache.json.gz')
const city = load('data/thurgau-city-roads/cache.json.gz')
const crosswalk = JSON.parse(readFileSync('data/thurgau-line-crosswalk.json'))
const routes = new Map(timetable.routes.map(r => [r.id, r]))
const raw = timetable.snapshots[0]
const train = raw.trains.find(t => t.agencyId === '801' && t.route === '823')
const match = (trains, roads = bundle, fixture = raw) => applyThurgauGeometry({ ...fixture, trains }, routes, source, crosswalk, city, roads)

it('admits complete regional patterns in both directions on Friday and Sunday without changing calls or times', () => {
  for (const fixture of timetable.snapshots) for (const direction of ['0', '1']) {
    const t = fixture.trains.find(t => t.agencyId === '801' && t.route === '823' && t.directionId === direction)
    expect(t).toBeDefined()
    const result = match([t], bundle, fixture), output = result.trains[0]
    expect(output.admission).toBe('admitted')
    expect(output.geometrySource).toBe('osm-regional-road')
    expect(output.stops).toEqual(t.stops)
    expect(output.callPermissions).toEqual(t.callPermissions)
    output.pathSegments.forEach((index, i) => {
      expect(result.paths[index][0]).toEqual(fixture.stops[t.stops[i][0]].slice(0, 2))
      expect(result.paths[index].at(-1)).toEqual(fixture.stops[t.stops[i + 1][0]].slice(0, 2))
    })
  }
})
it('preserves existing complete official patterns and city geometry exactly', () => {
  const trains = raw.trains.filter(t => t.agencyId === '801' && t.route === '847' || t.agencyId === '797' && t.route === '811')
  const after = match(trains)
  // Explicitly call the official/city adapter without the optional regional bundle.
  const original = applyThurgauGeometry({ ...raw, trains }, routes, source, crosswalk, city)
  for (const [i, t] of after.trains.entries()) {
    expect(t.stops).toEqual(original.trains[i].stops)
    expect(t.admission).toBe(original.trains[i].admission)
    expect(t.pathSegments.map(p => after.paths[p])).toEqual(original.trains[i].pathSegments.map(p => original.paths[p]))
  }
})
it('excludes type-715 RUB despite ordinary pickup flags on both civil dates', () => {
  for (const fixture of timetable.snapshots) {
    const t = fixture.trains.find(t => t.route === 'RUB')
    expect(t.reservationRequired).toBe(false)
    expect(match([t], bundle, fixture).trains[0].admission).toBe('demand-responsive-route-type')
  }
})
it('rejects the entire real Wittenbach pattern without dropping its distinct same-name platforms', () => {
  const key = bundle.caches['801'].report.issues[0].pattern
  const t = raw.trains.find(t => roadPatternId(t, raw.stops) === key)
  const result = match([t])
  expect(result.trains[0].admission).not.toBe('admitted')
  expect(result.trains[0].stops).toEqual(t.stops)
  expect(result.patterns[0].roadSupplement.status).toBe('rejected-incomplete-pattern')
  expect(result.patterns[0].roadSupplement.issues[0].reason).toBe('missing-shape')
})
it('fails a changed platform or ordered chain instead of borrowing cached pairs', () => {
  const changed = structuredClone(raw)
  changed.stops[train.stops[0][0]][0] += 0.00001
  expect(() => match([train], bundle, changed)).toThrow('regional road pattern')
  const reordered = { ...train, stops: [...train.stops].reverse() }
  expect(() => match([reordered])).toThrow('regional road pattern')
})
it('does not admit reservations through a complete road cache', () => {
  expect(match([{ ...train, reservationRequired: true }]).trains[0].admission).toBe('reservation-or-demand-responsive')
})
it('rejects a whole pattern if one road segment fails, keeping its original geometry audit', () => {
  const changed = structuredClone(bundle)
  changed.caches['801'].patterns[roadPatternId(train, raw.stops)][0] = null
  const result = match([train], changed)
  expect(result.trains[0].admission).not.toBe('admitted')
  expect(result.patterns[0].roadSupplement.status).toBe('rejected-incomplete-pattern')
})
it('counts matched occurrences from their own pattern, independently of the directed-pair union', () => {
  const trains = [{ admission: 'admitted', pathSegments: [0] }, { admission: 'incomplete-directed-pattern', pathSegments: [null] }]
  const pairs = [{ pathIndex: 0, occurrences: 2, admittedOccurrences: 1 }]
  const coverage = thurgauCoverage(trains, pairs, [])
  expect(coverage.matchedDirectedPairs).toBe(1)
  expect(coverage.segmentOccurrences).toBe(2)
  expect(coverage.matchedSegmentOccurrences).toBe(1)
  expect(coverage.matchedScheduledSegmentOccurrences).toBe(1)
})
