import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { auditHenggartRoad } from './audit-henggart-road.mjs'
import { loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'

const read = file => JSON.parse(readFileSync(file, 'utf8'))
const inputs = await loadUnmatchedRoadInputs()
const batchScope = read('data/cantonal-unmatched-road-scope.json')
const source = read('data/henggart-road-review-sources.json')
const scope = read('data/henggart-road-review-scope.json')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

it('reproduces the report while retaining the A4 competitor and original unmatched station', () => {
  const before = digest(inputs)
  const report = auditHenggartRoad(inputs, batchScope, source, scope)
  expect(report).toEqual(read('data/henggart-road-review.json'))
  expect(report.originalGeometryStatus).toBe('ambiguous-road')
  expect(report.originalCandidates).toMatchObject([{ road: 'ZH:15', eligible: true }, { road: 'ZH:A4', distanceMetres: 14.54, eligible: false }])
  expect(report.axes.map(a => a.featureId)).toEqual([3117, 6531])
  expect(report.storedTangentAgreement).toBe(-1)
  expect(report.bindingStatus).toBe('independent-station-to-road-binding-required')
  expect(report).not.toHaveProperty('topology')
  expect(report).not.toHaveProperty('sections')
  expect(inputs.geometry.stations.find(s => s.id === report.stationId).match).toBeNull()
  expect(digest(inputs)).toBe(before)
})

it('exposes direction failures hidden by the geometry exclusion without approving either detector', () => {
  const report = auditHenggartRoad(inputs, batchScope, source, scope)
  expect(report.conditionalDirectionCheck.status).toBe('diagnostic-only-assuming-ZH-15')
  expect(report.conditionalDirectionCheck.detectors).toMatchObject([
    { id: 'ZH.CH:1997.01', status: 'bearing-conflict', bearingAgreement: -0.56, bearingGatePasses: false },
    { id: 'ZH.CH:1997.02', status: 'destination-off-axis', destinationRoadDistanceMetres: 1652.2, bearingAgreement: 0.7, bearingGatePasses: false },
  ])
  expect(report.conditionalDirectionCheck.detectors.every(d => !d.direction)).toBe(true)
})

it('retains both other endpoints and distinguishes a complete window from a disabled neighbour', () => {
  const { candidatePairs: pairs } = auditHenggartRoad(inputs, batchScope, source, scope)
  expect(pairs).toMatchObject([
    { from: 'ZH.CH:4789', to: 'ZH.CH:1997', completeMinutes: 225, longestRunMinutes: 104, hourWindows: [{ start: 51240, end: 57420, minutes: 104 }], publicationStatus: 'not-admitted' },
    { from: 'ZH.CH:1997', to: 'ZH.CH:1900', completeMinutes: 0, longestRunMinutes: 0, hourWindows: [], publicationStatus: 'not-admitted', otherEndpoint: { collectorStatus: 'DISABLED' } },
  ])
  expect(pairs[0].otherEndpoint.directionAudit.detectors.map(d => d.status)).toEqual(['destination-off-axis', 'destination-off-axis'])
  expect(pairs[1].otherEndpoint.detectorIssueMinutes).toEqual({ 'ZH.CH:1900.01': { 'missing-detector': 245 }, 'ZH.CH:1900.02': { 'missing-detector': 245 } })
})

it('rejects changed evidence and incomplete responses even with a new source hash', () => {
  const changed = structuredClone(source)
  changed.collection.features.pop()
  expect(() => auditHenggartRoad(inputs, batchScope, changed, scope)).toThrow('review scope changed')
  expect(() => auditHenggartRoad(inputs, batchScope, changed, { ...scope, classifiedSourceSha256: digest(changed) })).toThrow('incomplete WFS response')
})

it('cannot silently discard the motorway or shift a classified path', () => {
  const changed = structuredClone(source)
  changed.collection.features.pop()
  changed.collection.numberMatched = changed.collection.features.length
  expect(() => auditHenggartRoad(inputs, batchScope, changed, { ...scope, classifiedSourceSha256: digest(changed) })).toThrow('classified identities changed')
  const shifted = structuredClone(source)
  shifted.collection.features[0].geometry.coordinates[0][0] += 1
  expect(() => auditHenggartRoad(inputs, batchScope, shifted, { ...scope, classifiedSourceSha256: digest(shifted) })).toThrow('original classified match or paths changed')
})

it('rechecks neighbouring collector labels even though those stations already matched geometry', () => {
  const changed = structuredClone(inputs)
  changed.sources.collectors.find(c => c.uID.id === 'M4789').detectors[0].name = 'Normalspur Richtung Bern'
  const repinnedBatch = { schemaVersion: 1, hashes: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, digest(v)])) }
  expect(() => auditHenggartRoad(changed, repinnedBatch, source, { ...scope, batchScopeSha256: digest(repinnedBatch) })).toThrow('neighbour collector evidence changed')
})
