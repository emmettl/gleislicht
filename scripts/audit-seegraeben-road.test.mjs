import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { auditSeegraebenRoad, reviewSeegraebenRoadBindings, seegraebenInputFiles } from './audit-seegraeben-road.mjs'

const read = file => JSON.parse(readFileSync(file, 'utf8'))
const inputs = Object.fromEntries(Object.entries(seegraebenInputFiles).map(([key, file]) => [key, read(file)]))
const scope = read('data/seegraeben-road-audit-scope.json')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const pin = values => ({ schemaVersion: 1, hashes: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, digest(value)])) })

it('rejects three wrong-road pairs while keeping their observation evidence', () => {
  const result = auditSeegraebenRoad(inputs, scope)
  expect(result).toEqual(read('data/seegraeben-road-review.json'))
  expect(result.stationReviews).toMatchObject([
    { id: 'ZH.CH:2988', detailedAxisFeatureId: 7862, axisDistanceMetres: 0, classifiedRoadDistanceMetres: 97.14 },
    { id: 'ZH.CH:0392', detailedAxisFeatureId: 274, axisDistanceMetres: 0.13, classifiedRoadDistanceMetres: 39.11 },
  ])
  expect(result.removedPairs).toHaveLength(3)
  expect(result.removedPairs.every(p => p.publicationStatus === 'rejected-wrong-road')).toBe(true)
  expect(result.removedPairs.find(p => p.from === 'ZH.CH:0188')).toMatchObject({ to: 'ZH.CH:2988', longestRunMinutes: 245, completeMinutes: 245 })
  expect(result.newDiagnosticPairs).toMatchObject([{ from: 'ZH.CH:0188', to: 'ZH.CH:2788', publicationStatus: 'not-admitted' }])
  expect(result.newDiagnosticPairs[0]).not.toHaveProperty('completeMinutes')
  expect(result).not.toHaveProperty('topology')
  expect(result).not.toHaveProperty('sections')
})

it('only removes the two reviewed associations without moving counters or changing source inputs', () => {
  const before = digest(inputs)
  const { reviewedGeometry } = reviewSeegraebenRoadBindings(inputs, scope)
  for (const station of reviewedGeometry.stations) {
    const original = inputs.geometry.stations.find(s => s.id === station.id)
    if (['ZH.CH:2988', 'ZH.CH:0392'].includes(station.id)) {
      expect(station).toEqual({ ...original, geometryStatus: 'reviewed-outside-classified-network', candidates: [] })
    } else expect(station).toEqual(original)
  }
  expect(reviewedGeometry.paths).toEqual(inputs.geometry.paths)
  expect(digest(inputs)).toBe(before)
})

it('rejects drift in every pinned input', () => {
  for (const key of Object.keys(inputs)) {
    const changed = structuredClone(inputs)
    changed[key].changed = true
    expect(() => auditSeegraebenRoad(changed, scope)).toThrow('review inputs changed')
  }
})

it('rejects incomplete, incorrectly referenced or malformed road evidence after repinning', () => {
  const edits = [
    s => { s.axes.collection.features.pop() },
    s => { s.axes.collection.crs.properties.name = 'EPSG:4326' },
    s => { s.axes.url = s.axes.url.replace('2700100', '2700300') },
    s => { s.axes.collection.features[0].geometry.coordinates[0] = [8.7, 47.3] },
  ]
  for (const edit of edits) {
    const changed = structuredClone(inputs)
    edit(changed.sources)
    expect(() => auditSeegraebenRoad(changed, pin(changed))).toThrow(/incomplete|EPSG|query|Invalid detailed/)
  }
})

it('requires the same station point, source identity and municipal ownership', () => {
  const edits = [
    s => { s.stations.collection.features.find(f => f.properties.messst_nr === 2988).geometry.coordinates[0] += 10 },
    s => { s.collectors.records.find(r => r.uID.id === 'M2988').name = 'Seegräben: Zürcherstrasse' },
    s => { s.axes.collection.features.find(f => f.properties.strass_id === 7862).properties.eigentum = 'Kanton' },
  ]
  for (const edit of edits) {
    const changed = structuredClone(inputs)
    edit(changed.sources)
    expect(() => auditSeegraebenRoad(changed, pin(changed))).toThrow(/point changed|identity changed|not independently clear/)
  }
})

it('rejects a competing axis at the station instead of selecting the expected feature ID', () => {
  const changed = structuredClone(inputs), collection = changed.sources.axes.collection
  const duplicate = structuredClone(collection.features.find(f => f.properties.strass_id === 7862))
  duplicate.properties.strass_id = 999999
  collection.features.push(duplicate)
  collection.numberMatched++
  expect(() => auditSeegraebenRoad(changed, pin(changed))).toThrow('not independently clear')
})

it('rejects a stale section baseline rather than silently changing the diagnostic queue', () => {
  const changed = structuredClone(inputs)
  changed.directions.sectionAudit[0].distanceMetres++
  expect(() => auditSeegraebenRoad(changed, pin(changed))).toThrow('Baseline direction evidence changed')
})
