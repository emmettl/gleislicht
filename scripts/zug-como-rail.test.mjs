import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { loadZugComoRail, zugComoMatcher, matchZugRailWithComo } from './zug-como-rail.mjs'
import { loadZugRail } from './zug-rail-geometry.mjs'
import { loadZugSbbRailSupplement, matchZugRailWithSupplement } from './zug-sbb-rail-supplement.mjs'

const read = p => JSON.parse(readFileSync(p)), policy = read('data/zug-policy.json')
const bytes = readFileSync('data/zug-timetable.json.gz'), raw = JSON.parse(gunzipSync(bytes))
const scope = read(`${policy.railComo.sourceDirectory}/scope.json`)
const osm = JSON.parse(gunzipSync(readFileSync(`${policy.railComo.sourceDirectory}/osm.json.gz`)))
const stops = new Map(raw.stops.map(s => [s.stop_id, s])), route = raw.inventory.find(r => r.routeId === policy.railComo.route.routeId)
const load = (p = policy.railComo, r = raw) => loadZugComoRail(p, r, sha256(bytes))

describe('Zug complete EC patterns through Como', () => {
  it('replays both exact platform paths and every full source pattern while retaining all previous successes', async () => {
    const como = await load(), rail = await loadZugRail(policy.rail, raw.dates), sbb = await loadZugSbbRailSupplement(policy.railSupplement)
    expect(como.scope.patterns).toHaveLength(16)
    expect(como.inventory).toHaveLength(715)
    expect(como.inventory.filter(w => !w.reason)).toHaveLength(100)
    expect(como.comparisonInventory).toHaveLength(8)
    for (const day of raw.snapshots) {
      const trains = day.trains.filter(t => t.routeId === route.routeId)
      expect(trains).toHaveLength(26)
      for (const train of trains) {
        const before = matchZugRailWithSupplement(rail, sbb, train, stops, route)
        const after = matchZugRailWithComo(rail, sbb, como, train, stops, route)
        expect(before.filter(p => !p.path)).toHaveLength(1)
        expect(after.every(p => p.path)).toBe(true)
        for (let i = 0; i < before.length; i++) {
          if (before[i].path) expect(after[i]).toEqual(before[i])
          else {
            expect(after[i].primaryFailure).toEqual(before[i])
            expect(after[i].tunnelWayId).toBe(25148357)
            expect(after[i].trackAttachmentsMetres.every(d => d < 24)).toBe(true)
          }
        }
      }
    }
    expect(como.timing.map(d => d.pairs.map(p => [p.intervals.length, [...new Set(p.intervals.map(i => i.seconds))]]))).toEqual([
      [[13, [360]], [13, [420]]], [[13, [360]], [13, [420]]],
    ])
  })
  it('cannot apply to another operator, an unreviewed platform or an altered full directed pattern', async () => {
    const como = await load(), train = raw.snapshots[0].trains.find(t => t.routeId === route.routeId && t.directionId === '0')
    const [a, b] = policy.railComo.pairs[0].stopIds.map(id => stops.get(id))
    const failure = { reason: 'rail-no-exact-operating-point' }, success = { path: [[1, 2], [3, 4]] }
    expect(como.matchPair(success, route, train, a, b)).toBe(success)
    expect(como.matchPair(failure, { ...route, agencyId: '82' }, train, a, b)).toBe(failure)
    expect(como.matchPair(failure, route, { ...train, calls: train.calls.slice(1) }, a, b)).toBe(failure)
    expect(como.matchPair(failure, route, { ...train, directionId: '1' }, a, b)).toBe(failure)
    expect(como.matchPair(failure, route, train, { ...a, stop_id: 'ch:1:sloid:5307:0:6' }, b)).toBe(failure)
    expect(() => como.matchPair(failure, route, train, { ...a, stop_lon: '9.0' }, b)).toThrow('coordinate')
    const differentFailure = { reason: 'rail-disconnected' }
    expect(como.matchPair(differentFailure, route, train, a, b)).toBe(differentFailure)
  })
  it('rejects source edits, wrong station identities and alternatives to the explicitly reviewed tunnel', () => {
    const changed = structuredClone(osm)
    changed.elements.find(e => e.type === 'node' && e.id === 4126950607).tags.uic_ref = 'wrong'
    expect(() => zugComoMatcher(changed, policy.railComo, scope)).toThrow()
    const missing = { ...osm, elements: osm.elements.filter(e => !(e.type === 'way' && e.id === 25148357)) }
    expect(() => zugComoMatcher(missing, policy.railComo, scope)).toThrow()
    const renamed = structuredClone(osm)
    renamed.elements.find(e => e.type === 'way' && e.id === 25148357).tags['tunnel:name'] = 'Olimpino II'
    expect(() => zugComoMatcher(renamed, policy.railComo, scope)).toThrow()
    expect(() => zugComoMatcher(osm, { ...policy.railComo, reviewedWays: [] }, scope)).toThrow('siding')
  })
  it('rejects changed evidence and omitted or retimed source trips', async () => {
    await expect(load({ ...policy.railComo, sourceSha256: 'changed' })).rejects.toThrow('catalogue')
    const omitted = structuredClone(raw)
    omitted.snapshots[0].trains = omitted.snapshots[0].trains.filter(t => t.routeId !== route.routeId)
    await expect(load(policy.railComo, omitted)).rejects.toThrow('trip scope')
    const retimed = structuredClone(raw)
    retimed.snapshots[0].trains.find(t => t.routeId === route.routeId).calls[0].departure++
    await expect(load(policy.railComo, retimed)).rejects.toThrow('trip scope')
  })
})
