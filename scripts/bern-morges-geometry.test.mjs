import { it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadBernMorges, bernMorgesNetwork } from './bern-morges-geometry.mjs'
import { bernRailCandidates } from './bern-rail-geometry.mjs'
import { parseZugRail, zugRailMatcher } from './zug-rail-geometry.mjs'
const rail = await loadBernMorges(), policy = rail.policy
const route = { id: '91-15-B-j26-1', agencyId: '11', line: 'IR15', name: 'IR15', mode: 'rail' }
const stops = new Map(policy.originalStops.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
const pattern = policy.originalPatterns[0]
const train = { routeId: route.id, directionId: pattern.directionId, calls: pattern.stopIds.map(id => ({ id })) }

it('splits the pinned curve without dropping source vertices, moving the station or removing either side', () => {
  const network = { nodes: new Map([[policy.morges.node.id, policy.morges.node]]), segments: [policy.morges.stationCurve] }
  const v = bernMorgesNetwork(network, policy.morges), [station, north] = v.network.segments
  expect(v.network.nodes.get(policy.morges.node.id)).toEqual(policy.morges.node)
  expect(station.start).toBe(policy.morges.node.id); expect(station.end).toBe(v.platform.id)
  expect(north.start).toBe(v.platform.id); expect(north.end).toBe(policy.morges.stationCurve.start)
  expect(station.points.at(-1)).toEqual(north.points[0])
  const original = [...policy.morges.stationCurve.points].reverse()
  const rejoined = [...station.points.slice(0, -1), ...north.points.slice(1)]
  expect(rejoined).toEqual(original)
  expect(v.evidence.stationSectionMetres + v.evidence.northernSectionMetres).toBeCloseTo(v.evidence.sourceLengthMetres, 3)
  expect(v.evidence.stationSectionMetres).toBeCloseTo(133.9929, 3)
  expect(v.evidence.projection.attachmentMetres).toBeCloseTo(8.68627, 3)
  expect(rail.metadata.sourceSegments).toHaveLength(26)
  expect(rail.metadata.sourceSegments.every(s => !s.reason && s.gauge === 'mm1435' && s.attachmentMetres < 15)).toBe(true)
  expect(policy.morges.sbbPlatform).toMatchObject({ bpuic: '8501037', p_nr: '1', p_lange: 421 })
})

it('routes both adjacent legs for every full source pattern with original endpoints', () => {
  for (const p of policy.originalPatterns) {
    const t = { ...train, directionId: p.directionId, calls: p.stopIds.map(id => ({ id })) }
    const results = rail.matcher.matchPattern(t, stops, route), index = p.stopIds.indexOf(policy.morges.stop[4])
    expect(results.filter(r => r.path)).toHaveLength(2)
    for (const i of [index - 1, index]) {
      expect(results[i].path[0]).toEqual(policy.originalStops.find(s => s[4] === p.stopIds[i]).slice(0, 2))
      expect(results[i].path.at(-1)).toEqual(policy.originalStops.find(s => s[4] === p.stopIds[i + 1]).slice(0, 2))
      expect(results[i].directedSourceSegments.map(s => s.id)).toEqual(policy.routes[0].pairs.find(b => b.fromId === p.stopIds[i] && b.toId === p.stopIds[i + 1]).sourceSegments)
    }
    expect(results[index - 1].directedSourceSegments.at(-1).id).toBe(rail.metadata.throughStationEvidence.northernSectionId)
    expect(results[index].directedSourceSegments[0].id).toBe(rail.metadata.throughStationEvidence.stationSectionId)
  }
})

it('preserves reversible through geometry without admitting an unreviewed reverse timetable pattern', async () => {
  const parsed = parseZugRail(gunzipSync(await readFile('data/bern-sources/fot-rail/network.xtf.gz')).toString(), 0)
  const selected = new Set(policy.routes[0].pairs.flatMap(p => p.sourceSegments.map(id => id.split(':morges-platform:')[0])))
  const v = bernMorgesNetwork({ ...parsed, segments: parsed.segments.filter(s => selected.has(s.id)) }, policy.morges)
  const matcher = zugRailMatcher(v.network, { ...policy, operatingPointOverrides: [{ sourceNumber: '8501037',
    targetNumber: v.platform.number, expectedName: v.platform.name, routeIds: [route.id] }] }, ['2026-09-03', '2026-09-06'])
  const index = pattern.stopIds.indexOf(policy.morges.stop[4]), calls = train.calls.slice(index - 1, index + 2)
  const forward = matcher.matchPattern({ ...train, calls }, stops, route)
  const reverseTrain = { ...train, directionId: '0', calls: [...calls].reverse() }
  const reverse = matcher.matchPattern(reverseTrain, stops, route)
  for (let i = 0; i < 2; i++) expect(reverse[1 - i].path).toEqual([...forward[i].path].reverse())
  expect(rail.matcher.matchPattern(reverseTrain, stops, route).every(r => !r.path)).toBe(true)
})

it('rejects unreviewed cropped, terminal, repeated and changed-platform contexts', () => {
  const index = pattern.stopIds.indexOf(policy.morges.stop[4])
  for (const calls of [train.calls.slice(index - 1, index + 2), train.calls.slice(0, index + 1), train.calls.slice(index),
    [...train.calls, train.calls[index]], train.calls.map((c, i) => i === index ? { id: 'ch:1:sloid:1037:2:2' } : c)]) {
    expect(rail.matcher.matchPattern({ ...train, calls }, stops, route).every(r => !r.path)).toBe(true)
  }
  expect(() => rail.matcher.matchPattern(train, stops, { ...route, line: 'IC1' })).toThrow()
  expect(() => rail.matcher.matchPattern(train, stops, { ...route, agencyId: '33' })).toThrow()
  expect(() => bernRailCandidates({ metadata: { serviceDate: '2026-12-06' }, stops: [], trains: [] }, new Map(), rail)).toThrow('Unreviewed Bern rail date')
})

it('rechecks all original call coordinates before consulting cached paths', () => {
  rail.matcher.matchPattern(train, stops, route)
  for (const id of [policy.morges.stop[4], train.calls[0].id, train.calls.at(-1).id]) {
    const changed = new Map(stops); changed.set(id, { ...changed.get(id), stop_lon: changed.get(id).stop_lon + .001 })
    expect(() => rail.matcher.matchPattern(train, changed, route)).toThrow('Changed reviewed IR15 source coordinates')
  }
})
