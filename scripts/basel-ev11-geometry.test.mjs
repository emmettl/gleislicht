import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { applyReviewedBaselGeometry, baselPlatformPatternHash, reviewedBaselPath } from './basel-reviewed-geometry.mjs'
import { lv95ToWgs84 } from './ingest-national-road-topology.mjs'

const bundle = JSON.parse(readFileSync('data/basel-reviewed-geometry.json'))
const review = JSON.parse(readFileSync('data/basel-ev11-geometry-review.json'))
const rule = bundle.rules.find(r => r.id === review.ruleId)
const bytes = readFileSync(review.sourceFile), source = JSON.parse(gunzipSync(bytes))
const match = (data = bundle) => reviewedBaselPath(rule, data, rule.fromCoordinate, rule.toCoordinate)

it('reproduces the complete EV11 source chain, including the northern 4m road', () => {
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(review.sourceSha256)
  expect(review.sourceSha256).toBe(bundle.provenance.tlmRoad.retainedSha256)
  expect(source.assetHashes).toEqual(bundle.provenance.tlmRoad.assetHashes)
  expect(rule.parts.map(p => p.featureId)).toEqual(review.sourceFeatureIds)
  expect(source.features).toHaveLength(13)
  source.features.forEach((f, i) => {
    const actual = bundle.features[rule.parts[i].featureId]
    expect(actual.sourceFeatureId).toBe(f.id)
    expect(actual.properties).toEqual(f.properties)
    expect(actual.sourceCoordinates).toEqual(f.paths[0])
    expect(actual.points).toEqual(f.paths[0].map(lv95ToWgs84))
    expect(rule.parts[i]).toEqual({ featureId: `tlm-road:${f.id}`, from: actual.points.length - 1, to: 0 })
  })
  expect(source.features.slice(0, 3).map(f => f.properties.OBJEKTART)).toEqual(['4m Strasse', '4m Strasse', '4m Strasse'])
  expect(source.features.slice(0, 7).every(f => f.properties.STRNAME === 'Neapel-Strasse')).toBe(true)
  expect(source.features.slice(7).every(f => f.properties.STRNAME === 'Ruchfeldstrasse')).toBe(true)
  const result = match()
  expect(result.pathMetres).toBeGreaterThan(790)
  expect(result.pathMetres).toBeLessThan(800)
  expect(result.maximumSnapMetres).toBeLessThan(12)
  // Keep the full western curve; the earlier Genuastrasse shortcut skips it.
  expect(Math.min(...result.path.map(p => p[0]))).toBeLessThan(7.60865)
})

it('rejects a footpath, traffic restriction, directional road, or altered source geometry', () => {
  for (const change of [
    f => { f.properties.OBJEKTART = '2m Weg' },
    f => { f.properties.VERKEHRSBE = 'Allgemeine Verkehrsbeschraenkung' },
    f => { f.properties.RICHTUNGSG = 'Wahr' },
    f => { f.points[0][0] += .00001 },
  ]) {
    const changed = structuredClone(bundle); change(changed.features[rule.parts[0].featureId])
    expect(() => match(changed)).toThrow()
  }
})

it('binds all 281 repairs to the complete dated source platform pattern', () => {
  expect(review.instances.filter(t => t.date === '2026-09-08')).toHaveLength(177)
  expect(review.instances.filter(t => t.date === '2026-09-13')).toHaveLength(104)
  expect(review.patterns).toHaveLength(1)
  expect(rule.patternSha256).toEqual(review.patterns.map(p => p.patternSha256))
  const stops = review.patterns[0].platforms.map(([id, lon, lat]) => [lon, lat, '', '', id])
  const train = { routeId: rule.routeId, route: rule.line, stops: stops.map((_, i) => [i, i * 60, i * 60]), pathSegments: stops.slice(1).map(() => null) }
  expect(baselPlatformPatternHash(train, stops)).toBe(rule.patternSha256[0])
  const snapshot = { stops, edges: [], paths: [], trains: [train], metadata: { feedVersion: bundle.feedVersion, serviceDate: '2026-09-08', sourceServiceDates: ['2026-09-07', '2026-09-08'] } }
  const routes = new Map([[rule.routeId, { agencyId: rule.agencyId, mode: rule.mode }]])
  const apply = value => applyReviewedBaselGeometry({ ...snapshot, trains: [value] }, routes, { ...bundle, rules: [rule] })
  expect(apply(train).review.addedMovements).toBe(1)
  const changed = { ...train, stops: [...train.stops, train.stops[0]], pathSegments: [...train.pathSegments, null] }
  expect(apply(changed).review.addedMovements).toBe(0)
})
