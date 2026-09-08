import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyReviewedBaselGeometry, baselPlatformPatternHash, reviewedBaselPath } from './basel-reviewed-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

const bundle = JSON.parse(readFileSync('data/basel-reviewed-geometry.json'))
const manifest = JSON.parse(readFileSync('public/data/basel-core-day-manifest.json'))
const stop = id => manifest.stops.find(point => point[4] === id)
  ?? bundle.rules.find(rule => rule.fromId === id)?.fromCoordinate
  ?? bundle.rules.find(rule => rule.toId === id)?.toCoordinate
const match = (rule, data = bundle) => reviewedBaselPath(rule, data, stop(rule.fromId), stop(rule.toId))

describe('reviewed Basel source corridors', () => {
  it('resolves all reviewed pairs within the unchanged snap guard', () => {
    expect(bundle.rules).toHaveLength(236)
    for (const rule of bundle.rules) {
      const result = match(rule)
      expect(result.maximumSnapMetres).toBeLessThan(32)
      expect(distanceMetres(result.path[0], stop(rule.fromId))).toBeLessThan(.02)
      expect(distanceMetres(result.path.at(-1), stop(rule.toId))).toBeLessThan(.02)
    }
  })

  it('uses the eastbound Dreirosen turn and arrives at Aeschenplatz H facing east', () => {
    const turn = match(bundle.rules.find(rule => rule.id === 'tram-depot-9'))
    expect(turn.pathMetres).toBeGreaterThan(360)
    expect(turn.pathMetres).toBeLessThan(390)
    expect(Math.min(...turn.path.map(p => p[0]))).toBeGreaterThan(turn.path[0][0] - .00015)
    const arrival = match(bundle.rules.find(rule => rule.id === 'tram-depot-102'))
    expect(arrival.pathMetres).toBeGreaterThan(450)
    expect(arrival.pathMetres).toBeLessThan(480)
    const before = arrival.path.findLast(point => distanceMetres(point, arrival.path.at(-1)) > 15)
    expect(before[0]).toBeLessThan(arrival.path.at(-1)[0])
  })

  it('pins depot repairs to the full reviewed platform sequence', () => {
    const rule = bundle.rules.find(rule => rule.id === 'tram-depot-1')
    const review = JSON.parse(readFileSync('data/basel-tram-pattern-review.json'))
    const instance = review.rows.find(row => row.ruleId === rule.id).instances.find(x => x.date === '2026-09-08')
    const train = manifest.chunks.flatMap(chunk => JSON.parse(readFileSync(`public/data/${chunk.path}`)).trains).find(t => t.id === instance.tripId)
    expect(baselPlatformPatternHash(train, manifest.stops)).toBe(instance.patternSha256)
    const segment = instance.segmentIndexes[0]
    const missing = { ...train, pathSegments: train.pathSegments.map((path, i) => i === segment ? null : path) }
    const routes = new Map([[rule.routeId, { agencyId: rule.agencyId, mode: rule.mode }]])
    const apply = t => applyReviewedBaselGeometry({ ...manifest, trains: [t] }, routes, { ...bundle, rules: [rule] }).snapshot.trains[0]
    expect(apply(missing).pathSegments[segment]).not.toBeNull()
    // The adjacent pair stays intact while a call elsewhere in the pattern changes.
    const changed = { ...missing, stops: [...missing.stops, missing.stops[0]], pathSegments: [...missing.pathSegments, null] }
    expect(apply(changed).pathSegments[segment]).toBeNull()
    expect(missing.pathSegments[segment]).toBeNull()
  })

  it('keeps tram 6 via Markthalle and bus 33 around the southern loop', () => {
    const tram = match(bundle.rules.find(rule => rule.id === 'tram6-heuwaage-zoo-via-markthalle'))
    expect(tram.pathMetres).toBeGreaterThan(740)
    expect(tram.pathMetres).toBeLessThan(800)
    expect(Math.min(...tram.path.map(point => distanceMetres(point, stop('ch:1:sloid:193:1:1'))))).toBeLessThan(10)
    const bus = match(bundle.rules.find(rule => rule.id === 'bus-33-southern-loop'))
    expect(bus.pathMetres).toBeGreaterThan(830)
    expect(bus.pathMetres).toBeLessThan(900)
    expect(Math.min(...bus.path.map(point => point[1]))).toBeLessThan(47.5484)
  })

  it('rejects moved platforms, disconnected parts and reverse one-way roads', () => {
    const rule = bundle.rules.find(rule => rule.id === 'bus-33-southern-loop')
    expect(() => reviewedBaselPath(rule, bundle, [0, 0], stop(rule.toId))).toThrow(/platform moved/)
    const disconnected = structuredClone(bundle)
    disconnected.features[rule.parts[1].featureId].points[rule.parts[1].from][0] += .001
    expect(() => match(rule, disconnected)).toThrow(/Disconnected/)
    const opposite = structuredClone(bundle), first = rule.parts[0]
    opposite.features[first.featureId].properties.oneway = first.from < first.to ? '-1' : 'yes'
    expect(() => match(rule, opposite)).toThrow(/one-way/)
  })

  it('fills only exact reviewed missing movements and preserves accepted paths', () => {
    const rule = bundle.rules[0], from = manifest.stops.findIndex(point => point[4] === rule.fromId), to = manifest.stops.findIndex(point => point[4] === rule.toId)
    const train = { id: 'missing', routeId: rule.routeId, route: rule.line, stops: [[from, 0, 0], [to, 60, 60]], pathSegments: [null] }
    const snapshot = { ...manifest, metadata: { ...manifest.metadata, feedVersion: bundle.feedVersion }, paths: [[[1, 1], [2, 2]]],
      trains: [train, { ...train, id: 'accepted', pathSegments: [0] }, { ...train, id: 'other-route', routeId: 'other' }] }
    const routes = new Map([[rule.routeId, { agencyId: rule.agencyId, mode: rule.mode }]])
    const result = applyReviewedBaselGeometry(snapshot, routes, bundle)
    expect(result.review.addedMovements).toBe(1)
    expect(result.snapshot.trains[1]).toEqual(snapshot.trains[1])
    expect(result.snapshot.paths[0]).toEqual(snapshot.paths[0])
    expect(result.snapshot.trains[2].pathSegments).toEqual([null])
    expect(snapshot.trains[0].pathSegments).toEqual([null])
    for (const metadata of [{ serviceDate: '2026-09-09' }, { feedVersion: 'new-feed' }, { sourceServiceDates: ['2026-09-06', '2026-09-08'] }]) {
      expect(() => applyReviewedBaselGeometry({ ...snapshot, metadata: { ...snapshot.metadata, ...metadata } }, routes, bundle)).toThrow()
    }
  })
})
