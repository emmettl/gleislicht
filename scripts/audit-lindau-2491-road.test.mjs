import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { auditLindau2491Road, sharedInteriorVertices } from './audit-lindau-2491-road.mjs'
import { loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'
import { connectedRoadFeatures } from './audit-witikon-road.mjs'

const read = file => JSON.parse(readFileSync(file, 'utf8'))
const inputs = await loadUnmatchedRoadInputs()
const batchScope = read('data/cantonal-unmatched-road-scope.json')
const sources = read('data/lindau-2491-road-review-sources.json')
const scope = read('data/lindau-2491-road-review-scope.json')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

it('reproduces both carriageway crossings without turning shared XY vertices into junctions', () => {
  const before = digest(inputs)
  const report = auditLindau2491Road(inputs, batchScope, sources, scope)
  expect(report).toEqual(read('data/lindau-2491-road-review.json'))
  expect(report.originalGeometryStatus).toBe('ambiguous-road')
  expect(report.axes.map(a => a.featureId)).toEqual([2634, 623, 614])
  expect(report.crossings).toMatchObject([{ motorwayFeatureId: 623, stationDistanceMetres: 17.94 }, { motorwayFeatureId: 614, stationDistanceMetres: 38.05 }])
  const features = inputs.sources.axes.features.filter(f => [2634, 623, 614].includes(f.properties.strass_id))
  expect(connectedRoadFeatures(features, 2634)).toEqual([2634])
  expect(report).not.toHaveProperty('topology')
  expect(report).not.toHaveProperty('sections')
  expect(inputs.geometry.stations.find(s => s.id === report.stationId).match).toBeNull()
  expect(digest(inputs)).toBe(before)
})

it('retains the automatic ambiguity and independently tests every Lindau alternative', () => {
  const report = auditLindau2491Road(inputs, batchScope, sources, scope)
  expect(report.conditionalDirectionCheck.detectors).toMatchObject([
    { id: 'ZH.CH:2491.01', status: 'ambiguous-destination' },
    { id: 'ZH.CH:2491.02', status: 'destination-too-close', destinationDistanceMetres: 1000.69 },
  ])
  for (const check of report.lindauAlternatives) {
    expect(check.status).toBe('individual-alternatives-diagnostic-no-name-selected')
    expect(check.alternatives.map(a => a.destination.sourceFeatureId)).toEqual([272265, 416642, 88405, 143694])
    expect(check.alternatives.map(a => a.status)).toEqual(['destination-too-close', 'destination-off-axis', 'destination-off-axis', 'destination-off-axis'])
    expect(check.alternatives.every(a => !a.direction)).toBe(true)
  }
  expect(report.lindauAlternatives.map(c => c.alternatives[0].destinationDistanceMetres)).toEqual([1199.45, 928.34])
})

it('keeps both observation windows unapproved and retains every partner direction failure', () => {
  const { candidatePairs: pairs } = auditLindau2491Road(inputs, batchScope, sources, scope)
  expect(pairs.map(p => p.longestRunMinutes)).toEqual([104, 104])
  expect(pairs.every(p => p.publicationStatus === 'not-admitted' && p.hourWindows.length === 1 && p.hourWindows[0].start === 51240 && p.hourWindows[0].end === 57420)).toBe(true)
  expect(pairs[0].otherEndpoint.detectors.map(d => d.status)).toEqual(['destination-too-close', 'ambiguous-destination'])
  expect(pairs[1].otherEndpoint.detectors.map(d => d.status)).toEqual(['destination-too-close', 'destination-extent-conflict'])
})

it('distinguishes shared interior points from endpoint contacts and nearby vertices', () => {
  const a = [[0, 0], [5, 0], [5, 0], [10, 0]]
  const b = [[5, -5], [5, 0], [5, 5]]
  expect(sharedInteriorVertices(a, b)).toEqual([[5, 0]])
  expect(sharedInteriorVertices(a.toReversed(), b.toReversed())).toEqual([[5, 0]])
  expect(sharedInteriorVertices(a, [[5, 0], [5, 5], [5, 10]])).toEqual([])
  expect(sharedInteriorVertices(a, [[5, -5], [5, 0.02], [5, 5]])).toEqual([])
})

it('rejects changed source scope, incomplete roads and saturated name searches', () => {
  const changed = structuredClone(sources)
  changed.classified.collection.features.pop()
  expect(() => auditLindau2491Road(inputs, batchScope, changed, scope)).toThrow('review scope changed')
  expect(() => auditLindau2491Road(inputs, batchScope, changed, { ...scope, sourcesSha256: digest(changed) })).toThrow('incomplete WFS response')
  const saturated = structuredClone(sources)
  saturated.names.response.results = Array(200).fill(sources.names.response.results[0])
  expect(() => auditLindau2491Road(inputs, batchScope, saturated, { ...scope, sourcesSha256: digest(saturated) })).toThrow('saturated Lindau names response')
})

it('rejects deleting a settlement alternative or changing an already matched partner collector', () => {
  const changedNames = structuredClone(sources)
  changedNames.names.response.results = changedNames.names.response.results.filter(f => f.featureId !== 272265)
  expect(() => auditLindau2491Road(inputs, batchScope, changedNames, { ...scope, sourcesSha256: digest(changedNames) })).toThrow('settlement alternatives changed')
  const changed = structuredClone(inputs)
  changed.sources.collectors.find(c => c.uID.id === 'M1320').detectors[0].name = 'Normalspur Richtung Bern'
  const repinnedBatch = { schemaVersion: 1, hashes: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, digest(v)])) }
  expect(() => auditLindau2491Road(changed, repinnedBatch, sources, { ...scope, batchScopeSha256: digest(repinnedBatch) })).toThrow('neighbour collector evidence changed')
})
