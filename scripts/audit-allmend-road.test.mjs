import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { auditAllmendRoad } from './audit-allmend-road.mjs'
import { loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'
import { buildDirectionTopology } from './validate-cantonal-road-directions.mjs'

const read = file => JSON.parse(readFileSync(file, 'utf8'))
const inputs = await loadUnmatchedRoadInputs()
const batchScope = read('data/cantonal-unmatched-road-scope.json')
const source = read('data/allmend-road-review-sources.json')
const reviews = read('data/adliswil-road-direction-reviews.json')
const scope = read('data/allmend-road-review-scope.json')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

it('identifies the missing city axis and shared junction while keeping the pair unapproved', () => {
  const before = digest(inputs), result = auditAllmendRoad(inputs, batchScope, source, reviews, scope)
  expect(result).toEqual(read('data/allmend-road-review.json'))
  expect(result.cityAxis).toMatchObject({ featureId: 5329, road: '4.1', presentInClassifiedResponse: false })
  expect(result.sharedJunction).toMatchObject({ stationDistanceMetres: 3.6 })
  expect(result.sharedJunction.features.map(f => f.featureId)).toEqual([5329, 7017, 7020])
  expect(result.geometryStatus).toBe('city-axis-extension-and-junction-review-required')
  expect(result.detectorDescriptions).toHaveLength(4)
  expect(result.candidatePairs.every(p => p.publicationStatus === 'not-admitted' && p.longestRunMinutes === 245)).toBe(true)
  expect(result).not.toHaveProperty('topology')
  expect(result).not.toHaveProperty('sections')
  expect(digest(inputs)).toBe(before)
})

it('validates only Adliswil and does not admit either neighbouring section', () => {
  const reviewed = buildDirectionTopology(inputs.geometry, inputs.catalog, inputs.directions.places, reviews.entries)
  const station = reviewed.stationAudit.find(s => s.id === 'ZH.CH:4087')
  expect(station.status).toBe('validated')
  expect(station.detectors.map(d => d.direction)).toEqual(['positive', 'negative'])
  expect(station.detectors[0]).toMatchObject({ originalStatus: 'destination-extent-conflict', review: { anchorDetectorId: 'ZH.CH:4087.02' } })
  expect(reviewed.stationAudit.filter(s => s.id !== station.id)).toEqual(inputs.directions.stationAudit.filter(s => s.id !== station.id))
  expect(reviewed.sections).toEqual(inputs.directions.sections)
  const report = auditAllmendRoad(inputs, batchScope, source, reviews, scope)
  expect(report.candidatePairs.find(p => p.from === 'ZH.CH:1520').endpointAudits[0].detectors.map(d => d.status)).toEqual(['destination-extent-conflict', 'destination-too-close'])
  expect(report.candidatePairs.find(p => p.to === 'ZH.CH:0197').endpointAudits[1].status).toBe('unmatched-geometry')
})

it('rejects changed source evidence and incomplete classified responses', () => {
  const changed = structuredClone(source)
  changed.collection.features.pop()
  expect(() => auditAllmendRoad(inputs, batchScope, changed, reviews, scope)).toThrow('review scope changed')
  expect(() => auditAllmendRoad(inputs, batchScope, changed, reviews, { ...scope, classifiedSourceSha256: digest(changed) })).toThrow('incomplete WFS response')
})

it('does not apply the saved review to another station or a changed anchor', () => {
  const changed = structuredClone(reviews)
  changed.entries[0].stationId = 'ZH.CH:0197'
  expect(() => auditAllmendRoad(inputs, batchScope, source, changed, { ...scope, directionReviewsSha256: digest(changed) })).toThrow('station-scoped')
  changed.entries[0] = { ...reviews.entries[0], anchorDetectorId: 'ZH.CH:4087.01' }
  expect(() => auditAllmendRoad(inputs, batchScope, source, changed, { ...scope, directionReviewsSha256: digest(changed) })).toThrow('validated anchor')
})

it('rechecks partner collector labels although Adliswil was already geometry-matched', () => {
  const changed = structuredClone(inputs)
  changed.sources.collectors.find(c => c.uID.id === 'M4087').detectors[0].name = 'Normalspur Richtung Bern'
  const repinnedBatch = { schemaVersion: 1, hashes: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, digest(v)])) }
  expect(() => auditAllmendRoad(changed, repinnedBatch, source, reviews, { ...scope, batchScopeSha256: digest(repinnedBatch) })).toThrow('Adliswil collector evidence changed')
})

it('requires a fresh review if the city axis appears in the classified response', () => {
  const changed = structuredClone(source)
  changed.collection.features[0].properties.achsnummer = '4.1'
  expect(() => auditAllmendRoad(inputs, batchScope, changed, reviews, { ...scope, classifiedSourceSha256: digest(changed) })).toThrow('City axis is now present')
})
