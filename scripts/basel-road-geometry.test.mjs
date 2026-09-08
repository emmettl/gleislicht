import { describe, expect, it } from 'vitest'
import { applyBaselGeometry, baselGraphs } from './basel-line-geometry.mjs'
import { applyBaselRoadFallback } from './basel-road-geometry.mjs'
import { mergeBaselBusCandidates, readBaselRoadCandidate } from './prepare-basel-road-feeds.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { createHash } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const stops = [[7.6, 47.55, 'A', '', 'a'], [7.61, 47.55, 'B', '', 'b'], [7.62, 47.55, 'C', '', 'c']]
const train = (id, routeId = 'bvb', indices = [0, 1], category = 'bus') => ({ id, routeId, route: routeId === 'keep' ? '30' : '50', category,
  stops: indices.map((index, i) => [index, i * 100, i * 100]) })
const routes = new Map([['bvb', { agencyId: '823', name: '50' }], ['blt', { agencyId: '37', name: '50' }], ['keep', { agencyId: '823', name: '30' }], ['tram', { agencyId: '823', name: '50' }]])
const snapshot = { metadata: { feedVersion: 'test', serviceDate: '2026-09-08' }, stops, edges: [[0, 1], [1, 2]],
  trains: [train('first'), train('variant', 'bvb', [0, 1, 2]), train('other-agency', 'blt'), train('official', 'keep'), train('tram', 'tram', [0, 1], 'tram')] }
const graphs = baselGraphs([{ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { ln_tu: 'BVB', ln_liniennr: '30', ln_verkehrsmittel: 'Bus' },
  geometry: { type: 'LineString', coordinates: stops.slice(0, 2).map(stop => stop.slice(0, 2)) } }] }])
const official = input => applyBaselGeometry(input, routes, graphs)
function bundle() {
  const agencyCaches = {}
  for (const agencyId of ['823', '37']) agencyCaches[agencyId] = { schemaVersion: 1, metadata: { agencyId, license: 'ODbL-1.0', matcher: { completed: true, noTrie: true, warnings: true } },
    paths: [stops.slice(0, 2).map(stop => stop.slice(0, 2))], patterns: {}, report: { issues: [], maxSnapMetres: 0 } }
  agencyCaches['823'].patterns[roadPatternId(snapshot.trains[0], stops)] = [0]
  return { schemaVersion: 1, agencyCaches }
}

describe('Basel per-pattern bus fallback', () => {
  it('preserves official paths and trams, and cannot reuse one pattern or agency for another', () => {
    const base = official(snapshot), result = applyBaselRoadFallback(snapshot, base, routes, bundle())
    expect(result.trains[0].pathSegments[0]).not.toBeNull()
    expect(result.trains[1].pathSegments).toEqual([null, null])
    expect(result.trains[2].pathSegments).toEqual([null])
    expect(result.trains[3]).toEqual(base.trains[3])
    expect(result.paths[base.trains[3].pathSegments[0]]).toEqual(base.paths[base.trains[3].pathSegments[0]])
    expect(result.trains[4].pathSegments).toEqual([null])
    expect(result.roadFallback.addedMovements).toBe(1)
    expect(result.groups.find(group => group.id === 'BVB-bus')).toMatchObject({ matched: 2, total: 4, roadMatched: 1 })
    const pair = result.segments.find(pair => pair.routeId === 'bvb' && pair.mode === 'bus' && pair.fromId === 'a' && pair.toId === 'b')
    expect(pair).toMatchObject({ occurrences: 2, matchedOccurrences: 1, pathIndex: null })
    expect(result.trains.map(t => t.stops)).toEqual(snapshot.trains.map(t => t.stops))
  })

  it('keeps two different paths for a shared stop pair when full patterns differ', () => {
    const input = { ...snapshot, trains: snapshot.trains.slice(0, 2) }, cache = bundle()
    cache.agencyCaches['823'].paths.push([[7.6, 47.55], [7.605, 47.5502], [7.61, 47.55]])
    cache.agencyCaches['823'].patterns[roadPatternId(input.trains[1], stops)] = [1, null]
    const result = applyBaselRoadFallback(input, official(input), routes, cache)
    expect(result.trains[0].pathSegments[0]).not.toBe(result.trains[1].pathSegments[0])
    expect(result.segments.find(pair => pair.fromId === 'a')).toMatchObject({ matchedOccurrences: 2, pathVariantCount: 2 })
  })

  it('leaves moved-platform patterns unmatched and rejects invalid cached endpoints or provenance', () => {
    const moved = { ...snapshot, stops: [[7.6001, ...stops[0].slice(1)], ...stops.slice(1)] }
    expect(applyBaselRoadFallback(moved, official(moved), routes, bundle()).roadFallback.addedMovements).toBe(0)
    const wrong = bundle(); wrong.agencyCaches['823'].paths[0][0] = [7.7, 47.55]
    expect(() => applyBaselRoadFallback(snapshot, official(snapshot), routes, wrong)).toThrow('endpoints')
    const license = bundle(); license.agencyCaches['823'].metadata.license = undefined
    expect(() => applyBaselRoadFallback(snapshot, official(snapshot), routes, license)).toThrow('attribution')
    const rejected = bundle(); rejected.agencyCaches['823'].report.issues.push({ pattern: roadPatternId(snapshot.trains[0], stops), segment: 0, reason: 'matcher-fallback' })
    expect(() => applyBaselRoadFallback(snapshot, official(snapshot), routes, rejected)).toThrow('Rejected road hop')
  })
})

describe('Basel multi-date matcher preparation', () => {
  const candidate = (date, positions = stops, calls = [0, 1]) => ({ manifest: { stops: positions, metadata: { feedVersion: 'test', serviceDate: date } }, trains: [train('same-source-id', 'bvb', calls)], sha256: 'fixture' })

  it('remaps reordered platforms, preserves both dates and isolates the synthetic matcher calendar', () => {
    const merged = mergeBaselBusCandidates([candidate('2026-09-08'), candidate('2026-09-13', [stops[1], stops[0], stops[2]], [1, 0])], routes)
    expect(merged.trains.map(train => train.id)).toEqual(['2026-09-08:same-source-id', '2026-09-13:same-source-id'])
    expect(merged.trains[0].stops).toEqual(merged.trains[1].stops)
    expect(merged.metadata.serviceDates).toEqual(['2026-09-08', '2026-09-13'])
  })

  it('rejects repeated days, mixed feeds and conflicting coordinates for a platform', () => {
    expect(() => mergeBaselBusCandidates([candidate('2026-09-08'), candidate('2026-09-08')], routes)).toThrow('Duplicate')
    const other = candidate('2026-09-13'); other.manifest.metadata.feedVersion = 'other'
    expect(() => mergeBaselBusCandidates([candidate('2026-09-08'), other], routes)).toThrow('different timetable feeds')
    expect(() => mergeBaselBusCandidates([candidate('2026-09-08'), candidate('2026-09-13', [[7.7, ...stops[0].slice(1)], ...stops.slice(1)])], routes)).toThrow('Conflicting platform')
  })

  it('checks candidate chunk hashes before preparing a road feed', async () => {
    const output = await mkdtemp(join(tmpdir(), 'basel-road-test-'))
    try {
      const bytes = JSON.stringify({ trains: [snapshot.trains[0]] })
      await writeFile(join(output, 'chunk.json'), bytes)
      const manifest = { metadata: { localAgencyIds: ['823', '37'] }, tripCount: 1, chunks: [{ path: 'chunk.json', bytes: Buffer.byteLength(bytes), tripCount: 1, sha256: createHash('sha256').update(bytes).digest('hex') }] }
      await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest))
      expect((await readBaselRoadCandidate(join(output, 'manifest.json'))).trains).toHaveLength(1)
      await writeFile(join(output, 'chunk.json'), '{}')
      await expect(readBaselRoadCandidate(join(output, 'manifest.json'))).rejects.toThrow('Changed Basel candidate chunk')
    } finally { await rm(output, { recursive: true, force: true }) }
  })
})
