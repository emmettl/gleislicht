import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { auditWitikonRoad, connectedRoadFeatures } from './audit-witikon-road.mjs'
import { loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'

const read = file => JSON.parse(readFileSync(file, 'utf8'))
const inputs = await loadUnmatchedRoadInputs()
const batchScope = read('data/cantonal-unmatched-road-scope.json')
const source = read('data/witikon-road-review-sources.json')
const scope = read('data/witikon-road-review-scope.json')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const feature = (id, coordinates) => ({ properties: { strass_id: id }, geometry: { type: 'LineString', coordinates } })

it('reproduces the city connection without converting station coverage into a recording pair', () => {
  const before = digest(inputs)
  const result = auditWitikonRoad(inputs, batchScope, source, scope)
  expect(result).toEqual(read('data/witikon-road-review.json'))
  expect(result.localConnection).toMatchObject({ cityFeatureId: 7870, cantonFeatureId: 2697, stationToConnectionMetres: 71.85 })
  expect(result.namedRoadNetwork).toMatchObject({ sourceFeatureCount: 42, componentFeatureCount: 38 })
  expect(result.relatedCounters).toMatchObject([
    { id: 'ZH.CH:0889', withinReviewedComponentTolerance: false, observations: { completeMinutes: 0, longestRunMinutes: 0 } },
    { id: 'ZH.CH:1101', withinReviewedComponentTolerance: true, observations: { completeMinutes: 245, longestRunMinutes: 245 } },
  ])
  expect(result.recordingReadiness).toBe('no-supported-counter-pair')
  expect(result).not.toHaveProperty('sections')
  expect(result).not.toHaveProperty('topology')
  expect(digest(inputs)).toBe(before)
})

it('traverses endpoint chains independently of feature and vertex order', () => {
  const features = [feature(3, [[2, 0], [3, 0]]), feature(2, [[1, 0], [2, 0]]), feature(1, [[0, 0], [1, 0]])]
  expect(connectedRoadFeatures(features, 1)).toEqual([1, 2, 3])
  const reversed = structuredClone(features).reverse()
  for (const f of reversed) f.geometry.coordinates.reverse()
  expect(connectedRoadFeatures(reversed, 1)).toEqual([1, 2, 3])
  const selected = inputs.sources.axes.features.filter(f => ['30051', '742'].includes(f.properties.stradatnam.trim()))
  expect(connectedRoadFeatures(selected.toReversed(), 7870)).toEqual(read('data/witikon-road-review.json').namedRoadNetwork.componentFeatureIds)
})

it('does not bridge interior crossings or gaps outside the endpoint tolerance', () => {
  const features = [
    feature(1, [[0, 0], [10, 0]]),
    feature(2, [[10.005, 0], [20, 0]]),
    feature(3, [[5, -5], [5, 5]]),
    feature(4, [[5, 0], [5, 10]]),
    feature(5, [[20.011, 0], [30, 0]]),
  ]
  expect(connectedRoadFeatures(features, 1)).toEqual([1, 2])
})

it('rejects a missing seed or duplicate feature identity', () => {
  const f = feature(1, [[0, 0], [1, 0]])
  expect(() => connectedRoadFeatures([f], 2)).toThrow('identities')
  expect(() => connectedRoadFeatures([f, f], 1)).toThrow('identities')
})

it('rejects source drift and an incomplete response even when deliberately repinned', () => {
  const changed = structuredClone(source)
  changed.collection.features.pop()
  expect(() => auditWitikonRoad(inputs, batchScope, changed, scope)).toThrow('review scope changed')
  expect(() => auditWitikonRoad(inputs, batchScope, changed, { ...scope, classifiedSourceSha256: digest(changed) })).toThrow(/empty|incomplete|features/i)
  expect(() => auditWitikonRoad(inputs, { ...batchScope, schemaVersion: 2 }, source, scope)).toThrow('review scope changed')
})

it('rechecks the original classified match if a fresh response moves its endpoint', () => {
  const changed = structuredClone(source)
  changed.collection.features[0].geometry.coordinates[0][0] += 1
  expect(() => auditWitikonRoad(inputs, batchScope, changed, { ...scope, classifiedSourceSha256: digest(changed) })).toThrow('original station match changed')
})
