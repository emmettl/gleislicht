import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fribourgFeatureIdentity, fribourgFeatureMatch, applyFribourgGeometry, applyFribourgTopology } from './fribourg-line-geometry.mjs'
import { bernGraph } from './bern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { bernArea, bernLv95, bernWgs84 } from './bern-spatial.mjs'
import { compactBernFeed, validateBernSnapshot } from './build-bern-region.mjs'

const policy = JSON.parse(readFileSync('data/fribourg-policy.json'))
const source = JSON.parse(gunzipSync(readFileSync('data/fribourg-sources/decoded.json.gz')))
const f = id => source.lines.find(f => f.properties.OBJECTID === id)
const route = (name, agencyId = '834', mode = 'bus') => ({ id: 'test-route', name, agencyId, mode, type: mode === 'bus' ? 700 : 109 })

describe('Fribourg source adapter', () => {
  it('repairs only the pinned line 9 endpoint and preserves original geometry', () => {
    const original = structuredClone(f(22)), repair = policy.topologyRepairs[0]
    const changed = applyFribourgTopology([f(22)], policy)[0]
    expect(f(22)).toEqual(original)
    expect(changed.geometry.coordinates[0][0]).toEqual(repair.to)
    const expected = structuredClone(original); expected.geometry.coordinates[0][0] = repair.to
    expect(changed).toEqual(expected)
    const stops = [original.geometry.coordinates[0][30], original.geometry.coordinates[2][200]].map(p => bernWgs84(p))
    expect(matchBaselSegment(bernGraph([original]), ...stops, { snapMetres: 80, detourRatio: 4.5, detourFloorMetres: 1200 }).reason).toBe('disconnected-line')
    for (const ordered of [stops, [...stops].reverse()]) {
      expect(matchBaselSegment(bernGraph([changed]), ...ordered, { snapMetres: 80, detourRatio: 4.5, detourFloorMetres: 1200 }).path).toBeTruthy()
    }
    const drifted = structuredClone(original); drifted.geometry.coordinates[0][0][0] += 0.001
    expect(() => applyFribourgTopology([drifted], policy)).toThrow('Changed Fribourg repair source')
    expect(applyFribourgTopology([f(128), f(10)], policy)).toEqual([f(128), f(10)])
  })
  it('includes every district and detached canton component, not a bounding rectangle', () => {
    const contains = bernArea(source.canton[0].geometry)
    expect(source.districts).toHaveLength(7)
    expect(source.lines).toHaveLength(128)
    // Fribourg, Bulle, Romont, Estavayer, Morat, Tafers, Châtel;
    // detached Estavayer/Vuissens/Surpierre areas are preserved.
    for (const point of [[7.161, 46.803], [7.057, 46.619], [6.918, 46.693], [6.846, 46.849],
      [7.117, 46.928], [7.217, 46.815], [6.9, 46.526], [6.771, 46.736], [6.859, 46.746]]) {
      expect(contains(bernLv95(point)), JSON.stringify(point)).toBe(true)
    }
    for (const point of [[6.938, 46.821], [6.929, 46.881], [7.44, 46.95]]) expect(contains(bernLv95(point))).toBe(false)
  })

  it('distinguishes timetable fields from display labels and requires the precise operator/mode', () => {
    expect(fribourgFeatureMatch(route('2'), f(16), policy)).toBe(true)
    for (const wrong of [route('20.002'), route('2', '53'), route('2', '834', 'rail'), route('12')]) {
      expect(fribourgFeatureMatch(wrong, f(16), policy)).toBe(false)
    }
    expect(fribourgFeatureIdentity(f(37), policy).lines).toEqual(['N1'])
    expect(fribourgFeatureMatch(route('143'), f(37), policy)).toBe(false)
    expect(fribourgFeatureMatch(route('N1'), f(37), policy)).toBe(true)
    expect(fribourgFeatureIdentity(f(126), policy).lines).toEqual(['N24'])
    expect(fribourgFeatureIdentity(f(65), policy).lines).toEqual([])
    expect(fribourgFeatureMatch(route('IC1', '11', 'rail'), f(1), policy)).toBe(false)
  })

  it('uses documented exceptions only for their exact source identity', () => {
    expect(fribourgFeatureMatch(route('213', '876'), f(43), policy)).toBe(true)
    expect(fribourgFeatureMatch(route('213', '834'), f(43), policy)).toBe(false)
    expect(fribourgFeatureMatch(route('RE2', '53', 'rail'), f(3), policy)).toBe(true)
    expect(fribourgFeatureMatch(route('RE3', '53', 'rail'), f(3), policy)).toBe(true)
    expect(fribourgFeatureMatch(route('RE2', '33', 'rail'), f(3), policy)).toBe(false)
    const changed = structuredClone(f(43)); changed.properties.ENTREPRISE_VALEUR = 'TPF'
    expect(() => fribourgFeatureIdentity(changed, policy)).toThrow()
  })

  it('keeps reverse and repeated calls directed, and excludes complete trips with an unsourced extension', () => {
    const xy = [[2570000, 1180000], [2571000, 1180000], [2572000, 1180000], [2573000, 1180000]]
    const feature = { ...f(16), geometry: { type: 'LineString', coordinates: xy.slice(0, 3) } }
    const patterns = [[0, 1, 2], [2, 1, 0], [0, 1, 0], [0, 1, 2, 3]]
    const raw = { metadata: { serviceDate: '2026-09-06' }, stops: xy.map((p, i) => [...bernWgs84(p), `Stop ${i}`, '', `id${i}`]),
      trains: patterns.map((ids, i) => ({ id: `t${i}`, routeId: 'test-route', agencyId: '834', route: '2', directionId: String(i % 2),
        sourceCallCount: ids.length, sourceServiceDate: '2026-09-06', callPermissions: ids.map(() => [0, 0]),
        stops: ids.map((j, k) => [j, k * 120, k * 120]) })) }
    const result = applyFribourgGeometry(raw, new Map([['test-route', route('2')]]), { lines: [feature] }, policy)
    expect(result.patterns).toHaveLength(4)
    expect(result.trains.map(t => t.admission)).toEqual(['admitted', 'admitted', 'admitted', 'incomplete-directed-pattern'])
    expect(result.trains[3].stops).toHaveLength(4)
    const feed = compactBernFeed(raw, result)
    expect(feed.trains).toHaveLength(3)
    expect(() => validateBernSnapshot(feed)).not.toThrow()
    feed.trains[1].pathSegments.reverse()
    expect(() => validateBernSnapshot(feed)).toThrow()
  })

  it('cannot bridge disconnected source parts or substitute a neighbouring line', () => {
    const a = [2570000, 1180000], b = [2571000, 1180000]
    const feature = { ...f(16), geometry: { type: 'MultiLineString', coordinates: [[a, [2570100, 1180000]], [[2570900, 1180000], b]] } }
    const raw = { metadata: { serviceDate: '2026-09-04' }, stops: [a, b].map((p, i) => [...bernWgs84(p), `s${i}`, '', `id${i}`]),
      trains: [{ id: 't', routeId: 'test-route', agencyId: '834', route: '2', directionId: '0', stops: [[0, 0, 0], [1, 120, 120]] }] }
    const result = applyFribourgGeometry(raw, new Map([['test-route', route('2')]]), { lines: [feature] }, policy)
    expect(result.pairs[0].reason).toBe('disconnected-line')
    expect(result.trains[0].admission).toBe('incomplete-directed-pattern')
  })
})
