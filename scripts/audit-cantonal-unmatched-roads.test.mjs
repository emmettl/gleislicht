import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { expect, it } from 'vitest'
import { auditUnmatchedRoads, decodeCompleteRoadSource, loadUnmatchedRoadInputs } from './audit-cantonal-unmatched-roads.mjs'

const inputs = await loadUnmatchedRoadInputs()
const read = file => JSON.parse(readFileSync(file, 'utf8'))
const scope = read('data/cantonal-unmatched-road-scope.json')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const pin = values => ({ schemaVersion: 1, hashes: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, digest(value)])) })

it('triages every unmatched counter and reproduces the committed report without mutations', () => {
  const before = digest(inputs), result = auditUnmatchedRoads(inputs, scope)
  expect(result).toEqual(read('data/cantonal-unmatched-road-audit.json'))
  expect(result.summary).toEqual({ unmatchedStations: 33, completeDetailedAxes: 7427, completeStationPoints: 428, completeCollectorRecords: 369, families: { 'city-road': 2, 'classified-road-ambiguity': 4, 'high-speed-road': 9, 'missing-station': 10, 'municipal-road': 8 } })
  expect(result.stations.map(s => s.id)).toEqual(inputs.geometry.stations.filter(s => s.geometryStatus !== 'matched').map(s => s.id))
  expect(result.stations.every(s => s.publicationStatus === 'not-admitted')).toBe(true)
  expect(result).not.toHaveProperty('topology')
  expect(result).not.toHaveProperty('sections')
  expect(digest(inputs)).toBe(before)
})

it('retains motorway competition and the unchanged 15 m margin for Uster 0288', () => {
  const station = auditUnmatchedRoads(inputs, scope).stations.find(s => s.id === 'ZH.CH:0288')
  expect(station.family).toBe('municipal-road')
  expect(station.evidenceStatus).toBe('competing-axes-require-review')
  expect(station.candidates.slice(0, 2).map(c => c.featureId)).toEqual([2471, 1348])
  expect(station.competingAxisMarginMetres).toBeLessThan(15)
})

it('distinguishes city-road scope from clear municipal leads and missing station identities', () => {
  const stations = auditUnmatchedRoads(inputs, scope).stations
  expect(stations.find(s => s.id === 'ZH.CH:1101')).toMatchObject({ family: 'city-road', originalGeometryStatus: 'off-network', evidenceStatus: 'clear-local-axis-lead' })
  for (const [id, featureId] of [['ZH.CH:2988', 7862], ['ZH.CH:0392', 274], ['ZH.CH:2788', 2165]]) {
    const station = stations.find(s => s.id === id)
    expect(station.family).toBe('municipal-road')
    expect(station.candidates[0].featureId).toBe(featureId)
  }
  expect(stations.find(s => s.id === 'ZH.CH:5887')).toMatchObject({ family: 'missing-station', evidenceStatus: 'station-id-required', candidates: [] })
})

it('rejects changed input hashes including archived coverage and complete source provenance', () => {
  for (const key of Object.keys(inputs)) {
    const changed = { ...inputs, [key]: { ...inputs[key], changed: true } }
    expect(() => auditUnmatchedRoads(changed, scope)).toThrow('audit inputs changed')
  }
})

it('rejects incomplete inventories and duplicate feature identities even after repinning', () => {
  for (const key of ['axes', 'stations']) {
    const changed = structuredClone(inputs)
    changed.sources[key].features.pop()
    expect(() => auditUnmatchedRoads(changed, pin(changed))).toThrow('incomplete WFS response')
  }
  const changed = structuredClone(inputs), collection = changed.sources.axes
  collection.features.push(collection.features[0]); collection.numberMatched++
  expect(() => auditUnmatchedRoads(changed, pin(changed))).toThrow('duplicate identity')
})

it('requires stable station coordinates and collector labels instead of silently moving a counter', () => {
  const moved = structuredClone(inputs)
  moved.sources.stations.features.find(f => f.properties.messst_nr === 1101).geometry.coordinates[0] += 2
  expect(() => auditUnmatchedRoads(moved, pin(moved))).toThrow('Station coordinate changed')
  const renamed = structuredClone(inputs)
  renamed.sources.collectors.find(c => c.uID.id === 'M1101').detectors[0].name = 'Normalspur Richtung Bern'
  expect(() => auditUnmatchedRoads(renamed, pin(renamed))).toThrow('Collector evidence changed')
})

it('checks compressed source contents against the exact downloaded response hash', () => {
  const source = inputs.manifest.sources.stations
  expect(decodeCompleteRoadSource(readFileSync(source.file), source)).toEqual(inputs.sources.stations)
  const altered = gzipSync(JSON.stringify({ ...inputs.sources.stations, changed: true }))
  expect(() => decodeCompleteRoadSource(altered, source)).toThrow('source hash mismatch')
  expect(() => decodeCompleteRoadSource(readFileSync(source.file).subarray(0, 100), source)).toThrow()
})
