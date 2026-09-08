import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildDirectionTopology } from './validate-cantonal-road-directions.mjs'
import { reviewCantonalDirection } from './review-cantonal-road-direction.mjs'
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const geometry = read('public/data/zurich-cantonal-road-topology.json')
const catalog = read('data/zurich-cantonal-road-counters.json')
const baseline = read('data/zurich-cantonal-road-directions.json')
const reviews = read('data/zurich-cantonal-road-direction-reviews.json')
describe('pinned opposing-lane direction review', () => {
  it('adds the reviewed corridor while retaining the original automatic results and Horgen', () => {
    const automatic = buildDirectionTopology(geometry, catalog, baseline.places)
    expect(automatic.sections).toHaveLength(2)
    const reviewed = buildDirectionTopology(geometry, catalog, baseline.places, reviews.entries)
    expect(reviewed.sections.filter(s => s.road === 'ZH:3')).toEqual(automatic.sections)
    expect(reviewed.sections.filter(s => s.road === 'ZH:1')).toHaveLength(2)
    const detector = reviewed.stationAudit.find(s => s.id === 'ZH.CH:0088').detectors[0]
    expect(detector).toMatchObject({ direction: 'negative', originalStatus: 'destination-extent-conflict', review: { anchorDetectorId: 'ZH.CH:0088.02' } })
  })
  it('fails closed on changed evidence, missing anchor or changed carriageway', () => {
    const station = geometry.stations.find(s => s.id === 'ZH.CH:0088')
    const audit = structuredClone(baseline.stationAudit.find(s => s.id === station.id).detectors)
    const records = new Map(catalog.detectors.map(d => [d.id, d]))
    const review = reviews.entries[0]
    audit[0].description = 'Normalspur Richtung Something else'
    expect(() => reviewCantonalDirection(station, audit, records, review)).toThrow('evidence has changed')
    audit[1].status = 'bearing-conflict'
    const rehashed = { ...review, detectorAuditSha256: createHash('sha256').update(JSON.stringify(audit)).digest('hex') }
    expect(() => reviewCantonalDirection(station, audit, records, rehashed)).toThrow('validated anchor')
    const original = baseline.stationAudit.find(s => s.id === station.id).detectors
    records.set(review.reviewedDetectorId, { ...records.get(review.reviewedDetectorId), carriageway: 'entrySlipRoad' })
    expect(() => reviewCantonalDirection(station, original, records, review)).toThrow('validated anchor')
  })
})
