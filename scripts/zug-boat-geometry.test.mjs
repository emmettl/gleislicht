import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { auditZugBoatWater, loadZugBoats, zugBoatGeometry } from './zug-boat-geometry.mjs'
import { distanceMetres } from './water-paths.mjs'

const json = path => JSON.parse(readFileSync(path))
const policy = json('data/zug-policy.json').boat
const pages = Object.fromEntries(['wide', 'zugersee', 'aegerisee'].map(id => [id, json(`${policy.sourceDirectory}/${id}.json`)]))
const lakes = json(`${policy.sourceDirectory}/lakes.json`)
const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]

describe('Zug official shipping inference', () => {
  it('detects thin islands and land between separate parts without fixed-step sampling', () => {
    const lake = [ring(8, 47, 8.1, 47.1), ring(8.05001, 47.04, 8.05002, 47.06)]
    const path = [[8.01, 47.05], [8.09, 47.05]]
    const audit = auditZugBoatWater(path, [lake], path, 200)
    expect(audit.landCrossing).toBe(true)
    expect(audit.outsideIntervals).toHaveLength(1)
    expect(audit.outsideIntervals[0].lengthMetres).toBeLessThan(1)
    expect(auditZugBoatWater(path, [[ring(8, 47, 8.04, 47.1)], [ring(8.06, 47, 8.1, 47.1)]], path, 200).landCrossing).toBe(true)
    // A separate water part can fill a gap; it must not be discarded.
    expect(auditZugBoatWater(path, [lake, [ring(8.05, 47.04, 8.06, 47.06)]], path, 200).landCrossing).toBe(false)
  })
  it('records dock discrepancies but cannot combine two dock zones to excuse a land crossing', () => {
    const water = [[ring(8, 47, 8.1, 47.1)]], path = [[7.9995, 47.05], [8.02, 47.05]]
    const audit = auditZugBoatWater(path, water, path, 200)
    expect(audit.landCrossing).toBe(false)
    expect(audit.outsideIntervals[0].dock).toBe(0)
    expect(auditZugBoatWater(path, water, path, 10).landCrossing).toBe(true)
    const landPath = [[8, 46.99], [8.004, 46.99]]
    expect(auditZugBoatWater(landPath, water, landPath, 200).landCrossing).toBe(true)
  })
  it('pins the source pages and exact lake membership, rejecting missing or changed features', async () => {
    const source = await loadZugBoats(policy)
    expect(source.inventory).toHaveLength(35)
    expect(source.inventory.filter(f => f.lakes.length)).toHaveLength(18)
    const missing = structuredClone(pages)
    missing.aegerisee.results = missing.aegerisee.results.filter(f => f.id !== policy.lakes[1].shippingFeatureIds[0])
    expect(() => zugBoatGeometry(missing, lakes, policy)).toThrow('membership')
    const changed = structuredClone(pages)
    changed.zugersee.results.find(f => f.id === policy.lakes[0].shippingFeatureIds[0]).geometry.coordinates[0][0] += .001
    expect(() => zugBoatGeometry(changed, lakes, policy)).toThrow('differs')
    await expect(loadZugBoats({ ...policy, sourceSha256: 'changed' })).rejects.toThrow('catalogue')
  })
  it('admits whole boat patterns and preserves repeated calls while rejecting remote land crossings', async () => {
    const boats = await loadZugBoats(policy)
    const raw = JSON.parse(gunzipSync(readFileSync('data/zug-timetable.json.gz')))
    const stops = new Map(raw.stops.map(s => [s.stop_id, s])), routes = new Map(raw.inventory.map(r => [r.routeId, r]))
    const counts = raw.snapshots.map(day => {
      let admitted = 0
      for (const t of day.trains.filter(t => routes.get(t.routeId).mode === 'boat')) {
        const route = routes.get(t.routeId)
        const pairs = t.calls.slice(1).map((c, i) => boats.matchPair(route, stops.get(t.calls[i].id), stops.get(c.id)))
        admitted += Number(pairs.every(p => p.path))
        for (const [i, p] of pairs.entries()) {
          if (p.path) {
            expect(p.water.landCrossing).toBe(false)
            const a = stops.get(t.calls[i].id), b = stops.get(t.calls[i + 1].id)
            expect(distanceMetres(p.path[0], [Number(a.stop_lon), Number(a.stop_lat)])).toBeLessThan(.01)
            expect(distanceMetres(p.path.at(-1), [Number(b.stop_lon), Number(b.stop_lat)])).toBeLessThan(.01)
          } else expect(p.reason).toBe('boat-land-crossing')
        }
      }
      return admitted
    })
    expect(counts).toEqual([8, 11])
    const route = routes.get(policy.routes[1].routeId), from = stops.get('ch:1:sloid:30742'), to = stops.get('ch:1:sloid:30743')
    expect(boats.matchPair(route, to, from).path).toEqual([...boats.matchPair(route, from, to).path].reverse())
    expect(boats.matchPair({ ...route, agencyId: '186' }, from, to).reason).toBe('no-reviewed-boat-geometry')
    expect(boats.matchPair(route, from, stops.get('ch:1:sloid:2251')).reason).toBe('boat-dock-identity')
  })
})
