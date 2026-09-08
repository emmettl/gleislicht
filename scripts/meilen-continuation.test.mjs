import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildMeilenDirections } from './build-meilen-staefa-directions.mjs'
const read = file => JSON.parse(readFileSync(file, 'utf8'))
const geometry = read('public/data/zurich-cantonal-road-topology.json')
const catalog = read('data/zurich-cantonal-road-counters.json')
const baseline = read('data/zurich-cantonal-road-directions.json')
const sources = read('data/lakeside-road-review-sources.json')
const review = read('data/meilen-staefa-axis-continuation.json')
const build = (r = review, s = sources) => buildMeilenDirections(geometry, catalog, baseline, s, r)
const rehash = r => { r.collectionSha256 = createHash('sha256').update(JSON.stringify(r.collection)).digest('hex'); return r }
describe('official Rapperswil road continuation', () => {
  it('validates only the two reviewed counters without extending playback geometry', () => {
    const result = build()
    expect(result.paths).toEqual(geometry.paths)
    expect(result.sections).toHaveLength(4)
    for (const section of baseline.sections) expect(result.sections).toContainEqual(section)
    for (const id of ['ZH.CH:0591', 'ZH.CH:1091']) {
      const station = result.stationAudit.find(s => s.id === id)
      expect(station.detectors[1]).toMatchObject({ status: 'validated', direction: 'positive', destinationRoadDistanceMetres: 85.38, review: { originalStatus: 'unresolved-destination' } })
    }
    expect(result.stationAudit.find(s => s.id === 'ZH.CH:0491').status).toBe('unresolved-direction-pair')
    expect(result.metadata.directionContinuation.joinMetres).toBeLessThan(0.4)
    expect(result.sections.filter(s => s.road === 'ZH:17').map(s => s.distanceKm)).toEqual([4.09736,4.09736])
  })
  it('rejects changed geometry, detached joins, source identity and review scope', () => {
    const changed = structuredClone(review)
    changed.collection.features[0].geometry.coordinates[0].at(-1)[0] += 20
    expect(() => build(changed)).toThrow('evidence changed')
    expect(() => build(rehash(changed))).toThrow('does not join')
    expect(() => build({ ...review, reverse: false })).toThrow('Ambiguous')
    expect(() => build({ ...review, selectedFeatureId: 'Kantonsstrassen.163' })).toThrow('Ambiguous')
    expect(() => build({ ...review, stations: [review.stations[0], review.stations[0]] })).toThrow('Unexpected reviewed station')
  })
  it('requires both exact settlement alternatives and pinned station evidence', () => {
    const missing = structuredClone(sources); missing.destinations.pop()
    expect(() => build(review, missing)).toThrow('alternatives')
    const changed = structuredClone(review); changed.stations[0].detectorAuditSha256 = 'stale'
    expect(() => build(changed)).toThrow('station evidence changed')
  })
})
