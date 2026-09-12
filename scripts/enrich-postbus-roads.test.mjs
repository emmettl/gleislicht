import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyRoadCache, assessRoad, enrichPostbusRoads, fallbackHops, simplifyRoad, sliceShape } from './enrich-postbus-roads.mjs'
import { mergeRoadDays, prepareRoadFeed, roadPatternId, roadPatterns } from './prepare-postbus-road-feed.mjs'

const stops = [[8, 47, 'A', '', 'a'], [8.01, 47, 'B', '', 'b'], [8.005, 47.003, 'Loop', '', 'c']]
const train = { id: 'one', routeId: 'region-a-220', route: '220', headsign: 'B', category: 'bus',
  start: 100, end: 300, stops: [[0, 100, 100], [1, 300, 300]] }
const manifest = { stops, edges: [[0, 1]], metadata: { serviceDate: '2026-09-08', feedVersion: 'test', sourceUrl: 'https://opentransportdata.swiss' } }
const path = [[8, 47], [8.005, 47.003], [8.01, 47]]
const cache = { schemaVersion: 1, metadata: { matcher: { matcherVersion: 'test' } }, paths: [path],
  patterns: { [roadPatternId(train, stops)]: [0] } }

describe('PostBus road geometry', () => {
  it('reuses exact route patterns across timetable times, but isolates regions, directions, variants and moved platforms', () => {
    const key = roadPatternId(train, stops)
    expect(roadPatternId({ ...train, id: 'tomorrow', stops: [[0, 800, 800], [1, 1000, 1000]] }, stops)).toBe(key)
    expect(roadPatternId({ ...train, routeId: 'region-b-220' }, stops)).not.toBe(key)
    expect(roadPatternId({ ...train, stops: [...train.stops].reverse() }, stops)).not.toBe(key)
    expect(roadPatternId({ ...train, stops: [train.stops[0], [2, 200, 200], train.stops[1]] }, stops)).not.toBe(key)
    expect(roadPatternId(train, [[8.0001, ...stops[0].slice(1)], ...stops.slice(1)])).not.toBe(key)
    expect(roadPatterns([train, { ...train, id: 'second' }], stops)).toHaveLength(1)
  })

  it('unions weekday and weekend patterns across local stop indexes and rejects conflicting platforms', () => {
    const weekendStops = [stops[1], stops[0], [8.006, 47.003, 'Weekend', '', 'd']]
    const weekend = { ...train, id: 'weekend', stops: [[1, 500, 500], [2, 600, 600], [0, 700, 700]] }
    const result = mergeRoadDays([
      { manifest, trains: [train] },
      { manifest: { ...manifest, stops: weekendStops, metadata: { ...manifest.metadata, serviceDate: '2026-09-12' } }, trains: [weekend] },
    ])
    expect(result.manifest.metadata.serviceDates).toEqual(['2026-09-08', '2026-09-12'])
    expect(result.manifest.metadata.feedVersions).toEqual(['test'])
    expect(result.manifest.stops).toHaveLength(4)
    expect(roadPatterns(result.trains, result.manifest.stops).map(p => p.id).sort()).toEqual([
      roadPatternId(train, stops), roadPatternId(weekend, weekendStops),
    ].sort())
    expect(result.trains[1].stops.map(([i]) => result.manifest.stops[i][4])).toEqual(['a', 'd', 'b'])
    expect(() => mergeRoadDays([{ manifest, trains: [train] }, { manifest: { ...manifest, stops: [[8.001, ...stops[0].slice(1)]] }, trains: [] }])).toThrow('Conflicting coordinates')
    expect(() => mergeRoadDays([{ manifest, trains: [train] }, { manifest: { ...manifest, metadata: { ...manifest.metadata, feedVersion: 'other' } }, trains: [] }])).toThrow('different timetable releases')
  })

  it('slices a repeated-location loop by shape distance without jumping to the first visit', () => {
    const loop = [[8, 47, 0], [8.01, 47, 100], [8.01, 47.01, 200], [8, 47, 300], [8.02, 47, 400]]
    expect(sliceShape(loop, 0, 300)).toEqual(loop.slice(0, 4).map(point => point.slice(0, 2)))
    expect(sliceShape(loop, 300, 400)).toEqual([[8, 47], [8.02, 47]])
    expect(sliceShape(loop, 400, 300)).toBeNull()
    expect(sliceShape(loop, NaN, 300)).toBeNull()
    expect(sliceShape(loop, 0, 500)).toBeNull()
  })

  it('retains hairpins and exact endpoints while simplifying nearly straight road vertices', () => {
    const hairpins = [[8, 47], [8.001, 47.0005], [8.002, 47.001], [8, 47.002], [8.002, 47.003]]
    expect(simplifyRoad(hairpins)).toEqual([hairpins[0], ...hairpins.slice(2)])
    const assessed = assessRoad(path, stops[0], stops[1])
    expect(assessed.path).toEqual(path)
    expect(assessed.length).toBeGreaterThan(assessed.direct)
  })

  it('rejects distant snapping and excessive detours without rejecting ordinary Alpine bends', () => {
    expect(assessRoad([[9, 47], [9.01, 47]], stops[0], stops[1]).reason).toBe('stop-too-far')
    expect(assessRoad([[8, 47], [8, 48], [8.01, 47]], stops[0], stops[1]).reason).toBe('excessive-detour')
    expect(assessRoad(path, stops[0], stops[1]).path).toBeTruthy()
  })

  it('recognises explicit matcher failures and refuses aggregated warnings', () => {
    const id = roadPatternId(train, stops)
    const warning = `No viable hop found between stops 'A' (a) and 'B' (b) for trip ${id} of type 'bus', falling back to straight line`
    expect(fallbackHops(warning).has(`${id}:a:b`)).toBe(true)
    expect(() => fallbackHops(`${warning} (and 2 similar trips)`)).toThrow('grouped failures')
    expect(() => fallbackHops('No viable hop found: changed format')).toThrow('Unrecognised')
  })

  it('keeps every trip, uses per-pattern geometry and leaves unknown variants unshaped', () => {
    const other = { ...train, id: 'other', routeId: 'region-b-220', pathSegments: [999] }
    const result = applyRoadCache(manifest, [train, other], cache)
    expect(result.trains).toHaveLength(2)
    expect(result.trains.map(trip => trip.pathSegments)).toEqual([[0], [null]])
    expect(result.paths).toEqual([path])
    expect(result.edgePaths).toEqual([0])
    expect(result.matched).toBe(1)
    expect(result.missingPatterns).toBe(1)
  })

  it('writes a minimal matcher feed retaining platform IDs, route names and service times', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'postbus-feed-'))
    try {
      expect(await prepareRoadFeed({ manifest, trains: [train], output: directory })).toEqual({ routes: 1, patterns: 1, trips: 1, stops: 2 })
      expect(await readFile(join(directory, 'routes.txt'), 'utf8')).toContain('"region-a-220","801","220"')
      expect(await readFile(join(directory, 'stop_times.txt'), 'utf8')).toContain('"00:01:40","00:01:40","a","1"')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('updates exact chunk hashes, preserves boundary trips and makes coverage failure non-destructive', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'postbus-shape-'))
    try {
      const chunk = { windowStart: 0, windowEnd: 10800, trains: [train] }
      const document = { ...manifest, chunks: [{ path: 'a.json' }, { path: 'b.json' }] }
      const snapshot = join(directory, 'manifest.json')
      for (const name of ['a.json', 'b.json']) await writeFile(join(directory, name), JSON.stringify(chunk))
      await writeFile(snapshot, JSON.stringify(document))
      await expect(enrichPostbusRoads(snapshot, { ...cache, patterns: {} })).rejects.toThrow('No artifacts written')
      expect(JSON.parse(await readFile(snapshot, 'utf8'))).toEqual(document)
      const result = await enrichPostbusRoads(snapshot, cache)
      expect(result.coverage).toBe(1)
      const enriched = JSON.parse(await readFile(snapshot, 'utf8'))
      const bytes = await readFile(join(directory, 'a.json'))
      expect(bytes.equals(await readFile(join(directory, 'b.json')))).toBe(true)
      expect(enriched.chunks[0].bytes).toBe(bytes.length)
      expect(enriched.chunks[0].sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
      expect(JSON.parse(bytes).trains[0].pathSegments).toEqual([0])
      expect(enriched.metadata.serviceDate).toBe('2026-09-08')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
