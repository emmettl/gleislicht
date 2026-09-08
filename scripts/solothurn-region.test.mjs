import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { solothurnGraphs, solothurnNight, SO_LIMITS, applySolothurnGeometry } from './solothurn-network-geometry.mjs'
import { bernArea, bernLv95, bernWgs84 } from './bern-spatial.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { compactBernFeed, validateBernSnapshot } from './build-bern-region.mjs'
import { bernInstances } from './bern-timetable.mjs'

const A = [2600000, 1220000], B = [2601000, 1220000], C = [2602000, 1220000]
const feature = (id, points, mode = 'Bus', tunnel = false) => ({ properties: { T_Ili_Tid: id, verkehrsmittel: mode, tunnel }, geometry: { type: 'LineString', coordinates: points } })
const route = { id: 'r', agencyId: '1', name: '12', mode: 'bus', type: 700, agency: 'Test' }
const rawFeed = (ids = [[0, 1, 2], [2, 1, 0]]) => ({ metadata: { serviceDate: '2026-09-04' },
  stops: [A, B, C].map((xy, i) => [...bernWgs84(xy), `Stop ${i}`, '', `id${i}`]),
  trains: ids.map((chain, i) => ({ id: `t${i}`, routeId: 'r', agencyId: '1', route: '12', directionId: String(i % 2),
    sourceServiceDate: '2026-09-04', sourceCallCount: chain.length, callPermissions: chain.map(() => [0, 0]),
    stops: chain.map((id, j) => [id, 20000 + j * 100, 20000 + j * 100]) })) })

describe('Solothurn graph topology and source scope', () => {
  it('includes all ten districts and detached northern canton parts', () => {
    const source = JSON.parse(gunzipSync(readFileSync('data/solothurn-sources/decoded.json.gz')))
    const inside = bernArea(source.canton[0].geometry)
    for (const xy of [[7.536, 47.208], [7.398, 47.193], [7.908, 47.35], [7.691, 47.315], [7.619, 47.48], [7.545, 47.374]]) expect(inside(bernLv95(xy))).toBe(true)
    expect(inside(bernLv95([7.439, 46.949]))).toBe(false)
    expect(source.districts).toHaveLength(10); expect(source.lines).toHaveLength(3951); expect(source.stops).toHaveLength(775)
  })
  it('keeps modes separate and retains tunnel records', () => {
    const graphs = solothurnGraphs([feature('a', [A, B]), feature('b', [B, C], 'Bahn', true)])
    expect(graphs.get('rail').topology.tunnelRecords).toBe(1)
    expect(matchBaselSegment(graphs.get('bus'), bernWgs84(A), bernWgs84(C), SO_LIMITS.bus).reason).toBe('endpoint-gap')
    expect(() => solothurnGraphs([feature('x', [A, B], 'Tram')])).toThrow()
    expect(() => solothurnGraphs([feature('x', [[1220000, 2600000], B])])).toThrow()
  })
  it('joins exact endpoints but never stitches nearby gaps or interior crossings', () => {
    const connected = solothurnGraphs([feature('a', [A, B]), feature('b', [B, C])]).get('bus')
    expect(connected.topology.components).toBe(1)
    const gap = solothurnGraphs([feature('a', [A, B]), feature('b', [[B[0] + 0.001, B[1]], C])]).get('bus')
    expect(gap.topology.components).toBe(2)
    const crossing = solothurnGraphs([feature('a', [A, B, C]), feature('b', [[B[0], B[1] - 1000], B, [B[0], B[1] + 1000]], 'Bus', true)]).get('bus')
    expect(crossing.topology.components).toBe(2)
    expect(matchBaselSegment(crossing, bernWgs84(A), bernWgs84([B[0], B[1] + 1000]), SO_LIMITS.bus).reason).toBe('disconnected-line')
  })
  it('rejects collapsed stops, off-network endpoints and excessive detours', () => {
    const graph = solothurnGraphs([feature('a', [A, B, C])]).get('bus')
    expect(matchBaselSegment(graph, bernWgs84(A), bernWgs84(A), SO_LIMITS.bus).reason).toBe('collapsed-path')
    const around = solothurnGraphs([feature('a', [A, [A[0], A[1] + 10000], [B[0], B[1] + 10000], B])]).get('bus')
    expect(matchBaselSegment(around, bernWgs84(A), bernWgs84(B), SO_LIMITS.bus).reason).toBe('implausible-detour')
  })
})

describe('Solothurn complete directed pattern admission', () => {
  it('preserves reversals and loop calls through compaction and validation', () => {
    const graph = solothurnGraphs([feature('a', [A, B, C])]), raw = rawFeed([[0, 1, 2], [2, 1, 0], [0, 1, 0, 1, 2]])
    const result = applySolothurnGeometry(raw, new Map([['r', route]]), graph)
    expect(result.patterns).toHaveLength(3); expect(result.pairs).toHaveLength(4)
    const feed = compactBernFeed(raw, result)
    expect(() => validateBernSnapshot(feed)).not.toThrow()
    expect(feed.trains[2].stops).toHaveLength(5)
    feed.trains[1].pathSegments.reverse()
    expect(() => validateBernSnapshot(feed)).toThrow()
  })
  it('drops a complete journey when one call is unresolved, without cropping the census', () => {
    const raw = rawFeed(), result = applySolothurnGeometry(raw, new Map([['r', route]]), solothurnGraphs([feature('a', [A, B])]))
    expect(result.trains.every(t => t.admission === 'incomplete-directed-pattern')).toBe(true)
    expect(result.trains.every(t => t.stops.length === 3)).toBe(true)
    expect(result.patterns.every(p => p.matchedSegments === 1 && p.segmentCount === 2)).toBe(true)
  })
  it('excludes SN trains, night buses and conditional services even on overlapping geometry', () => {
    for (const name of ['SN1', 'N12', 'M55']) expect(solothurnNight({ ...route, name })).toBe(true)
    expect(solothurnNight({ ...route, name: 'S8' })).toBe(false)
    const graphs = solothurnGraphs([feature('a', [A, B, C])]), cache = new Map(), raw = rawFeed()
    applySolothurnGeometry(raw, new Map([['r', route]]), graphs, cache)
    const night = applySolothurnGeometry(raw, new Map([['r', { ...route, name: 'SN1' }]]), graphs, cache)
    expect(night.trains.every(t => t.admission === 'night-network-excluded-by-source')).toBe(true)
    expect(night.paths).toHaveLength(0)
    raw.trains[0].reservationRequired = true
    expect(applySolothurnGeometry(raw, new Map([['r', route]]), graphs).trains[0].admission).toBe('reservation-or-demand-responsive')
    expect(applySolothurnGeometry(raw, new Map([['r', { ...route, mode: 'tram' }]]), graphs).trains[0].admission).toBe('reservation-or-demand-responsive')
  })
  it('includes Sunday carry-in and labels headway expansion as representative', () => {
    const date = '2026-09-06', calendars = new Map([[date, new Set()], ['2026-09-05', new Set(['s'])]])
    const source = { serviceId: 's', calls: [{ id: 'a', arrival: 86300, departure: 86300 }, { id: 'b', arrival: 86900, departure: 86900 }] }
    const [trip] = bernInstances('source', source, date, calendars)
    expect(trip.calls.map(c => c.arrival)).toEqual([-100, 500]); expect(trip.sourceServiceDate).toBe('2026-09-05')
    const frequencies = [{ startTime: 87000, endTime: 87600, headwaySeconds: 300, exactTimes: 0 }]
    const expanded = bernInstances('source', { ...source, calls: [{ id: 'a', arrival: 0, departure: 0 }, { id: 'b', arrival: 100, departure: 100 }] }, date, calendars, frequencies)
    expect(expanded).toHaveLength(2); expect(expanded.every(t => t.frequency.exactTimes === 0)).toBe(true)
  })
})
