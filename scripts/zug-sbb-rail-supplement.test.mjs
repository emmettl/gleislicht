import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadZugSbbRailSupplement, zugSbbRailSupplement } from './zug-sbb-rail-supplement.mjs'

const read = p => JSON.parse(readFileSync(p))
const policy = read('data/zug-policy.json').railSupplement
const pages = ['line540.json', 'foreign-review.json'].map(f => read(`${policy.sourceDirectory}/${f}`))
const raw = JSON.parse(gunzipSync(readFileSync('data/zug-timetable.json.gz')))
const original = { reason: 'rail-no-exact-operating-point', geometrySource: 'fot' }

describe('SBB graphical rail alternatives for Zug', () => {
  it('preserves full source curves in each direction and the failed federal evidence', async () => {
    const adapter = await loadZugSbbRailSupplement(policy)
    expect(adapter.inventory).toHaveLength(66)
    expect(adapter.inventory.filter(r => r.usedBy.length)).toHaveLength(4)
    for (const c of policy.corridors) {
      const route = raw.inventory.find(r => r.routeId === c.routes[0].routeId)
      const [a, b] = c.operatingPointIds.map(id => raw.stops.find(s => s.didok === id))
      const forward = adapter.matchPair(original, route, a, b), reverse = adapter.matchPair(original, route, b, a)
      expect(forward.path.length).toBe(c.id === 'daeniken-schoenenwerd' ? 249 : 120)
      expect(reverse.path).toEqual([...forward.path].reverse())
      expect(forward.stationAttachmentsMetres.every(m => m < 100)).toBe(true)
      expect(forward.primaryFailure).toEqual(original)
    }
  })
  it('retains successful federal paths and refuses wrong operators or unreviewed station identities', () => {
    const adapter = zugSbbRailSupplement(pages, policy), c = policy.corridors[0]
    const route = raw.inventory.find(r => r.routeId === c.routes[0].routeId)
    const [a, b] = c.operatingPointIds.map(id => raw.stops.find(s => s.didok === id))
    const success = { path: [[1, 2], [3, 4]], geometrySource: 'fot' }
    expect(adapter.matchPair(success, route, a, b)).toBe(success)
    expect(adapter.matchPair(original, { ...route, agencyId: '82' }, a, b)).toBe(original)
    expect(adapter.matchPair(original, route, a, { ...b, didok: '8502113' })).toBe(original)
    expect(adapter.matchPair(original, route, a, { ...b, stop_lon: '8.1' }).reason).toBe('sbb-rail-station-attachment')
  })
  it('rejects truncation, duplicate identities, incompatible gauge, schematics and disconnected curves', () => {
    const truncated = structuredClone(pages); truncated[0].results.pop()
    expect(() => zugSbbRailSupplement(truncated, policy)).toThrow('Truncated')
    const duplicate = structuredClone(pages); duplicate[0].results.push(duplicate[0].results[0]); duplicate[0].total_count++
    expect(() => zugSbbRailSupplement(duplicate, policy)).toThrow('Duplicate')
    const mutate = fn => { const p = structuredClone(pages); fn(p[0].results.find(r => r.bp_anfang === 'DK')); return p }
    expect(() => zugSbbRailSupplement(mutate(r => { r.spurweite = 'M' }), policy)).toThrow('gauge')
    expect(() => zugSbbRailSupplement(mutate(r => { r.geo_shape.geometry.coordinates = r.geo_shape.geometry.coordinates.slice(0, 2) }), policy)).toThrow('Schematic')
    expect(() => zugSbbRailSupplement(mutate(r => { r.geo_shape.geometry.coordinates.at(-1)[0] += 0.00001 }), policy)).toThrow('Disconnected')
  })
})
