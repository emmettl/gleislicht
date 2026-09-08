import { describe, expect, it } from 'vitest'
import { baselTramDiversions } from './basel-tram-diversions.mjs'
import { applyBaselGeometry, baselGraphs } from './basel-line-geometry.mjs'

const from = [7.6, 47.55, 'From', '', 'a'], to = [7.61, 47.55, 'To', '', 'b']
const feature = { type: 'Feature', properties: { ln_tu: 'BVB', ln_liniennr: '2', ln_verkehrsmittel: 'Tram' }, geometry: { type: 'LineString', coordinates: [from.slice(0, 2), to.slice(0, 2)] } }
const collections = [{ type: 'FeatureCollection', features: [feature] }]
const policy = { schemaVersion: 1, serviceDates: ['2026-09-08'], rules: [{ id: 'example-diversion', agencyId: '823', line: '6', bothDirections: false, stops: ['From', 'To'] }] }
const train = { id: 'one', routeId: 'bvb6', route: '6', category: 'tram', stops: [[0, 0, 0], [1, 100, 100]] }
const route = { agencyId: '823' }

describe('Basel dated tram corridors', () => {
  it('restricts shared infrastructure to a reviewed date, operator, mode and directed pair', () => {
    const diversion = baselTramDiversions(collections, policy, '2026-09-08')
    expect(diversion.match(route, train, from, to).path).toBeTruthy()
    expect(diversion.match(route, train, to, from)).toBeUndefined()
    expect(diversion.match({ agencyId: '37' }, train, from, to)).toBeUndefined()
    expect(diversion.match(route, { ...train, category: 'bus' }, from, to)).toBeUndefined()
    expect(diversion.match(route, train, from, [...to.slice(0, 2), 'Not admitted'])).toBeUndefined()
    expect(() => baselTramDiversions(collections, policy, '2026-09-09')).toThrow('not been reviewed')
  })

  it('fills only failed line matches and keeps original route identity and calls', () => {
    const diversion = baselTramDiversions(collections, policy, '2026-09-08'), snapshot = { stops: [from, to], trains: [train], edges: [[0, 1]] }
    const result = applyBaselGeometry(snapshot, new Map([['bvb6', route]]), baselGraphs(collections), diversion)
    expect(result.segments[0]).toMatchObject({ lineGeometryReason: 'missing-line', diversionRule: 'example-diversion' })
    expect(result.trains[0].stops).toEqual(train.stops)
    expect(result.trains[0].routeId).toBe(train.routeId)
    const original = [{ type: 'FeatureCollection', features: [{ ...feature, properties: { ...feature.properties, ln_liniennr: '6' } }] }]
    expect(applyBaselGeometry(snapshot, new Map([['bvb6', route]]), baselGraphs(original), diversion).segments[0].diversionRule).toBeUndefined()
  })

  it('does not admit bus geometry or bridge disconnected tram pieces', () => {
    const buses = [{ type: 'FeatureCollection', features: [{ ...feature, properties: { ...feature.properties, ln_verkehrsmittel: 'Bus' } }] }]
    expect(baselTramDiversions(buses, policy, '2026-09-08').match(route, train, from, to).reason).toBe('missing-line')
    const pieces = [{ type: 'FeatureCollection', features: [{ ...feature, geometry: { type: 'MultiLineString', coordinates: [[from.slice(0, 2), [7.601, 47.55]], [[7.609, 47.55], to.slice(0, 2)]] } }] }]
    expect(baselTramDiversions(pieces, policy, '2026-09-08').match(route, train, from, to).reason).toBe('disconnected-line')
  })

  it('rejects an excessive city return even when it would fit the wider regional detour bound', () => {
    const detour = [{ type: 'FeatureCollection', features: [{ ...feature, geometry: { type: 'LineString', coordinates: [from.slice(0, 2), [7.6, 47.558], [7.61, 47.558], to.slice(0, 2)] } }] }]
    expect(baselTramDiversions(detour, policy, '2026-09-08').match(route, train, from, to).reason).toBe('implausible-detour')
  })
})
