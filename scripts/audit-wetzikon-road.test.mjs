import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { auditWetzikonRoad, wetzikonInputFiles } from './audit-wetzikon-road.mjs'
import { reviewMunicipalRoadBindings } from './review-municipal-road-bindings.mjs'

const read = file => JSON.parse(readFileSync(file, 'utf8'))
const inputs = Object.fromEntries(Object.entries(wetzikonInputFiles).map(([key, file]) => [key, read(file)]))
const scope = read('data/wetzikon-road-audit-scope.json')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const pin = values => ({ schemaVersion: 1, hashes: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, digest(value)])) })

it('closes the false eastward extension without inventing a replacement recording', () => {
  const before = digest(inputs), result = auditWetzikonRoad(inputs, scope)
  expect(result).toEqual(read('data/wetzikon-road-review.json'))
  expect(result.stationReview).toMatchObject({ id: 'ZH.CH:2788', detailedAxisFeatureId: 2165, ownership: 'Gemeinde', detailedAxisClass: 'Gemeindestrassen', axisDistanceMetres: 0, classifiedRoadDistanceMetres: 97 })
  expect(result.rejectedFollowUpPairs).toMatchObject([{ from: 'ZH.CH:0188', to: 'ZH.CH:2788', publicationStatus: 'rejected-wrong-road' }])
  expect(result.easternExtension.status).toBe('no-further-counter-on-reviewed-path')
  expect(result.remainingPairsTouchingUster).toMatchObject([{ from: 'ZH.CH:2188', to: 'ZH.CH:0188', publicationStatus: 'not-admitted' }])
  expect(result.rejectedFollowUpPairs[0]).not.toHaveProperty('completeMinutes')
  expect(result).not.toHaveProperty('topology')
  expect(result).not.toHaveProperty('sections')
  expect(digest(inputs)).toBe(before)
})

it('reuses the binding validator without changing any other station or road', () => {
  const { reviewedGeometry } = reviewMunicipalRoadBindings(inputs, scope, { bindings: [{ id: 'ZH.CH:2788', featureId: 2165 }], bbox: '2701000,1242500,2702000,1243500,EPSG:2056' })
  expect(reviewedGeometry.paths).toEqual(inputs.geometry.paths)
  for (const station of reviewedGeometry.stations) {
    const original = inputs.geometry.stations.find(s => s.id === station.id)
    expect(station).toEqual(station.id === 'ZH.CH:2788' ? { ...original, geometryStatus: 'reviewed-outside-classified-network', candidates: [] } : original)
  }
})

it('rejects drift in the new and prior evidence', () => {
  for (const key of Object.keys(inputs)) {
    const changed = structuredClone(inputs)
    changed[key].changed = true
    expect(() => auditWetzikonRoad(changed, scope)).toThrow('Wetzikon review inputs changed')
  }
  const stale = structuredClone(inputs)
  stale.seegraebenReview.newDiagnosticPairs[0].to = 'ZH.CH:9999'
  expect(() => auditWetzikonRoad(stale, pin(stale))).toThrow('Seegräben follow-up evidence changed')
})

it('requires complete source data and the unchanged station, label and municipal identity', () => {
  const changes = [
    s => { s.axes.collection.features.pop() },
    s => { s.stations.collection.features[0].geometry.coordinates[0] += 5 },
    s => { s.collectors.records[0].detectors[0].name = 'Normalspur Richtung Zürich' },
    s => { s.axes.collection.features.find(f => f.properties.strass_id === 2165).properties.eigentum = 'Kanton' },
  ]
  for (const change of changes) {
    const changed = structuredClone(inputs)
    change(changed.sources)
    expect(() => auditWetzikonRoad(changed, pin(changed))).toThrow(/incomplete|point changed|identity changed|not independently clear/)
  }
})

it('rejects ambiguous geometry rather than trusting the pinned feature number alone', () => {
  const changed = structuredClone(inputs), collection = changed.sources.axes.collection
  const competitor = structuredClone(collection.features.find(f => f.properties.strass_id === 2165))
  competitor.properties.strass_id = 999999
  collection.features.push(competitor)
  collection.numberMatched++
  expect(() => auditWetzikonRoad(changed, pin(changed))).toThrow('not independently clear')
})

it('requires the independently represented branch junction', () => {
  const changed = structuredClone(inputs)
  const axis = changed.sources.axes.collection.features.find(f => f.properties.strass_id === 2165)
  axis.geometry.coordinates.shift()
  expect(() => auditWetzikonRoad(changed, pin(changed))).toThrow('junction evidence changed')
})
