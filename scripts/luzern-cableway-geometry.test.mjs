import { describe, it, expect } from 'vitest'
import { matchLuzernCableway, cablewayCoordinate, parseLuzernCableways } from './luzern-cableway-geometry.mjs'
const from = { didok: '8500001', stop_lon: '8', stop_lat: '47' }, to = { didok: '8500002', stop_lon: '8.01', stop_lat: '47.01' }
const route = { routeId: 'r', agencyId: 'a', line: '1', routeType: 1300 }, dates = ['2026-09-04', '2026-09-06']
const config = { limits: { stationAttachmentMetres: 120, topologyAttachmentMetres: 5, detourRatio: 4.5, detourFloorMetres: 1200 }, routes: [{ ...route, sourceOperator: 'o', segments: [{ installation: '71.1', stopNumbers: ['8500001', '8500002'], sourceStationNumbers: ['8500001', '8500002'] }] }] }
const network = () => ({ installations: [{ id: 'i', number: '71.1', type: 'Luftseilbahn', vehicle: 'Kabine', operator: 'o', sourceDate: '2025-01-01', validFrom: '2020-01-01' }],
  stations: [{ number: '8500001', installation: 'i', coordinate: [8, 47] }, { number: '8500002', installation: 'i', coordinate: [8.01, 47.01] }],
  segments: [{ id: 's', installation: 'i', lines: [[[8, 47], [8.005, 47.005], [8.01, 47.01]]] }] })
const match = (n = network(), c = config, r = route, a = from, b = to) => matchLuzernCableway(n, c, r, a, b, dates)
describe('Luzern federal cableway axes', () => {
  it('retains source vertices and independently orients each directed station pair', () => {
    expect(match().path).toEqual(network().segments[0].lines[0])
    expect(match(network(), config, route, to, from).path).toEqual([...match().path].reverse())
    expect(match().sourceStationNumbers).toEqual(['8500001', '8500002'])
  })
  it('never joins unknown routes or station pairs by nearby coordinates', () => {
    expect(match(network(), config, { ...route, routeId: 'other' }).reason).toBe('cableway-unreviewed-route')
    expect(match(network(), config, route, { ...from, didok: '8500003' }).reason).toBe('cableway-unreviewed-station-pair')
    expect(match(network(), config, route, from, from).reason).toBe('cableway-unreviewed-station-pair')
  })
  it('requires explicit reviewed interchange aliases and preserves their evidence', () => {
    const c = structuredClone(config), n = network(); c.routes[0].segments[0].sourceStationNumbers[0] = '8530001'; n.stations[0].number = '8530001'
    expect(() => match(n, c)).toThrow('Unexplained')
    c.routes[0].segments[0].aliasReason = 'Reviewed adjacent section station'
    expect(match(n, c).stationAliases).toEqual([{ timetable: '8500001', source: '8530001', reason: 'Reviewed adjacent section station' }])
  })
  it('refuses operator, mode, duplicate installation or duplicate station changes', () => {
    const n = network(); n.installations[0].operator = 'other'; expect(() => match(n)).toThrow('operator')
    const duplicate = network(); duplicate.installations.push({ ...duplicate.installations[0] }); expect(() => match(duplicate)).toThrow('Ambiguous')
    const station = network(); station.stations.push({ ...station.stations[0] }); expect(() => match(station)).toThrow('ambiguous')
    expect(() => match(network(), config, { ...route, routeType: 1303 })).toThrow()
  })
  it('rejects expired/future source installations and excessive station attachments', () => {
    for (const change of [{ validFrom: '2027-01-01' }, { validUntil: '2025-12-31' }]) { const n = network(); Object.assign(n.installations[0], change); expect(match(n).reason).toBe('cableway-source-validity') }
    expect(match(network(), config, route, { ...from, stop_lat: '47.01' }).reason).toBe('cableway-endpoint-gap')
  })
  it('does not bridge disconnected source parts or move the source axis to a station', () => {
    const n = network(); n.segments[0].lines.push([[8, 47], [8.01, 47.01]]); expect(() => match(n)).toThrow('Disconnected')
    const moved = network(); moved.segments[0].lines[0][0] = [8, 47.001]; expect(match(moved).reason).toBe('cableway-endpoint-gap')
  })
  it('rejects detours and malformed source coordinates rather than exporting a chord', () => {
    const n = network(); n.segments[0].lines[0][1] = [8, 48]; expect(match(n).reason).toBe('cableway-collapsed-or-detour')
    expect(() => cablewayCoordinate(NaN, 1200000)).toThrow('LV95')
    expect(() => cablewayCoordinate(8, 47)).toThrow('LV95')
    expect(cablewayCoordinate(2600000, 1200000)[0]).toBeCloseTo(7.4386, 3)
    expect(() => parseLuzernCableways('<TRANSFER/>')).toThrow('Empty')
  })
})
