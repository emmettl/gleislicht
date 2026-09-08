import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { thurgauLineTokens, thurgauFeatureMatch, applyThurgauGeometry, thurgauPatternId } from './thurgau-line-geometry.mjs'
import { thurgauCrosswalk } from './crosswalk-thurgau.mjs'
import { bernArea, bernLv95, bernWgs84 } from './bern-spatial.mjs'
import { bernInstances } from './bern-timetable.mjs'
import { thurgauTimingDiagnostics } from './build-thurgau-region.mjs'

const source = JSON.parse(gunzipSync(readFileSync('data/thurgau-sources/decoded.json.gz')))
const crosswalk = JSON.parse(readFileSync('data/thurgau-line-crosswalk.json'))

describe('Thurgau source identity', () => {
  it('keeps prefixes, night identities, qualifications and source typos explicit', () => {
    expect(thurgauLineTokens('80.200, 20.207, 80.733 (Abendkurs), BN820, 80.N50')).toEqual([
      { code: '80.200', line: '200', qualification: null, raw: '80.200' },
      { code: '20.207', line: '207', qualification: null, raw: '20.207' },
      { code: '80.733', line: '733', qualification: 'Abendkurs', raw: '80.733 (Abendkurs)' },
      { code: 'BN820', line: 'BN820', qualification: null, raw: 'BN820' },
      { code: '80.N50', line: 'N50', qualification: null, raw: '80.N50' },
    ])
    expect(thurgauLineTokens(null)).toEqual([])
    expect(() => thurgauLineTokens('80.200/207')).toThrow('Unreviewed')
  })
  it('rejects changed operator/mode identities and keeps S15 separate from other rail', () => {
    const entry = crosswalk.routes.find(r => r.agencyId === '22' && r.line === 'S15')
    const route = { id: entry.routeId, agencyId: '22', name: 'S15', mode: 'rail' }
    const feature = source.lines.find(f => f.id === entry.featureIds[0])
    expect(entry.featureIds).toHaveLength(2)
    expect(thurgauFeatureMatch(route, feature, crosswalk)).toBe(true)
    expect(() => thurgauFeatureMatch({ ...route, agencyId: '65' }, feature, crosswalk)).toThrow('operator')
    expect(() => thurgauFeatureMatch({ ...route, mode: 'bus' }, feature, crosswalk)).toThrow('mode')
    expect(crosswalk.routes.filter(r => ['11', '65'].includes(r.agencyId)).every(r => r.featureIds.every(id => !entry.featureIds.includes(id)))).toBe(true)
  })
  it('does not join a same-number operator without two shared, labelled DiDok stops', () => {
    const cache = JSON.parse(gunzipSync(readFileSync('data/thurgau-audit/timetable-cache.json.gz')))
    const candidate = cache.routes.find(r => r.agencyId === '801' && r.name === '847')
    expect(thurgauCrosswalk({ ...cache, routes: [candidate] }, source).routes[0].featureIds.length).toBeGreaterThan(0)
    const noStops = { ...cache, routes: [{ ...candidate, inCantonStops: [candidate.inCantonStops[0]] }] }
    expect(thurgauCrosswalk(noStops, source).routes[0].featureIds).toEqual([])
    const changedOperator = { ...cache, routes: [{ ...candidate, agencyId: '138' }] }
    expect(thurgauCrosswalk(changedOperator, source).routes[0].featureIds).toEqual([])
    expect(crosswalk.routes.filter(r => ['727', '797'].includes(r.agencyId)).every(r => !r.featureIds.length)).toBe(true)
  })
  it('covers all five districts and excludes neighbouring and foreign cities', () => {
    const inside = bernArea(source.canton[0].geometry)
    for (const point of [[8.898, 47.558], [9.176, 47.650], [9.104, 47.566], [9.430, 47.517], [8.968, 47.474]]) expect(inside(bernLv95(point))).toBe(true)
    for (const point of [[8.724, 47.499], [9.374, 47.424], [9.178, 47.665]]) expect(inside(bernLv95(point))).toBe(false)
    expect(source.districts).toHaveLength(5)
    expect(source.layers.buslinie).toHaveLength(337)
    expect(source.layers.bahnlinie_takt).toHaveLength(17)
    expect(source.layers.sammeltaxi).toHaveLength(4)
  })
})

describe('Thurgau directed admission', () => {
  const a = [2700000, 1270000], b = [2701000, 1270000], c = [2702000, 1270000]
  const route = { id: 'r', agencyId: '801', name: '847', mode: 'bus' }
  const feature = coordinates => ({ id: 'buslinie.test', properties: {}, geometry: { type: 'LineString', coordinates } })
  const policy = { routes: [{ routeId: 'r', agencyId: '801', line: '847', mode: 'bus', featureIds: ['buslinie.test'] }] }
  const raw = { metadata: { serviceDate: '2026-09-04' }, stops: [a, b, c].map((p, i) => [...bernWgs84(p), `Stop ${i}`, '', `s${i}`]),
    trains: [[0, 1, 2], [2, 1, 0], [0, 1, 0]].map((ids, i) => ({ id: `t${i}`, routeId: 'r', agencyId: '801', route: '847', directionId: String(i % 2),
      sourceServiceDate: '2026-09-04', stops: ids.map((j, k) => [j, 3600 + k * 120, 3600 + k * 120]) })) }
  it('preserves direction, ordered platform identity and repeated loop calls', () => {
    const result = applyThurgauGeometry(raw, new Map([['r', route]]), { lines: [feature([a, b, c])] }, policy)
    expect(result.patterns).toHaveLength(3)
    expect(result.trains.every(t => t.admission === 'admitted')).toBe(true)
    const forward = result.trains[0].pathSegments.map(i => result.paths[i])
    const reverse = result.trains[1].pathSegments.map(i => result.paths[i])
    expect(reverse).toEqual([...forward].reverse().map(path => [...path].reverse()))
    expect(thurgauPatternId(raw.trains[0], raw.stops)).not.toBe(thurgauPatternId({ ...raw.trains[0], directionId: '1' }, raw.stops))
  })
  it('excludes whole patterns with a missing endpoint, never truncating their calls', () => {
    const result = applyThurgauGeometry(raw, new Map([['r', route]]), { lines: [feature([a, b])] }, policy)
    expect(result.trains.slice(0, 2).every(t => t.admission === 'incomplete-directed-pattern' && t.stops.length === 3)).toBe(true)
    expect(result.trains[2].admission).toBe('admitted')
  })
  it('does not admit a reservation-required service even with complete geometry', () => {
    const result = applyThurgauGeometry({ ...raw, trains: [{ ...raw.trains[0], reservationRequired: true }] }, new Map([['r', route]]), { lines: [feature([a, b, c])] }, policy)
    expect(result.trains[0].admission).toBe('reservation-or-demand-responsive')
  })
  it('reports coincident source times without inventing seconds or infinite speeds', () => {
    const dated = { ...raw, trains: [{ ...raw.trains[0], stops: [[0, 3600, 3600], [1, 3600, 3600], [2, 3720, 3720]] }] }
    const routes = new Map([['r', route]])
    const result = applyThurgauGeometry(dated, routes, { lines: [feature([a, b, c])] }, policy)
    const timing = thurgauTimingDiagnostics(dated, result, routes)
    expect(timing.admittedZeroDurationSegmentOccurrences).toBe(1)
    expect(timing.admittedJourneysWithZeroDurationSegments).toBe(1)
    expect(timing.maximumPositiveDurationSegmentByMode[0].kilometresPerHour).toBeGreaterThan(29)
    expect(timing.maximumPositiveDurationSegmentByMode[0].kilometresPerHour).toBeLessThan(31)
    expect(result.trains[0].stops[1][1]).toBe(3600)
  })
  it('keeps Saturday spillover on Sunday without substituting Sunday service', () => {
    const calendars = new Map([['2026-09-05', new Set(['sat'])], ['2026-09-06', new Set()]])
    const instances = bernInstances('night', { serviceId: 'sat', calls: [{ id: 'a', arrival: 86300, departure: 86300 }, { id: 'b', arrival: 86900, departure: 86900 }] }, '2026-09-06', calendars)
    expect(instances).toHaveLength(1)
    expect(instances[0].sourceServiceDate).toBe('2026-09-05')
    expect(instances[0].calls.map(s => s.arrival)).toEqual([-100, 500])
  })
})
