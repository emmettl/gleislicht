import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { auditOberlandRoadCandidates } from './audit-oberland-road-candidates.mjs'
const read = file => JSON.parse(readFileSync(file, 'utf8'))
const inputs = Object.fromEntries(Object.entries({ geometry: 'public/data/zurich-cantonal-road-topology.json', catalog: 'data/zurich-cantonal-road-counters.json', baseline: 'data/zurich-cantonal-road-directions.json', coverage: 'data/zurich-cantonal-road-coverage-audit.json', sources: 'data/oberland-road-review-sources.json', inventory: 'data/oberland-road-settlement-inventory.json' }).map(([key, file]) => [key, read(file)]))
const scope = read('data/oberland-road-audit-scope.json')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const pin = values => ({ schemaVersion: 1, hashes: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, digest(value)])) })

it('keeps all 14 well-recorded counter pairs excluded after the optimistic name diagnostic', () => {
  const before = digest(inputs)
  const result = auditOberlandRoadCandidates(inputs, scope)
  expect(result.summary).toEqual({ settlementCandidates: 6, stations: 21, candidatePairs: 14, pairsStillRequiringEvidence: 14 })
  expect(result.status).toBe('review-only-no-publication')
  expect(result.candidatePairs.every(p => p.publicationStatus === 'not-admitted')).toBe(true)
  expect(result).not.toHaveProperty('topology')
  expect(result).not.toHaveProperty('sections')
  expect(digest(inputs)).toBe(before)
})

it('does not let an applicable opposing-lane review bypass a blocked neighbouring counter', () => {
  const result = auditOberlandRoadCandidates(inputs, scope)
  const uster = result.stationReports.find(s => s.id === 'ZH.CH:0188')
  expect(uster.existingOpposingLaneMethodCouldApply).toBe(true)
  expect(result.candidatePairs.find(p => p.from === 'ZH.CH:0188' && p.to === 'ZH.CH:2988')).toMatchObject({ longestRunMinutes: 245, furtherEvidenceRequired: true })
  expect(result.stationReports.find(s => s.id === 'ZH.CH:2988').qualifiedZhDiagnostic.status).toBe('unmatched-geometry')
})

it('retains homonyms, short-destination failures and the absence of an extent-review anchor', () => {
  const result = auditOberlandRoadCandidates(inputs, scope)
  const pf = result.stationReports.find(s => s.id === 'ZH.CH:0295')
  expect(pf.aliases[0].regionalResult.status).toBe('ambiguous-destination')
  expect(pf.aliases[0].alternatives.map(a => a.destination.name)).toEqual(['Pfäffikon SZ', 'Pfäffikon ZH'])
  expect(pf.qualifiedZhDiagnostic.detectors[1]).toMatchObject({ status: 'destination-too-close', destinationDistanceMetres: 647.49 })
  expect(result.stationReports.find(s => s.id === 'ZH.CH:4586').existingOpposingLaneMethodCouldApply).toBe(false)
  expect(result.stationReports.find(s => s.id === 'ZH.CH:2992').qualifiedZhDiagnostic.status).toBe('validated')
  expect(result.candidatePairs.find(p => p.from === 'ZH.CH:2992').furtherEvidenceRequired).toBe(true)
})

it('rejects drift in any pinned dataset including observation coverage', () => {
  for (const key of Object.keys(inputs)) {
    const changed = structuredClone(inputs)
    changed[key].changed = true
    expect(() => auditOberlandRoadCandidates(changed, scope)).toThrow('audit inputs changed')
  }
})

it('rejects missing settlement alternatives and broken inventory crosswalks even if repinned', () => {
  const missing = structuredClone(inputs)
  missing.sources.destinations.pop()
  expect(() => auditOberlandRoadCandidates(missing, pin(missing))).toThrow('All six settlement searches')
  const broken = structuredClone(inputs)
  broken.inventory.rows[0].E = '0'
  expect(() => auditOberlandRoadCandidates(broken, pin(broken))).toThrow('crosswalk is not one-to-one')
})

it('rejects stale baseline audits and saturated settlement responses', () => {
  const stale = structuredClone(inputs)
  stale.baseline.stationAudit[0].status = 'validated'
  expect(() => auditOberlandRoadCandidates(stale, pin(stale))).toThrow('Baseline detector audit changed')
  const saturated = structuredClone(inputs), source = saturated.sources.destinations[0]
  source.response.results = Array(200).fill(source.response.results[0])
  source.sha256 = digest(source.response)
  expect(() => auditOberlandRoadCandidates(saturated, pin(saturated))).toThrow('inventory coverage changed')
})
