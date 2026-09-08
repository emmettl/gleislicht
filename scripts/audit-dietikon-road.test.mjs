import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { auditDietikonRoad } from './audit-dietikon-road.mjs'
import { auditUnmatchedRoads, loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'
import { reviewCantonalDirection } from './review-cantonal-road-direction.mjs'

const read = file => JSON.parse(readFileSync(file, 'utf8'))
const inputs = await loadUnmatchedRoadInputs()
const batchScope = read('data/cantonal-unmatched-road-scope.json')
const source = read('data/dietikon-road-review-sources.json')
const scope = read('data/dietikon-road-review-scope.json')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const pinBatch = values => ({ schemaVersion: 1, hashes: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, digest(value)])) })

it('retains both axes, all four detectors and the independent Oetwil failures', () => {
  const before = digest(inputs), result = auditDietikonRoad(inputs, batchScope, source, scope)
  expect(result).toEqual(read('data/dietikon-road-review.json'))
  expect(result.axes.map(a => a.road)).toEqual(['618', '618.1'])
  expect(result.axes.map(a => a.distanceMetres)).toEqual([3.99, 4.6])
  expect(result.detectorGroups.map(g => g.detectors.length)).toEqual([2, 2])
  expect(result.bindingStatus).toBe('detector-to-axis-mapping-not-established')
  expect(result.observations).toMatchObject({ completeMinutes: 245, longestRunMinutes: 245, distanceMetres: 1793.79 })
  expect(result.otherEndpoint.detectors.map(d => d.status)).toEqual(['destination-off-axis', 'destination-too-close'])
  expect(result.otherEndpoint.detectors[1].destinationDistanceMetres).toBe(678.63)
  expect(result.detectorGroups.every(g => g.detectors.every(d => d.coordinate === null && d.alertCDirection === null))).toBe(true)
  expect(result).not.toHaveProperty('sections')
  expect(result).not.toHaveProperty('topology')
  expect(digest(inputs)).toBe(before)
})

it('shows both endpoint blockers alongside each diagnostic pair in the batch queue', () => {
  const report = auditUnmatchedRoads(inputs, batchScope)
  const pair = report.stations.find(s => s.id === 'ZH.CH:1921').archivedCandidatePairs[0]
  expect(pair.endpointBlockers).toMatchObject([
    { id: 'ZH.CH:1921', status: 'unmatched-geometry', detectors: [] },
    { id: 'ZH.CH:0214', status: 'unresolved-direction-pair', detectors: [{ status: 'destination-off-axis' }, { status: 'destination-too-close' }] },
  ])
  expect(report.stations.flatMap(s => s.archivedCandidatePairs).every(p => p.endpointBlockers.length === 2)).toBe(true)
})

it('rejects stale endpoint direction audits even when hashes are updated', () => {
  const changed = structuredClone(inputs)
  changed.directions.stationAudit.find(s => s.id === 'ZH.CH:0214').status = 'validated'
  expect(() => auditUnmatchedRoads(changed, pinBatch(changed))).toThrow('direction baseline changed')
})

it('requires unchanged classified geometry as well as source and batch hashes', () => {
  const changed = structuredClone(source)
  changed.collection.features[0].geometry.coordinates[0][0] += 1
  expect(() => auditDietikonRoad(inputs, batchScope, changed, scope)).toThrow('review scope changed')
  expect(() => auditDietikonRoad(inputs, batchScope, changed, { ...scope, classifiedSourceSha256: digest(changed) })).toThrow('classified paths changed')
})

it('does not extend the two-normal-lane review method to a four-detector station', () => {
  const station = { id: 'ZH.CH:1921', match: { road: 'ZH:618', pathId: 'test-only-axis' } }
  const detectors = inputs.geometry.stations.find(s => s.id === station.id).detectorDescriptions
  expect(() => reviewCantonalDirection(station, detectors, new Map(inputs.catalog.detectors.map(d => [d.id, d])), { stationId: station.id, road: station.match.road, pathId: station.match.pathId, method: 'opposing-main-carriageway-lanes', detectorAuditSha256: digest(detectors) })).toThrow('Unsupported direction review')
})
