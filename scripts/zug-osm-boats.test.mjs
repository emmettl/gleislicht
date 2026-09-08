import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadZugOsmBoats, zugFerryRelation } from './zug-osm-boats.mjs'
import { loadZugBoats } from './zug-boat-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const policy = JSON.parse(readFileSync('data/zug-policy.json')), bytes = readFileSync('data/zug-timetable.json.gz'), raw = JSON.parse(gunzipSync(bytes))
const load = (p = policy.boatOsm, r = raw, hash = sha256(bytes)) => loadZugOsmBoats(p, policy.boat, r, hash)

describe('Zug complete-pattern OSM ferry supplement', () => {
  it('binds all ten directed lake patterns and inventories independent geometry without importing it', async () => {
    const boats = await load()
    expect(boats.relations).toHaveLength(10); expect(boats.patterns).toHaveLength(10)
    expect(boats.patterns.reduce((n, p) => n + p.occurrences.length, 0)).toBe(22)
    expect(boats.inventory.filter(e => e.use === 'admitted-only-for-reviewed-directed-pair').map(e => e.id)).toEqual([1354042135, 1354042139])
    expect(boats.inventory.filter(e => e.type === 'node')).toHaveLength(31)
    expect(boats.inventory.filter(e => e.use === 'called-dock-identity-evidence')).toHaveLength(15)
    expect(boats.topography).toHaveLength(27)
    expect(boats.topography.every(f => f.overlappingLakes.length === 0)).toBe(true)
    expect(boats.pairs.map(p => p.path.length)).toEqual([33, 20])
    expect(boats.pairs.map(p => Math.round(p.pathMetres))).toEqual([8884, 5417])
    expect(boats.pairs.map(p => p.intervals.map(i => [i.date, i.seconds]))).toEqual([[['2026-09-04', 1980], ['2026-09-06', 1980]], [['2026-09-06', 1200]]])
    expect(boats.pairs.every(p => p.maximumSnapMetres < 25 && !p.water.landCrossing && p.water.outsideIntervals.every(i => i.dock !== null))).toBe(true)
    expect(boats.pairs.flatMap(p => p.intervals).every(i => i.meanKmh > 16 && i.meanKmh < 17)).toBe(true)
  })
  it('completes only the three failed trips and leaves every successful original pair unchanged', async () => {
    const boats = await load(), primary = await loadZugBoats(policy.boat), stops = new Map(raw.stops.map(s => [s.stop_id, s]))
    const totals = []
    for (const day of raw.snapshots) {
      let admitted = 0, added = 0
      for (const train of day.trains) {
        const route = raw.inventory.find(r => r.routeId === train.routeId)
        if (route.mode !== 'boat') continue
        let changed = false
        for (let i = 1; i < train.calls.length; i++) {
          const from = stops.get(train.calls[i - 1].id), to = stops.get(train.calls[i].id), original = primary.matchPair(route, from, to)
          const result = boats.matchPair(original, route, train, from, to)
          expect(result.path).toBeDefined()
          if (original.path) expect(result).toBe(original)
          else { changed = true; expect(result.primaryFailure).toBe(original); expect(result.geometrySource).toBe('osm-boat-pattern-inference') }
        }
        admitted++; if (changed) added++
      }
      totals.push([admitted, added])
    }
    expect(totals).toEqual([[9, 1], [13, 2]])
  })
  it('refuses context-free reuse, reversed calls, wrong identities and changed coordinates', async () => {
    const boats = await load(), p = boats.pairs[0], train = raw.snapshots[0].trains.find(t => t.id === p.intervals[0].tripId)
    const route = raw.inventory.find(r => r.routeId === p.routeId), from = raw.stops.find(s => s.stop_id === p.fromId), to = raw.stops.find(s => s.stop_id === p.toId), failure = { reason: 'boat-land-crossing' }
    expect(boats.matchPair(failure, route, undefined, from, to)).toBe(failure)
    expect(boats.matchPair(failure, route, { ...train, calls: [...train.calls].reverse() }, to, from)).toBe(failure)
    expect(boats.matchPair(failure, { ...route, agencyId: '179' }, train, from, to)).toBe(failure)
    const changed = structuredClone(train); changed.calls[0].pickupType = '2'
    expect(boats.matchPair(failure, route, changed, from, to)).toBe(failure)
    expect(() => boats.matchPair(failure, route, train, { ...from, stop_lon: '8.6' }, to)).toThrow()
    const otherFailure = { reason: 'no-reviewed-boat-geometry' }
    expect(boats.matchPair(otherFailure, route, train, from, to)).toBe(otherFailure)
  })
  it('rejects disconnected ordered members and contradictory directions without graph shortcuts', () => {
    const dock = id => ({ type: 'node', id, tags: { amenity: 'ferry_terminal', uic_ref: String(id) } })
    const elements = new Map([['node/1', dock(1)], ['node/2', dock(2)], ['way/9', { id: 9, tags: { route: 'ferry' }, nodes: [1, 3, 2] }]])
    const r = { id: 8, members: [{ type: 'node', ref: 1, role: 'stop' }, { type: 'node', ref: 2, role: 'stop' }, { type: 'way', ref: 9, role: '' }] }
    expect(zugFerryRelation(r, elements).nodeIds).toEqual([1, 3, 2])
    expect(() => zugFerryRelation({ ...r, members: r.members.map(m => m.type === 'way' ? { ...m, role: 'backward' } : m) }, elements)).toThrow('direction')
    elements.set('way/9', { id: 9, tags: { route: 'ferry' }, nodes: [3, 2] })
    expect(() => zugFerryRelation(r, elements)).toThrow('Disconnected')
  })
  it('rejects unpinned sources and altered full timetable scope', async () => {
    await expect(load({ ...policy.boatOsm, sourceSha256: 'changed' })).rejects.toThrow('catalogue')
    await expect(load(policy.boatOsm, raw, 'changed')).rejects.toThrow('timetable')
    const changed = structuredClone(raw), train = changed.snapshots[0].trains.find(t => t.routeId === '94-366-0-j26-1')
    train.calls[0].departure++
    await expect(load(policy.boatOsm, changed)).rejects.toThrow('full boat calls or times')
  })
})
