import { beforeAll, describe, expect, it } from 'vitest'
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { auditCorridors, buildAudit, compile, loadInputs, orientLabel, reviewJunction, reviewPlan } from './audit-regional-road-directions.mjs'

let inputs
beforeAll(async () => { inputs = await loadInputs() })
const copy = value => structuredClone(value)
const build = values => buildAudit(values.audit, values.geometry, values.counts, values.reviews, values.places, values.basel)
const planFixture = () => {
  const review = inputs.reviews.entries.find(r => r.detectorId === 'zurich-city:Z040M001')
  return [inputs.audit.counters.find(c => c.detectorId === review.detectorId), inputs.geometry.paths.find(p => p.id === review.pathId), inputs.counts.detectors.find(d => d.id === review.detectorId), review].map(copy)
}

describe('regional detector direction evidence', () => {
  it('reproduces the pinned 620-series audit and keeps all corridors held', async () => {
    const result = await compile()
    expect(`${JSON.stringify(result, null, 2)}\n`).toBe(await readFile('data/regional-road-direction-audit.json', 'utf8'))
    expect(result.summary.map(s => s.directionallyResolved)).toEqual([2, 23, 6])
    expect(result.directions).toHaveLength(620)
    expect(result.directions.filter(d => d.directionalVolumeCandidate)).toHaveLength(31)
    expect(result.corridors.every(c => !c.playbackEligible)).toBe(true)
  })

  it('inverts explicit von, while unqualified place labels remain unresolved', () => {
    const point = [2601000, 1200000], points = [[2600000, 1200000], [2610000, 1200000]]
    const places = new Map([['Town', [{ coordinate: [2607000, 1200000], bounds: [2606900, 1199900, 2607100, 1200100] }]]])
    expect(orientLabel('nach Town', point, points, places).direction).toBe('positive')
    expect(orientLabel('von Town', point, points, places).direction).toBe('negative')
    expect(orientLabel('Town', point, points, places).status).toBe('unresolved-description')
    expect(orientLabel('nach Other', point, points, places).status).toBe('unacquired-destination')
  })

  it('does not choose the nearest of homonymous settlements or relax short-axis gates', () => {
    const point = [2601000, 1200000], points = [[2600000, 1200000], [2610000, 1200000]]
    const candidates = [{ coordinate: [2607000, 1200000] }, { coordinate: [2609000, 1200000] }]
    expect(orientLabel('nach Town', point, points, new Map([['Town', candidates]])).status).toBe('ambiguous-destination')
    expect(orientLabel('nach Town', point, points, new Map([['Town', [{ coordinate: [2601100, 1200000] }]]])).status).toBe('destination-too-close')
  })

  it('uses lane-arrow review for Seebahn approach labels', () => {
    const args = planFixture()
    expect(args[0].directionLabel).toBe('Hohlstrasse')
    expect(reviewPlan(...args).direction).toBe('negative')
    args[3].expectedDirection = 'positive'
    expect(() => reviewPlan(...args)).toThrow('bearing conflicts')
  })

  it('rejects changed loop mappings and inconsistent aggregate detector counts', () => {
    const args = planFixture()
    args[2].details.sourceDetectorIds[0] = '20'
    expect(() => reviewPlan(...args)).toThrow('mapping changed')
    const other = planFixture()
    other[2].details.detectorCount = other[3].detectorCount = '3'
    expect(() => reviewPlan(...other)).toThrow('Incomplete source detector mapping')
  })

  it('rejects a disconnected named-road chain and a reversed von review', () => {
    const review = copy(inputs.reviews.entries.find(r => r.relation === 'from'))
    const counter = inputs.audit.counters.find(c => c.detectorId === review.detectorId)
    const path = inputs.geometry.paths.find(p => p.id === review.pathId)
    expect(reviewJunction(counter, path, review, inputs.basel).direction).toBe('negative')
    const roads = copy(inputs.basel)
    roads.find(r => r.id_strasse_weg === 5094).geo_shape.geometry.coordinates[0][0] += .001
    expect(() => reviewJunction(counter, path, review, roads)).toThrow('disconnected')
    review.expectedDirection = 'positive'
    expect(() => reviewJunction(counter, path, review, inputs.basel)).toThrow('direction conflicts')
  })

  it('fails when a reviewed axis becomes ambiguous or its label changes', () => {
    const values = { ...inputs, audit: copy(inputs.audit) }
    const counter = values.audit.counters.find(c => c.detectorId === 'zurich-city:Z040M001')
    counter.match.status = 'ambiguous-axis'
    expect(() => build(values)).toThrow('no longer has an axis candidate')
    counter.match.status = 'axis-candidate'
    counter.directionLabel = 'New label'
    expect(() => build(values)).toThrow('axis or label changed')
  })

  it('does not admit incomplete measurements just because direction is reviewed', () => {
    const values = { ...inputs, audit: copy(inputs.audit) }
    values.audit.counters.find(c => c.detectorId === 'zurich-city:Z040M001').completeMeasuredBothDays = false
    const row = build(values).directions.find(d => d.detectorId === 'zurich-city:Z040M001')
    expect(row.status).toBe('validated')
    expect(row.directionalVolumeCandidate).toBe(false)
  })

  it('rejects source corruption even with an unchanged acquisition manifest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'regional-direction-integrity-'))
    try {
      const files = ['data/regional-road-direction-reviews.json', ...Object.keys(inputs.reviews.pins)]
      for (const file of files) {
        await mkdir(dirname(join(root, file)), { recursive: true })
        await cp(file, join(root, file))
      }
      const directory = 'data/regional-road-direction-sources/2026-09-08'
      await cp(directory, join(root, directory), { recursive: true })
      await writeFile(join(root, directory, 'ZS001-K789-Detektorplan.pdf'), '%PDF-corrupt')
      await expect(loadInputs(root)).rejects.toThrow('Source integrity mismatch')
      await writeFile(join(root, 'data/regional-road-count-audit.json'), '{}')
      await expect(loadInputs(root)).rejects.toThrow('Pinned input changed')
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})

const station = (id, offset, basis = 'reported-total', status = 'axis-candidate') => ['positive', 'negative'].map(direction => ({ detectorId: `${id}:${direction}`, stationId: id, coordinateLv95: [offset, 0], measurementBasis: basis, completeMeasuredBothDays: true, match: { status, best: { pathId: 'road', offsetMetres: offset, distanceMetres: 0 }, candidates: [{ pathId: 'road', offsetMetres: offset, distanceMetres: 0 }] } }))
const resolveCounters = counters => counters.filter(c => c.match.status === 'axis-candidate').map(c => ({ detectorId: c.detectorId, pathId: 'road', status: 'validated', direction: c.detectorId.split(':').at(-1) }))

describe('regional corridor holds', () => {
  it('retains an unresolved intervening station instead of bridging it', () => {
    const counters = [...station('A', 0), ...station('B', 1000, 'reported-total', 'ambiguous-axis'), ...station('C', 2000)]
    const pairs = auditCorridors(counters, resolveCounters(counters))
    expect(pairs.map(p => [p.fromStationId, p.toStationId])).toEqual([['A', 'B'], ['B', 'C']])
    expect(pairs.every(p => p.holdReasons.includes('unresolved-endpoint-or-axis'))).toBe(true)
  })

  it('holds a connected, fully oriented pair until junction movements are reviewed', () => {
    const counters = [...station('A', 0), ...station('B', 2000)]
    const [pair] = auditCorridors(counters, resolveCounters(counters))
    expect(pair.holdReasons).toEqual(['junction-and-turn-movements-unreviewed'])
    expect(pair.playbackEligible).toBe(false)
  })

  it('keeps class sums separate and reports short or excessive counter gaps', () => {
    const counters = [...station('A', 0), ...station('B', 70, 'sum-of-published-classes'), ...station('C', 9000)]
    const pairs = auditCorridors(counters, resolveCounters(counters))
    expect(pairs[0].holdReasons).toEqual(expect.arrayContaining(['different-measurement-bases', 'colocated-counters']))
    expect(pairs[1].holdReasons).toEqual(expect.arrayContaining(['different-measurement-bases', 'counter-gap']))
  })
})
