import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { bernArea, bernLv95, bernWgs84 } from './bern-spatial.mjs'
import { bernFeatureMatch, bernGraph, bernLineNumbers, bernPatternId, bernAdmission, applyBernGeometry, bernSectionFeature } from './bern-line-geometry.mjs'
import { bernInstances } from './bern-timetable.mjs'
import { compactBernFeed, validateBernSnapshot } from './build-bern-region.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'

const crosswalk = { operators: { Test: ['1'] }, nightOperators: { 'Test night': ['2'] }, featureOverrides: {} }
const feature = (points, properties = {}) => ({ type: 'Feature', properties: { vkmtyp: 2, tucode: 'Test', liniennr: '12', liniencode: 'test', ...properties }, geometry: { type: 'LineString', coordinates: points } })
const route = { id: 'route', agencyId: '1', mode: 'bus', name: '12', type: 700 }
const A = [2600000, 1200000], B = [2601000, 1200000], C = [2602000, 1200000]

describe('Bern source identity and geography', () => {
  it('preserves polygon holes and detached parts', () => {
    const ring = (a, b) => [[a, a], [b, a], [b, b], [a, b], [a, a]]
    const contains = bernArea({ type: 'MultiPolygon', coordinates: [[ring(0, 10), ring(3, 7)], [ring(20, 30)]] })
    expect(contains([2, 2])).toBe(true); expect(contains([5, 5])).toBe(false)
    expect(contains([25, 25])).toBe(true); expect(contains([15, 15])).toBe(false)
  })

  it('uses the actual 2026 canton including Bernese Jura and excludes Moutier after transfer', () => {
    const source = JSON.parse(gunzipSync(readFileSync('data/bern-sources/decoded.json.gz')))
    const contains = bernArea(source.canton[0].geometry)
    for (const p of [[7.439, 46.949], [7.247, 47.137], [7.788, 47.213], [7.632, 46.94], [7.63, 46.758], [8.033, 46.624], [6.995, 47.153]]) expect(contains(bernLv95(p))).toBe(true)
    expect(contains(bernLv95([7.3728, 47.278]))).toBe(false)
    expect(source.districts).toHaveLength(10)
    expect(source.lines).toHaveLength(518); expect(source.stops).toHaveLength(5321)
  })

  it('retains metre-level coordinate precision and rejects swapped source coordinates', () => {
    const xy = bernLv95(bernWgs84(A))
    expect(Math.hypot(xy[0] - A[0], xy[1] - A[1])).toBeLessThan(2)
    expect(() => bernGraph([feature([[1200000, 2600000], B])])).toThrow('LV95')
  })

  it('requires operator, mode and whole line identity, including night operator names', () => {
    const f = feature([A, B])
    expect(bernFeatureMatch(route, f, crosswalk)).toBe(true)
    expect(bernFeatureMatch({ ...route, agencyId: '9' }, f, crosswalk)).toBe(false)
    expect(bernFeatureMatch({ ...route, mode: 'tram' }, f, crosswalk)).toBe(false)
    expect(bernFeatureMatch({ ...route, name: '2' }, f, crosswalk)).toBe(false)
    const night = feature([A, B], { vkmtyp: 3, tucode: 'Moonliner', tuname: 'Test night' })
    expect(bernFeatureMatch(route, night, crosswalk)).toBe(false)
    expect(bernFeatureMatch({ ...route, agencyId: '2' }, night, crosswalk)).toBe(true)
    expect(bernLineNumbers('R61/62')).toEqual(['R61', 'R62'])
    expect(bernLineNumbers('RE2 / RE3')).toEqual(['RE2', 'RE3'])
  })

  it('joins blank ferry and mountain labels by the exact timetable field', () => {
    const f = feature([A, B], { vkmtyp: 6, liniennr: ' ', kubunr: '3216' })
    expect(bernFeatureMatch({ ...route, mode: 'ferry', name: '3216' }, f, crosswalk)).toBe(true)
    expect(bernFeatureMatch({ ...route, mode: 'bus', name: '3216' }, f, crosswalk)).toBe(false)
  })

  it('scopes the evidenced S8 corridor extension to its operator and rail mode', () => {
    const policy = JSON.parse(readFileSync('data/bern-operator-crosswalk.json'))
    const f = feature([A, B], { vkmtyp: 1, tucode: 'RBS', liniencode: '308_RE', liniennr: 'RE5' })
    expect(bernFeatureMatch({ ...route, agencyId: '88', mode: 'rail', name: 'S8' }, f, policy)).toBe(true)
    expect(bernFeatureMatch({ ...route, agencyId: '88', mode: 'rail', name: 'RE5' }, f, policy)).toBe(true)
    expect(bernFeatureMatch({ ...route, agencyId: '88', mode: 'rail', name: 'S7' }, f, policy)).toBe(false)
    expect(bernFeatureMatch({ ...route, agencyId: '850', mode: 'bus', name: 'S8' }, f, policy)).toBe(false)
    expect(bernFeatureMatch({ ...route, agencyId: '11', mode: 'rail', name: 'S8' }, f, policy)).toBe(false)
    expect(policy.featureOverrides['308_RE'].supportingDocument).toBe(policy.supportingDocuments[0].file)
  })
})

describe('Bern directed patterns and civil days', () => {
  it('keeps direction, platform order and repeated loop calls in pattern identity', () => {
    const stops = [[0, 0, 'A', '', 'a'], [0, 0, 'B', '', 'b']]
    const t = { routeId: 'r', directionId: '0', stops: [[0], [1], [0]] }
    const id = bernPatternId(t, stops)
    expect(id).not.toBe(bernPatternId({ ...t, stops: [[0], [1]] }, stops))
    expect(id).not.toBe(bernPatternId({ ...t, directionId: '1' }, stops))
    expect(id).not.toBe(bernPatternId({ ...t, stops: [[1], [0], [1]] }, stops))
  })

  it('orients paths along each journey and never stitches disconnected source parts', () => {
    const graph = bernGraph([feature([A, B, C])])
    const a = bernWgs84(A), c = bernWgs84(C)
    const forward = matchBaselSegment(graph, a, c), reverse = matchBaselSegment(graph, c, a)
    expect(reverse.path).toEqual([...forward.path].reverse())
    const broken = bernGraph([feature([A, [2600100, 1200000]]), feature([[2601900, 1200000], C])])
    expect(matchBaselSegment(broken, a, c).reason).toBe('disconnected-line')
    const almostJoined = bernGraph([feature([A, B]), feature([[B[0] + 0.001, B[1]], C])])
    expect(almostJoined.points).toHaveLength(4)
  })

  it('excludes an entire incomplete or conditional pattern rather than cropping calls', () => {
    const p = { sourceLines: ['test'], segmentCount: 3, matchedSegments: 2 }
    expect(bernAdmission({}, p)).toBe('incomplete-directed-pattern')
    expect(bernAdmission({ reservationRequired: true }, { ...p, matchedSegments: 3 })).toBe('reservation-or-demand-responsive')
    expect(bernAdmission({}, { ...p, matchedSegments: 3 })).toBe('admitted')
  })

  it('retains previous-day spillover and distinguishes frequency templates from instances', () => {
    const date = '2026-09-06', calendars = new Map([[date, new Set()], ['2026-09-05', new Set(['s'])]])
    const source = { serviceId: 's', calls: [{ id: 'a', arrival: 86300, departure: 86300 }, { id: 'b', arrival: 86900, departure: 86900 }] }
    const [trip] = bernInstances('source', source, date, calendars)
    expect(trip.sourceServiceDate).toBe('2026-09-05'); expect(trip.sourceTripId).toBe('source')
    expect(trip.calls.map(c => c.arrival)).toEqual([-100, 500])
    calendars.set(date, new Set(['s']))
    const intervals = [{ startTime: 87000, endTime: 87600, headwaySeconds: 300, exactTimes: 0 }]
    const instances = bernInstances('source', { ...source, calls: [{ id: 'a', arrival: 0, departure: 0 }, { id: 'b', arrival: 100, departure: 100 }] }, date, calendars, intervals)
    expect(instances).toHaveLength(2); expect(new Set(instances.map(t => t.id)).size).toBe(2)
    expect(instances.every(t => t.frequency.exactTimes === 0 && t.sourceTripId === 'source' && t.sourceServiceDate === '2026-09-05')).toBe(true)
  })

  it('compacts paths and platforms without reversing shared edges or losing source calls', () => {
    const source = { lines: [feature([A, B, C])] }, routes = new Map([['route', route]])
    const raw = { metadata: { serviceDate: '2026-09-04' }, stops: [A, B, C].map((xy, i) => [...bernWgs84(xy), `Stop ${i}`, '', `id${i}`]),
      trains: [[0, 1, 2], [2, 1, 0]].map((ids, i) => ({ id: `trip${i}`, routeId: 'route', agencyId: '1', route: '12', directionId: String(i), sourceServiceDate: '2026-09-04',
        sourceCallCount: 3, callPermissions: [[0, 0], [0, 0], [0, 0]], stops: ids.map((j, k) => [j, k * 60, k * 60]) })) }
    const matched = applyBernGeometry(raw, routes, source, crosswalk)
    expect(matched.pairs).toHaveLength(4); expect(matched.patterns).toHaveLength(2)
    const feed = compactBernFeed(raw, matched)
    expect(() => validateBernSnapshot(feed)).not.toThrow()
    feed.trains[1].pathSegments.reverse()
    expect(() => validateBernSnapshot(feed)).toThrow()
  })
})

it('scopes reviewed IR65, R71 and Gimmelwald–Mürren aliases without widening other operators or modes', () => {
  const policy = JSON.parse(readFileSync('data/bern-operator-crosswalk.json'))
  for (const [code, agencyId, mode, names, rejected] of [
    ['303_S_a', '33', 'rail', ['S3', 'IR65'], ['S31', 'IR66', 'IR']],
    ['474', '86', 'rail', ['R', 'R71'], ['R70', 'IR', '71']],
    ['2460_1', '256', 'cableway', ['2460', '24602'], ['24603', '24604', '2460A']],
  ]) {
    const f = feature([A, B], { vkmtyp: mode === 'rail' ? 1 : 5, liniencode: code })
    for (const name of names) {
      expect(bernFeatureMatch({ ...route, agencyId, mode, name }, f, policy)).toBe(true)
      expect(bernFeatureMatch({ ...route, agencyId: '11', mode, name }, f, policy)).toBe(false)
      expect(bernFeatureMatch({ ...route, agencyId, mode: 'bus', name }, f, policy)).toBe(false)
    }
    for (const name of rejected) expect(bernFeatureMatch({ ...route, agencyId, mode, name }, f, policy)).toBe(false)
    expect(policy.supportingDocuments.some(d => d.file === policy.featureOverrides[code].supportingDocument)).toBe(true)
  }
})

it('isolates the two Schilthorn cable sections without joining their distinct Birg endpoints', () => {
  const policy = JSON.parse(readFileSync('data/bern-operator-crosswalk.json'))
  const source = JSON.parse(gunzipSync(readFileSync('data/bern-sources/decoded.json.gz')))
  const f = source.lines.find(f => f.properties.liniencode === '2460_2')
  const routes = policy.featureOverrides['2460_2'].routeSections.map(s => ({ id: s.routeId, agencyId: s.agencyId, name: s.line, mode: s.mode }))
  const stops = [[7.89127759, 46.55772515, 'Mürren', '', 'ch:1:sloid:7455'], [7.8577974, 46.5618265, 'Birg', '', 'ch:1:sloid:7456'], [7.8352496, 46.5572619, 'Schilthorn', '', 'ch:1:sloid:7457']]
  const trains = routes.flatMap((r, i) => [[i, i + 1], [i + 1, i]].map((ids, direction) => ({ routeId: r.id, route: r.name, directionId: String(direction), stops: ids.map(j => [j]), sourceServiceDate: '2026-09-04' })))
  const matched = applyBernGeometry({ metadata: { serviceDate: '2026-09-04' }, stops, trains }, new Map(routes.map(r => [r.id, r])), source, policy)
  expect(matched.trains.every(t => t.admission === 'admitted')).toBe(true)
  expect(matched.paths).toHaveLength(4)
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i]
    expect(bernFeatureMatch(r, f, policy)).toBe(true)
    for (const changed of [{ id: 'different-route' }, { agencyId: '256' }, { name: '24602' }, { mode: 'bus' }]) expect(bernFeatureMatch({ ...r, ...changed }, f, policy)).toBe(false)
    expect(bernSectionFeature(r, f, policy).geometry.coordinates).toEqual(f.geometry.coordinates[i])
    expect(matched.paths[2 * i + 1]).toEqual([...matched.paths[2 * i]].reverse())
  }
  const changed = structuredClone(f); changed.geometry.coordinates[1][0][0] += 0.001
  expect(() => bernSectionFeature(routes[1], changed, policy)).toThrow('missing or ambiguous')
  const missingEvidence = structuredClone(policy); missingEvidence.supportingDocuments = []
  expect(() => bernSectionFeature(routes[0], f, missingEvidence)).toThrow('Missing section identity evidence')
})
