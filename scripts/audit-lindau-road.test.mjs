import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { auditLindauRoad } from './audit-lindau-road.mjs'
import { reviewCantonalDirection } from './review-cantonal-road-direction.mjs'
const read = file => JSON.parse(readFileSync(file, 'utf8'))
const geometry = read('public/data/zurich-cantonal-road-topology.json')
const catalog = read('data/zurich-cantonal-road-counters.json')
const directions = read('data/zurich-cantonal-road-directions.json')
const coverage = read('data/zurich-cantonal-road-coverage-audit.json')
const sources = read('data/lindau-road-review-sources.json')
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
describe('Lindau evidence review', () => {
  it('keeps complete observations separate from unresolved travel directions', () => {
    const result = auditLindauRoad(geometry, catalog, directions, coverage, sources)
    expect(result.publicationStatus).toBe('direction-unresolved')
    expect(result.observations).toMatchObject({ completeMinutes: 245, longestRunMinutes: 245, distanceMetres: 2232.15 })
    expect(result.automaticDetectors.map(d => d.status)).toEqual(['bearing-conflict', 'bearing-conflict'])
    expect(result.detailedGeometry.directions.map(d => Math.abs(d.bearingAgreement))).toEqual([0.63, 0.23])
    const station = geometry.stations.find(s => s.id === result.stationId)
    expect(() => reviewCantonalDirection(station, result.automaticDetectors, new Map(catalog.detectors.map(d => [d.id, d])), {
      stationId: station.id, pathId: station.match.pathId, road: station.match.road,
      detectorAuditSha256: sha(result.automaticDetectors), method: 'opposing-main-carriageway-lanes',
      anchorDetectorId: 'ZH.CH:0908.02', reviewedDetectorId: 'ZH.CH:0908.01',
    })).toThrow('validated anchor')
  })
  it('rejects changed source contents and detector labels', () => {
    const changed = structuredClone(sources)
    changed.collector.record.detectors[0].name = 'Normalspur Richtung Bern'
    expect(() => auditLindauRoad(geometry, catalog, directions, coverage, changed)).toThrow('hash mismatch')
    changed.collector.recordSha256 = sha(changed.collector.record)
    expect(() => auditLindauRoad(geometry, catalog, directions, coverage, changed)).toThrow('descriptions changed')
  })
})
