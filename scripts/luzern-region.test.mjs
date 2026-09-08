import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateLuzernDownload } from './download-luzern-sources.mjs'
import { featureIdentity, lineGraph, matchLuzernPair, directedPatternKey } from './luzern-line-geometry.mjs'
import { inCanton, civilInstances, luzernMode } from './luzern-timetable.mjs'
import { compactLuzern, validateLuzernSnapshot } from './build-luzern-region.mjs'

const A = [8.30, 47.05], B = [8.31, 47.05], C = [8.31, 47.06]
const feature = (coordinates = [A, B], p = {}) => ({ type: 'Feature', properties: { OBJECTID: 1, BUL_ROUTE: 'A01', FP_JAHR: 2026, TU: 11, LINIENNR: 'Linie 1', ...p }, geometry: { type: 'LineString', coordinates } })
const policy = JSON.parse(readFileSync('data/luzern-policy.json'))
const limits = policy.limits
const call = (id, arrival, sequence) => ({ id, arrival, departure: arrival, sequence, pickupType: '0', dropOffType: '0' })

describe('Luzern official adapter', () => {
  it('rejects truncated and repeated ArcGIS pages, invalid coordinates and changed enums/year', () => {
    const collection = { type: 'FeatureCollection', features: [feature()] }
    expect(() => validateLuzernDownload(collection, [1, 2])).toThrow()
    expect(() => validateLuzernDownload({ ...collection, features: [feature(), feature()] }, [1, 2])).toThrow()
    expect(() => validateLuzernDownload({ ...collection, exceededTransferLimit: true }, [1])).toThrow()
    expect(() => validateLuzernDownload({ ...collection, features: [feature([[2660000, 1210000], B])] }, [1])).toThrow()
    expect(() => featureIdentity('bus', feature(), policy, new Map([[11, 'Changed operator']]))).toThrow()
    expect(() => featureIdentity('bus', feature([A, B], { FP_JAHR: 2025 }), policy, new Map())).toThrow()
  })
  it('maps local TU=11 to GTFS 820 rather than SBB agency 11, and isolates unknown operators', () => {
    const result = featureIdentity('bus', feature(), policy, new Map([[11, policy.operatorCrosswalk['11'].name]]))
    expect(result.agencyIds).toEqual(['820'])
    expect(result.lines).toEqual(['1'])
    expect(featureIdentity('rail', feature([A, B], { TU: 0, BAHN_ROUTE: 'unknown', BUL_ROUTE: undefined }), policy, new Map()).agencyIds).toBeUndefined()
    expect(featureIdentity('boat', feature(), policy, new Map()).reason).toBe('stale-boat-source')
  })
  it('retains a curved directed corridor and reverses endpoints, without inventing a crossing junction', () => {
    const g = { graph: lineGraph([feature([A, C, B])]), sourceFeatures: ['bus:A01'] }
    const forward = matchLuzernPair(g, A, B, limits), reverse = matchLuzernPair(g, B, A, limits)
    expect(forward.path).toContainEqual(C)
    expect(reverse.path).toEqual([...forward.path].reverse())
    const broken = { graph: lineGraph([feature([A, [8.304, 47.05]]), feature([[8.306, 47.05], B])]), sourceFeatures: [] }
    expect(matchLuzernPair(broken, A, B, limits).reason).toBe('disconnected-line')
    const crossing = { graph: lineGraph([feature([A, B]), feature([[8.305, 47.049], [8.305, 47.051]])]), sourceFeatures: [] }
    expect(matchLuzernPair(crossing, A, [8.305, 47.051], limits).reason).toBe('disconnected-line')
  })
  it('does not merge patterns with reversed calls, repeat-stop loops or reservation requirements', () => {
    const t = { routeId: 'r', directionId: '0', calls: [call('a', 0, 1), call('b', 60, 2)] }
    expect(directedPatternKey(t)).not.toEqual(directedPatternKey({ ...t, calls: [...t.calls].reverse() }))
    expect(directedPatternKey(t)).not.toEqual(directedPatternKey({ ...t, calls: [...t.calls, call('a', 120, 3)] }))
    expect(directedPatternKey(t)).not.toEqual(directedPatternKey({ ...t, calls: t.calls.map(c => ({ ...c, pickupType: '2' })) }))
  })
  it('uses the complete multipolygon and respects holes, rather than a rectangular envelope', () => {
    const ring = (x, y, d) => [[x,y],[x+d,y],[x+d,y+d],[x,y+d],[x,y]]
    const geometry = { type: 'MultiPolygon', coordinates: [[ring(0,0,10),ring(2,2,1)],[ring(20,20,1)]] }
    expect(inCanton([1,1], geometry)).toBe(true)
    expect(inCanton([2.5,2.5], geometry)).toBe(false)
    expect(inCanton([20.5,20.5], geometry)).toBe(true)
    expect(inCanton([15,15], geometry)).toBe(false)
  })
  it('keeps all overnight calls with preceding-day identities and distinguishes headway illustrations', () => {
    const calls = [call('outside', 86300, 1),call('inside', 86500, 2)]
    const [t] = civilInstances('t', { calls }, undefined, [-86400], '2026-09-06')
    expect(t.stops.map(c => c.arrival)).toEqual([-100, 100])
    expect(t.metadata.sourceServiceDate).toBe('2026-09-05')
    expect(t.id).toContain('2026-09-05')
    const instances = civilInstances('headway', { calls: [call('a',0,1),call('b',60,2)] }, [{startTime: 600,endTime: 900,headwaySeconds: 120,exactTimes:0}], [0], '2026-09-06')
    expect(instances.map(t => t.stops[0].departure)).toEqual([600,720,840])
    expect(instances.every(t => t.metadata.frequency.exactTimes === 0)).toBe(true)
    expect(luzernMode(202)).toBe('bus'); expect(luzernMode(116)).toBe('mountain'); expect(luzernMode(1303)).toBe('mountain'); expect(luzernMode(107)).toBe('rail')
  })
  it('compacts complete source calls and rejects missing or reversed admitted paths', () => {
    const stops = new Map([['a', {stop_lon:A[0],stop_lat:A[1],stop_name:'A'}], ['b',{stop_lon:B[0],stop_lat:B[1],stop_name:'B'}]])
    const train = { id:'t', category:'bus', calls:[call('a',0,4),call('b',60,9)],pathSegments:[1] }
    const snapshot = compactLuzern([train], stops, [[C,B],[A,B]], {})
    expect(snapshot.paths).toEqual([[A,B]])
    expect(snapshot.trains[0].sourceCallSequences).toEqual([4,9])
    expect(() => validateLuzernSnapshot(snapshot)).not.toThrow()
    expect(() => validateLuzernSnapshot({...snapshot,paths:[[B,A]]})).toThrow()
    expect(() => validateLuzernSnapshot({...snapshot,trains:[{...snapshot.trains[0],pathSegments:[null]}]})).toThrow()
  })
})
