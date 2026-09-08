import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { solothurnBernRailMatcher, loadSolothurnCorridors } from './solothurn-corridor-geometry.mjs'
const context = JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz')))
const policy = JSON.parse(readFileSync('data/solothurn-corridor-policy.json'))
const routes = new Map(context.routes.map(r => [r.id, r]))
const stops = new Map(context.snapshots.flatMap(d => d.stops.map(s => [s[4], s])))

describe('Solothurn line-specific rail corridors', () => {
  it('matches all 51 directed asm platform pairs while rejecting another route or operator', () => {
    const feature = JSON.parse(readFileSync(policy.asm.sourceFile)), match = solothurnBernRailMatcher(feature, policy.asm)
    const pairs = new Map()
    for (const d of context.snapshots) for (const t of d.trains.filter(t => t.routeId === policy.asm.routeId)) for (let i = 1; i < t.stops.length; i++) {
      const a = d.stops[t.stops[i - 1][0]], b = d.stops[t.stops[i][0]], route = routes.get(t.routeId)
      const result = match(route, a, b)
      expect(result.path).toBeDefined(); expect(result.maximumSnapMetres).toBeLessThan(13)
      expect(result.path[0][0]).toBeCloseTo(a[0], 6); expect(result.path.at(-1)[1]).toBeCloseTo(b[1], 6)
      pairs.set(JSON.stringify([a[4], b[4]]), result)
      expect(match({ ...route, agencyId: '11' }, a, b)).toBeUndefined()
      expect(match({ ...route, id: 'another-route' }, a, b)).toBeUndefined()
    }
    expect(pairs.size).toBe(51)
    expect(() => solothurnBernRailMatcher({ ...feature, properties: { ...feature.properties, tucode: 'SBB' } }, policy.asm)).toThrow()
  })
  it('uses the official S29 line for its Aarau–Olten return leg without altering a successful primary path', async () => {
    const matcher = await loadSolothurnCorridors(), route = routes.get(policy.s29.routeId)
    const day = context.snapshots.find(d => d.trains.some(t => t.routeId === route.id && t.stops.some(([a], i) => d.stops[a][2] === 'Aarau' && d.stops[t.stops[i + 1]?.[0]]?.[2] === 'Olten')))
    const trip = day.trains.find(t => t.routeId === route.id && t.stops.some(([a], i) => day.stops[a][2] === 'Aarau' && day.stops[t.stops[i + 1]?.[0]]?.[2] === 'Olten'))
    const index = trip.stops.findIndex(([a], i) => day.stops[a][2] === 'Aarau' && day.stops[trip.stops[i + 1]?.[0]]?.[2] === 'Olten')
    const a = day.stops[trip.stops[index][0]], b = day.stops[trip.stops[index + 1][0]]
    const forward = matcher.match(route, a, b), reverse = matcher.match(route, b, a)
    expect(forward.geometrySource).toBe('bern-official-450_S_b'); expect(forward.path).toBeDefined()
    expect(reverse.path).toBeDefined(); expect(forward.maximumSnapMetres).toBeLessThan(30)
    const primary = { path: [a.slice(0, 2), b.slice(0, 2)], geometrySource: 'existing' }
    expect(matcher.match(route, a, b, primary)).toBe(primary)
  })
  it('confines SBB fallback to exact reviewed rail routes and operating points', async () => {
    const matcher = await loadSolothurnCorridors(), route = routes.get('91-11-E-j26-1')
    const a = [...stops.values()].find(s => s[4].startsWith('ch:1:sloid:2111:')), b = [...stops.values()].find(s => s[4].startsWith('ch:1:sloid:2112:'))
    const result = matcher.match(route, a, b)
    expect(result.geometrySource).toBe('sbb-rail-inference'); expect(result.sourceFeatures).toHaveLength(2)
    expect(result.stationAttachmentsMetres.every(m => m <= 100)).toBe(true)
    for (const changed of [{ ...route, agencyId: '33' }, { ...route, id: 'unreviewed' }, { ...route, mode: 'bus' }]) expect(matcher.match(changed, a, b).path).toBeUndefined()
    expect(matcher.match(route, [a[0] + .1, ...a.slice(1)], b).reason).toBe('sbb-rail-station-attachment')
    expect(matcher.match(route, a, [...b.slice(0, 4), 'ch:1:sloid:999999']).path).toBeUndefined()
  })
})
