import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { reviewedSolothurnBusJunction } from './solothurn-bus-junction.mjs'
import { solothurnGraphs, SO_LIMITS } from './solothurn-network-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
const policy = JSON.parse(readFileSync('data/solothurn-bus-junction-policy.json'))
const source = JSON.parse(gunzipSync(readFileSync(policy.sourceFile)))
const context = JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz')))
const route = context.routes.find(r => r.id === policy.routeId)

describe('reviewed Oberbuchsiten bus source junction', () => {
  it('adds just one 2.236 mm inferred edge while preserving source vertices and all observed route-126 contexts', () => {
    const original = JSON.stringify(source), features = source.lines.filter(f => policy.features.some(r => r.id === f.properties.T_Ili_Tid))
    expect(matchBaselSegment(solothurnGraphs(features).get('bus'), policy.from, policy.to, SO_LIMITS.bus).reason).toBe('disconnected-line')
    const matcher = reviewedSolothurnBusJunction(source, policy), hashes = new Set(); let count = 0
    expect(matcher.evidence.joinMetres).toBeCloseTo(Math.sqrt(5) / 1000, 8)
    expect(matcher.evidence.addedVertices).toBe(0); expect(matcher.evidence.addedEdges).toBe(1)
    for (const d of context.snapshots) for (const t of d.trains.filter(t => t.routeId === route.id)) for (let i = 1; i < t.stops.length; i++) {
      const a = d.stops[t.stops[i - 1][0]], b = d.stops[t.stops[i][0]]
      if (a[4] !== policy.from[4] || b[4] !== policy.to[4]) continue
      const result = matcher.match(route, a, b, { reason: 'road-pattern-dependent-path' })
      expect(result.path).toBeDefined(); expect(result.maximumSnapMetres).toBeLessThan(7)
      expect(result.path[0]).toEqual(a.slice(0, 2).map(n => +n.toFixed(7)))
      expect(result.path.at(-1)).toEqual(b.slice(0, 2).map(n => +n.toFixed(7)))
      expect(result.pathMetres).toBeLessThan(1000); expect(result.pathMetres).toBeGreaterThan(600)
      hashes.add(JSON.stringify(result.path)); count++
    }
    expect(count).toBeGreaterThan(5); expect(hashes.size).toBe(1); expect(JSON.stringify(source)).toBe(original)
  })
  it('rejects changed geometry, tunnel endpoints, larger gaps, unknown identities and reverse-pair reuse', () => {
    const matcher = reviewedSolothurnBusJunction(source, policy), old = { reason: 'old-failure' }
    for (const r of [{ ...route, id: 'other' }, { ...route, name: '513' }, { ...route, agencyId: '793' }, { ...route, mode: 'tram' }]) expect(matcher.match(r, policy.from, policy.to, old)).toBe(old)
    expect(matcher.match(route, policy.to, policy.from, old)).toBe(old)
    const success = { path: [policy.from.slice(0, 2), policy.to.slice(0, 2)] }
    expect(matcher.match(route, policy.from, policy.to, success)).toBe(success)
    expect(() => matcher.match(route, [policy.from[0] + .001, ...policy.from.slice(1)], policy.to, old)).toThrow('Changed reviewed bus platform')
    expect(() => reviewedSolothurnBusJunction(source, { ...policy, maximumJoinMetres: 1 })).toThrow('Unreviewed bus junction gap')
    for (const change of ['geometry', 'tunnel']) {
      const changed = structuredClone(source), feature = changed.lines.find(f => f.properties.T_Ili_Tid === policy.features[0].id)
      if (change === 'geometry') feature.geometry.coordinates[0][0][0] += .01
      else feature.properties.tunnel = 1
      expect(() => reviewedSolothurnBusJunction(changed, policy)).toThrow()
    }
  })
})
