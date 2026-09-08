import { readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'
import { loadAargauAlignmentCorrections } from './aargau-alignment-corrections.mjs'
import { applyAargauGeometry, buildAargauStudy } from './build-aargau-study.mjs'
const file = 'data/aargau-alignment-policy.json'
const corrections = await loadAargauAlignmentCorrections(file, '2026-09-04')
const rule = corrections.policy.rules[0]
const audit = JSON.parse(await readFile('fixtures/aargau/2026-09-04/audit.json'))
const manifest = JSON.parse(await readFile('fixtures/aargau/2026-09-04/aargau-region-day-manifest.json'))
const source = audit.patterns.find(p => p.id === rule.patternId).segments[rule.segmentIndex]
const original = { ...source, path: manifest.paths[source.pathIndex] }
const train = { agencyId: rule.agencyId, routeId: rule.routeId, route: rule.line, category: rule.mode, directionId: rule.directionId }

test('Wittnau correction replaces only the exact reviewed full pattern and segment', () => {
  const result = corrections.overrideSegment(train, rule.stops, rule.segmentIndex, original)
  expect(result.alignmentCorrectionId).toBe('136-wittnau-bypass')
  expect(result.pathMetres).toBeLessThan(3600)
  expect(result.supersededGeometry.pathMetres).toBeGreaterThan(6900)
  for (const change of [{ agencyId: '899' }, { routeId: 'other' }, { directionId: '1' }, { category: 'rail' }]) {
    expect(corrections.overrideSegment({ ...train, ...change }, rule.stops, rule.segmentIndex, original)).toBe(original)
  }
  expect(corrections.overrideSegment(train, [...rule.stops].reverse(), rule.segmentIndex, original)).toBe(original)
  expect(corrections.overrideSegment(train, rule.stops, rule.segmentIndex + 1, original)).toBe(original)
  const moved = structuredClone(rule.stops); moved[0][0] += .00001
  expect(corrections.overrideSegment(train, moved, rule.segmentIndex, original)).toBe(original)
})

test('a changed source path or unreviewed date cannot inherit the correction', async () => {
  const moved = structuredClone(original); moved.path[1][0] += .00001
  expect(() => corrections.overrideSegment(train, rule.stops, rule.segmentIndex, moved)).toThrow('AGIS path changed')
  expect(() => corrections.overrideSegment(train, rule.stops, rule.segmentIndex, { ...original, geometrySource: 'osm' })).toThrow()
  const other = await loadAargauAlignmentCorrections(file, '2026-10-23')
  expect(other.overrideSegment(train, rule.stops, rule.segmentIndex, original)).toBe(original)
})

test('a correction cannot be exported without road provenance and attribution', async () => {
  await expect(buildAargauStudy({ sources: 'data/aargau-sources', inventoryDirectory: 'data/aargau', date: '2026-09-04',
    alignmentPolicyPath: file, output: '/private/tmp/aargau-unused-rejected-export' })).rejects.toThrow('Alignment corrections require road provenance and attribution')
})

test('Seesteg direct correction admits exactly the three dated source courses', async () => {
  const direct = corrections.policy.rules.find(r => r.id === '358-seesteg-direct')
  const segment = audit.patterns.find(p => p.id === direct.patternId).segments[direct.segmentIndex]
  const prior = { ...segment, path: manifest.paths[segment.pathIndex] }
  const identity = { agencyId: direct.agencyId, routeId: direct.routeId, route: direct.line, category: direct.mode, directionId: direct.directionId }
  const otherDate = await loadAargauAlignmentCorrections(file, '2026-09-06')
  for (const journey of direct.journeys) {
    const t = { ...identity, ...journey }
    const result = corrections.overrideSegment(t, direct.stops, 5, prior)
    expect(result.alignmentCorrectionId).toBe(direct.id)
    expect(result.pathMetres).toBeCloseTo(931.3592, 3)
    expect(result.supersededGeometry.featureId).toBe(193)
    expect(() => corrections.assertJourneyScope(t, direct.stops)).not.toThrow()
    expect(otherDate.overrideSegment(t, direct.stops, 5, prior)).toBe(prior)
    const calls = structuredClone(t.calls); calls[5][2]++
    for (const changed of [{ sourceTripId: 'another-trip' }, { shortName: '35810' }, { sourceServiceDate: '2026-09-06' }, { calls }]) {
      const unreviewed = { ...t, ...changed }
      expect(corrections.overrideSegment(unreviewed, direct.stops, 5, prior)).toBe(prior)
      expect(() => corrections.assertJourneyScope(unreviewed, direct.stops)).toThrow('Unreviewed journey')
    }
    const moved = structuredClone(direct.stops); moved[5][0] += .00001
    expect(corrections.overrideSegment(t, moved, 5, prior)).toBe(prior)
    expect(corrections.overrideSegment({ ...t, directionId: '0' }, direct.stops, 5, prior)).toBe(prior)
    expect(corrections.overrideSegment(t, direct.stops, 2, prior)).toBe(prior)
  }
})


test('shared-pattern geometry cache cannot bypass the per-journey review guard', () => {
  const r = corrections.policy.rules.find(r => r.id === '358-seesteg-direct')
  const t = { ...r.journeys[0], id: 'reviewed', agencyId: r.agencyId, routeId: r.routeId, route: r.line, category: r.mode, directionId: r.directionId }
  const invalid = { ...t, id: 'unreviewed', sourceTripId: 'another-trip' }
  const guardOnly = { assertJourneyScope: corrections.assertJourneyScope, overrideSegment: (_t, _s, _i, segment) => segment }
  expect(() => applyAargauGeometry({ stops: r.stops, trains: [t, invalid] }, new Map(), [], undefined, undefined, undefined, undefined, guardOnly)).toThrow('Unreviewed journey')
})
