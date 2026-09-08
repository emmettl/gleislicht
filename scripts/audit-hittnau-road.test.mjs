import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { auditHittnauRoad, hittnauInputFiles } from './audit-hittnau-road.mjs'
import { reviewCantonalDirection } from './review-cantonal-road-direction.mjs'

const read = file => JSON.parse(readFileSync(file, 'utf8'))
const inputs = Object.fromEntries(Object.entries(hittnauInputFiles).map(([key, file]) => [key, read(file)]))
const scope = read('data/hittnau-road-audit-scope.json')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const pin = values => ({ schemaVersion: 1, hashes: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, digest(value)])) })

it('keeps matching public metadata and 104 complete minutes separate from direction approval', () => {
  const before = digest(inputs), result = auditHittnauRoad(inputs, scope)
  expect(result).toEqual(read('data/hittnau-road-review.json'))
  expect(result.status).toBe('review-only-no-publication')
  expect(result.sourceChecks).toMatchObject({ collectorLabelsMatch: true, preciseStationPointMatches: true, stationPlanStatus: 'not-obtained', handbookExampleStationNumber: '0124' })
  expect(result.observations).toMatchObject({ distanceMetres: 2479.21, completeMinutes: 227, longestRunMinutes: 104 })
  expect(result.qualifiedZhDiagnostic.detectors[1]).toMatchObject({ status: 'destination-too-close', destinationDistanceMetres: 1401.93 })
  expect(result.destinationAlternatives[0].alternatives.map(a => a.destination.name)).toEqual(['Pfäffikon SZ', 'Pfäffikon ZH'])
  expect(result.opposingLaneReview.status).toBe('rejected')
  expect(result).not.toHaveProperty('topology')
  expect(result).not.toHaveProperty('sections')
  expect(digest(inputs)).toBe(before)
})

it('rejects changes to every pinned input', () => {
  for (const key of Object.keys(inputs)) {
    const changed = structuredClone(inputs)
    changed[key].changed = true
    expect(() => auditHittnauRoad(changed, scope)).toThrow('audit inputs changed')
  }
})

it('rejects a different station, point, coordinate system or newly exposed fields even after repinning', () => {
  const changes = [
    s => { s.station.collection.features[0].properties.messst_nr = 2992 },
    s => { s.station.collection.features[0].geometry.coordinates[0] += 10 },
    s => { s.station.collection.crs.properties.name = 'EPSG:4326' },
    s => { s.station.collection.features[0].properties.azimuth = 45 },
    s => { s.station.collection.features.push(s.station.collection.features[0]) },
  ]
  for (const change of changes) {
    const changed = structuredClone(inputs)
    change(changed.sources)
    expect(() => auditHittnauRoad(changed, pin(changed))).toThrow(/station (point|source)|metadata fields/)
  }
})

it('requires fresh review when collector labels or station-plan evidence changes', () => {
  const changed = structuredClone(inputs)
  changed.sources.collectors.records[1].detectors[0].name = 'Normalspur Richtung Zürich'
  expect(() => auditHittnauRoad(changed, pin(changed))).toThrow('detector labels changed')
  const plan = structuredClone(inputs)
  plan.sources.stationPlan.status = 'obtained'
  expect(() => auditHittnauRoad(plan, pin(plan))).toThrow('Station-plan evidence requires a new review')
})

it('cannot bypass the distance gate by relabelling the failure as an extent conflict', () => {
  const station = inputs.geometry.stations.find(s => s.id === 'ZH.CH:3091')
  const detectors = structuredClone(inputs.oberland.stationReports.find(s => s.id === station.id).qualifiedZhDiagnostic.detectors)
  detectors[1].status = 'destination-extent-conflict'
  expect(() => reviewCantonalDirection(station, detectors, new Map(inputs.catalog.detectors.map(d => [d.id, d])), {
    stationId: station.id, pathId: station.match.pathId, road: station.match.road,
    detectorAuditSha256: digest(detectors), method: 'opposing-main-carriageway-lanes',
    anchorDetectorId: detectors[0].id, reviewedDetectorId: detectors[1].id,
  })).toThrow('conflicts with road geometry')
})
