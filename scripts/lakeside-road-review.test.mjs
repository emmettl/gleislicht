import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildDirectionTopology } from './validate-cantonal-road-directions.mjs'
import { reviewMeilenDestinations } from './audit-meilen-staefa-directions.mjs'
const read = file => JSON.parse(readFileSync(file, 'utf8'))
const geometry = read('public/data/zurich-cantonal-road-topology.json')
const baseline = read('data/zurich-cantonal-road-directions.json')
const catalog = read('data/zurich-cantonal-road-counters.json')
const reviews = read('data/kilchberg-thalwil-direction-reviews.json')
describe('lakeside direction review', () => {
  it('adds only the reviewed Kilchberg–Thalwil directions and preserves Horgen', () => {
    const result = buildDirectionTopology(geometry, catalog, baseline.places, reviews.entries)
    expect(result.sections).toHaveLength(4)
    for (const section of baseline.sections) expect(result.sections).toContainEqual(section)
    for (const id of ['ZH.CH:0109', 'ZH.CH:4190']) {
      expect(result.stationAudit.find(s => s.id === id).detectors[0]).toMatchObject({ status: 'validated', originalStatus: 'destination-extent-conflict', direction: 'negative' })
    }
    expect(result.sections.filter(s => s.fromSiteId.includes('0109') || s.toSiteId.includes('0109')).every(s => s.distanceKm === 4.80281)).toBe(true)
    const changed = structuredClone(reviews.entries); changed[0].anchorDetectorId = 'ZH.CH:0109.01'
    expect(() => buildDirectionTopology(geometry, catalog, baseline.places, changed)).toThrow('validated anchor')
  })
  it('resolves Rapperswil names without concealing the remaining geometry failure', () => {
    const sources = read('data/lakeside-road-review-sources.json')
    const result = reviewMeilenDestinations(geometry, sources)
    expect(result.map(d => d.status)).toEqual(['destination-off-axis', 'destination-off-axis'])
    expect(result.every(d => d.destination.name === 'Rapperswil SG' && d.destinationRoadDistanceMetres === 2522.39)).toBe(true)
    sources.destinations[0].response.results.pop()
    expect(() => reviewMeilenDestinations(geometry, sources)).toThrow('source changed')
  })
})
