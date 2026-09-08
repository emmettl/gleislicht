import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { buildBaumaWilaDirections } from './build-bauma-wila-directions.mjs'
import { buildDirectionTopology } from './validate-cantonal-road-directions.mjs'
const files = ['public/data/zurich-cantonal-road-topology.json', 'data/zurich-cantonal-road-counters.json', 'data/zurich-cantonal-road-directions.json', 'data/bauma-wila-review-sources.json', 'data/bauma-wila-direction-scope.json', 'data/bauma-wald-settlement-inventory.json']
const inputs = files.map(f => JSON.parse(readFileSync(f, 'utf8')))
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const rehash = values => {
  for (const s of values[3].destinations) s.sha256 = digest(s.response)
  values[4].sourcesSha256 = digest(values[3])
  values[4].inventorySha256 = digest(values[5])
  return values
}

it('preserves both homonyms and admits only the reviewed Bauma–Wila pair', () => {
  const { topology, destinationReviews, junctions, excludedReview } = buildBaumaWilaDirections(...inputs)
  expect(topology.paths).toEqual(inputs[0].paths)
  for (const section of inputs[2].sections) expect(topology.sections).toContainEqual(section)
  expect(topology.sections.filter(s => s.road === 'ZH:15').map(s => s.distanceKm)).toEqual([4.82204, 4.82204])
  for (const review of destinationReviews) {
    expect(review.qualifiedRegionalStatus).toBe('ambiguous-destination')
    expect(review.alternatives).toHaveLength(25)
    expect(review.alternatives.find(a => a.destination.name === 'Wald AR').status).toBe('destination-off-axis')
    expect(review.alternatives.find(a => a.destination.name === 'Wald ZH')).toMatchObject({ status: 'validated', direction: 'negative', destinationRoadDistanceMetres: 210.79 })
    expect(topology.stationAudit.find(s => s.id === review.stationId).detectors[0].direction).toBe('positive')
  }
  expect(junctions.map(j => [j.offsetMetres, j.axes])).toEqual([[1917, ['806']], [2600, ['337']]])
  expect(excludedReview).toMatchObject({ stationId: 'ZH.CH:2891', status: 'not-admitted', qualifiedDestinationResult: { status: 'bearing-conflict', bearingAgreement: -0.74 } })
  expect(topology.stationAudit.find(s => s.id === 'ZH.CH:2891').status).toBe('unresolved-direction-pair')
  expect(destinationReviews[0].alternatives.find(a => a.destination.name === 'Wald' && a.status === 'validated')).toMatchObject({ direction: 'positive', reviewExclusion: expect.stringContaining('opposing normal lanes') })
})

it('rejects stale sources, station evidence and a broader station scope', () => {
  const changed = structuredClone(inputs)
  changed[3].unexpected = true
  expect(() => buildBaumaWilaDirections(...changed)).toThrow('review inputs changed')
  const stale = structuredClone(inputs)
  stale[4].stations[0].detectorAuditSha256 = 'stale'
  expect(() => buildBaumaWilaDirections(...stale)).toThrow('station evidence changed')
  stale[4].stations[0] = { id: 'ZH.CH:2891' }
  expect(() => buildBaumaWilaDirections(...stale)).toThrow('review scope')
})

it('does not admit a homonym when both alternatives fit the road', () => {
  const changed = structuredClone(inputs)
  const ar = changed[3].destinations.find(s => s.name === 'Wald AR')
  const zh = changed[3].destinations.find(s => s.name === 'Wald ZH')
  const bounds = zh.response.results.find(r => r.properties.objektklasse === 'TLM_SIEDLUNGSNAME').bbox
  for (const feature of ar.response.results) if (feature.properties.objektklasse === 'TLM_SIEDLUNGSNAME') feature.bbox = bounds
  const arRow = changed[5].rows.find(r => r.NAME === 'Wald AR'), zhRow = changed[5].rows.find(r => r.NAME === 'Wald ZH')
  arRow.E = zhRow.E; arRow.N = zhRow.N
  expect(() => buildBaumaWilaDirections(...rehash(changed))).toThrow('not uniquely supported')
})

it('rejects missing alternatives and incomplete or cropped junction extracts after rehashing', () => {
  const missing = structuredClone(inputs)
  missing[3].destinations.shift()
  expect(() => buildBaumaWilaDirections(...rehash(missing))).toThrow('All Wald searches')
  const partial = structuredClone(inputs)
  partial[3].junctions.collection.features.pop()
  expect(() => buildBaumaWilaDirections(...rehash(partial))).toThrow('incomplete WFS response')
  const cropped = structuredClone(inputs)
  cropped[3].junctions.url = cropped[3].junctions.url.replace('2706400,1247300,2708200,1252300', '2706400,1250000,2708200,1252300')
  expect(() => buildBaumaWilaDirections(...rehash(cropped))).toThrow('does not cover')
})

it('rejects an omitted small Wald settlement despite a rehashed broad response', () => {
  const changed = structuredClone(inputs)
  const source = changed[3].destinations.find(s => s.name === 'Wald')
  const bounds = source.response.results.find(r => r.properties.objektklasse === 'TLM_SIEDLUNGSNAME').bbox.join(':')
  source.response.results = source.response.results.filter(r => r.bbox.join(':') !== bounds)
  expect(() => buildBaumaWilaDirections(...rehash(changed))).toThrow('inventory coverage changed')
})

it('requires independent opposing-lane evidence to exclude the passing same-direction hamlet', () => {
  const changed = structuredClone(inputs)
  changed[1].detectors.find(d => d.id === 'ZH.CH:3588.02').direction = null
  changed[4].catalogSha256 = digest(changed[1])
  const baseline = buildDirectionTopology(changed[0], changed[1], changed[2].places)
  for (const station of changed[4].stations) station.detectorAuditSha256 = digest(baseline.stationAudit.find(s => s.id === station.id).detectors)
  expect(() => buildBaumaWilaDirections(...changed)).toThrow('not uniquely supported')
})
