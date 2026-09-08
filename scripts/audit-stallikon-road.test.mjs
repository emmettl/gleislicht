import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { auditStallikonRoad } from './audit-stallikon-road.mjs'
import { loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'

const read = file => JSON.parse(readFileSync(file, 'utf8'))
const inputs = await loadUnmatchedRoadInputs()
const batchScope = read('data/cantonal-unmatched-road-scope.json')
const source = read('data/stallikon-road-review-sources.json')
const scope = read('data/stallikon-road-review-scope.json')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

it('retains both A3 axes and ZH 642 without converting horizontal crossings to junctions', () => {
  const before = digest(inputs)
  const report = auditStallikonRoad(inputs, batchScope, source, scope)
  expect(report).toEqual(read('data/stallikon-road-review.json'))
  expect(report.axes.map(a => a.featureId)).toEqual([3632, 6572, 6570, 3631])
  expect(report.crossings).toMatchObject([{ motorwayFeatureId: 6572, stationDistanceMetres: 9.98 }, { motorwayFeatureId: 6570, stationDistanceMetres: 62.39 }])
  expect(report.competingAxisMarginMetres).toBe(6.5)
  expect(report.originalGeometryStatus).toBe('ambiguous-road')
  expect(report).not.toHaveProperty('topology')
  expect(report).not.toHaveProperty('sections')
  expect(digest(inputs)).toBe(before)
})

it('keeps a passing conditional Stallikon direction from becoming an approved station', () => {
  const report = auditStallikonRoad(inputs, batchScope, source, scope)
  expect(report.conditionalDirectionCheck.status).toBe('diagnostic-only-assuming-ZH-650')
  expect(report.conditionalDirectionCheck.detectors).toMatchObject([
    { id: 'ZH.CH:3387.01', status: 'destination-too-close', destinationDistanceMetres: 5554.62, offsetSeparationMetres: 570.8, destinationRoadDistanceMetres: 5521.98, bearingAgreement: -0.05 },
    { id: 'ZH.CH:3387.02', status: 'validated', direction: 'negative' },
  ])
  expect(inputs.geometry.stations.find(s => s.id === report.stationId).match).toBeNull()
  expect(inputs.directions.stationAudit.find(s => s.id === report.stationId).status).toBe('unmatched-geometry')
  expect(report.candidatePair.otherEndpoint.detectors).toMatchObject([
    { status: 'destination-off-axis', destinationRoadDistanceMetres: 5521.98, bearingAgreement: 0.07 },
    { status: 'validated', direction: 'negative' },
  ])
})

it('records the ZH 642 roundabout inside the short paired section without assigning turning flows', () => {
  const report = auditStallikonRoad(inputs, batchScope, source, scope)
  expect(report.candidatePair).toMatchObject({ from: 'ZH.CH:3287', to: 'ZH.CH:3387', distanceMetres: 208.39, completeMinutes: 235, longestRunMinutes: 149, hourWindows: [{ start: 51240, end: 60120, minutes: 149 }], publicationStatus: 'not-admitted' })
  expect(report.interveningJunction.ringFeatureIds).toEqual([6268, 6269, 6270])
  expect(report.interveningJunction.schematicConnectorFeatureIds).toEqual([6271, 6272, 6273])
  expect(report.interveningJunction.approaches.map(a => a.road)).toEqual(['650', '650', '642'])
  expect(report.interveningJunction.approaches.every(a => a.distanceAlongCandidateFrom3287Metres > 0 && a.distanceAlongCandidateFrom3287Metres < report.candidatePair.distanceMetres)).toBe(true)
  expect(report.interveningJunction).not.toHaveProperty('turningFlows')
})

it('rejects incomplete or changed classified sources', () => {
  const changed = structuredClone(source)
  changed.collection.features.pop()
  expect(() => auditStallikonRoad(inputs, batchScope, changed, scope)).toThrow('review scope changed')
  expect(() => auditStallikonRoad(inputs, batchScope, changed, { ...scope, classifiedSourceSha256: digest(changed) })).toThrow('incomplete WFS response')
  changed.collection.numberMatched = changed.collection.features.length
  expect(() => auditStallikonRoad(inputs, batchScope, changed, { ...scope, classifiedSourceSha256: digest(changed) })).toThrow('classified identities changed')
})

it('rejects a broken roundabout ring even if the changed detailed source is deliberately repinned', () => {
  const changed = structuredClone(inputs)
  changed.sources.axes.features.find(f => f.properties.strass_id === 6268).geometry.coordinates[0][0] += 1
  const repinnedBatch = { schemaVersion: 1, hashes: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, digest(v)])) }
  expect(() => auditStallikonRoad(changed, repinnedBatch, source, { ...scope, batchScopeSha256: digest(repinnedBatch) })).toThrow('roundabout ring is not closed')
})

it('rechecks the already matched partner collector instead of trusting archived labels', () => {
  const changed = structuredClone(inputs)
  changed.sources.collectors.find(c => c.uID.id === 'M3287').detectors[0].name = 'Normalspur Richtung Bern'
  const repinnedBatch = { schemaVersion: 1, hashes: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, digest(v)])) }
  expect(() => auditStallikonRoad(changed, repinnedBatch, source, { ...scope, batchScopeSha256: digest(repinnedBatch) })).toThrow('partner collector evidence changed')
})
