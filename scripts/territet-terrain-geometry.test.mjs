import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { auditTerritetTerrain } from './audit-territet-terrain.mjs'

const read = name => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'))
const source = read('data/territet-terrain-source.json')
const network = read('public/data/territet-day.json')
const evidence = read('data/territet-journey-source.json')
const fot = read('data/territet-funicular-source.json')
const published = read('data/territet-terrain-audit.json')
const build = (s = source, n = network, e = evidence, f = fot) => auditTerritetTerrain(s, n, e, f)

describe('Territet measured funicular geometry audit', () => {
  it('reproduces the retained audit with two alternatives and no playback authorisation', () => {
    expect(build()).toEqual(published)
    expect(published.status).toBe('geometry-audited-playback-not-enabled')
    expect(published.counts).toEqual({ boundedFeatures: 28, funicularFeatures: 12, excludedOtherRailFeatures: 16, vertices: 12, alternatives: 2, commonFeatures: 6, bridgeFeatures: 4, datedTrips: 140 })
    expect(published.alternatives.map(a => a.xyz.length)).toEqual([25, 25])
    expect(published).not.toHaveProperty('forwardTripIds')
    expect(published).not.toHaveProperty('reverseTripIds')
  })

  it('retains original XYZ vertices, exact joins and both complete passing-loop branches', () => {
    const used = new Set()
    for (const route of published.alternatives) {
      const joined = []
      for (const id of route.featureIds) {
        used.add(id)
        const f = source.features.find(f => f.id === id)
        expect(f.properties.STANDSEILB).toBe('Wahr')
        expect(f.properties.ACHSE_DKM).toBe('Falsch')
        const points = f.paths[0]
        if (joined.length) expect(joined.at(-1)).toEqual(points[0])
        joined.push(...(joined.length ? points.slice(1) : points))
      }
      expect(route.xyz).toEqual(joined)
      expect(route.branchFeatureIds).toHaveLength(3)
      expect(route.planarLengthMetres).toBeGreaterThan(561)
      expect(route.planarLengthMetres).toBeLessThan(562)
      expect(route.spatialLengthMetres).toBeGreaterThan(638)
      expect(route.spatialLengthMetres).toBeLessThan(639)
      expect(route.riseMetres).toBeCloseTo(302.018, 6)
      expect(route.maxCentrelineOffsetMetres).toBeLessThan(4.2)
      expect(route.loop.map(p => p.xyz)).toEqual(published.junctions)
      expect(route.loop.every(p => p.offsetMetres === 0)).toBe(true)
      expect(route.stops.every(p => p.offsetMetres < 3.4)).toBe(true)
    }
    expect(used.size).toBe(12)
    expect(published.alternatives[0].branchFeatureIds.some(id => published.alternatives[1].branchFeatureIds.includes(id))).toBe(false)
    expect(published.alternatives[0].stops.map(s => s.xyz)).toEqual(published.alternatives[1].stops.map(s => s.xyz))
  })

  it('covers both loop hypotheses for all 140 independent dated trips', () => {
    for (const entry of published.tripWindows) {
      const train = network.trains.find(t => t.id === entry.tripId)
      const calls = evidence.trips[entry.tripId].calls
      const [start, end] = entry.conservativeMapWindow
      const ascent = entry.direction === 'ascent'
      const before = calls[ascent ? 1 : 0], after = calls[ascent ? 2 : 1]
      expect(start).toBeGreaterThan(before.departure)
      expect(end).toBeLessThan(after.arrival)
      expect(end).toBeGreaterThan(start)
      entry.hypothesisWindows.forEach(([a, b], i) => {
        expect(start).toBeLessThanOrEqual(a)
        expect(end).toBeGreaterThanOrEqual(b)
        const route = published.alternatives[i]
        const lo = route.stops[1].distanceMetres, hi = route.stops[2].distanceMetres
        const positions = route.loop.map(p => p.distanceMetres)
        if (!ascent) positions.reverse()
        const expected = positions.map(p => before.departure + (after.arrival - before.departure) * (ascent ? (p - lo) / (hi - lo) : (hi - p) / (hi - lo)))
        expect(a).toBeCloseTo(expected[0], 8)
        expect(b).toBeCloseTo(expected[1], 8)
      })
      expect(train.stops.map(([i, a, d]) => [network.stops[i][4], a, d])).toEqual(calls.map(c => [c.stopId, c.arrival, c.departure]))
    }
    const up = published.tripWindows.find(t => t.tripId === '.ojp-93-TG.1.TA.16.j26')
    const down = published.tripWindows.find(t => t.tripId === '.ojp-93-TG.1.TA.108.j26')
    expect(up.conservativeMapWindow).not.toEqual(down.conservativeMapWindow)
  })

  it('rejects changed source coordinates, missing loop branches, structures and provenance', () => {
    for (const mutate of [
      s => { s.sourceCrs = 'EPSG:4326' },
      s => { s.archiveSha256 = 'changed' },
      s => { s.sourceUrl = 'https://example.com/rail.zip' },
      s => { s.bounds[0]++ },
      s => { s.features.find(f => f.properties.STANDSEILB === 'Wahr').paths[0][0][2]++ },
      s => { s.features = s.features.filter(f => f.id !== published.alternatives[1].branchFeatureIds[0]) },
      s => { s.features.find(f => f.properties.STANDSEILB === 'Wahr').properties.KUNSTBAUTE = 'Tunnel' },
    ]) {
      const changed = structuredClone(source); mutate(changed)
      expect(() => build(changed)).toThrow()
    }
  })

  it('rejects changed timetable dates, calls, route identity, boarding flags and stop coordinates', () => {
    for (const mutate of [
      n => { n.metadata.serviceDate = '2026-09-05' },
      n => { n.trains[0].stops[1][1]++ },
      n => { n.trains[0].routeType = 106 },
      n => { n.trains[1] = n.trains[0] },
      n => { n.stops[1][0] += 0.000001 },
    ]) {
      const changed = structuredClone(network); mutate(changed)
      expect(() => build(source, changed)).toThrow()
    }
    const changed = structuredClone(evidence)
    changed.trips[network.trains[0].id].calls[0].pickup = '1'
    expect(() => build(source, network, changed)).toThrow('boarding flags')
    const otherInstallation = structuredClone(fot)
    otherInstallation.results.find(f => f.id === 670).properties.anlagenr = '61.999'
    expect(() => build(source, network, evidence, otherInstallation)).toThrow('identity')
  })
})
