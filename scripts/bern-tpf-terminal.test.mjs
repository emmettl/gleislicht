import { it, expect } from 'vitest'
import { loadBernTpfTerminal, bernTpfTerminalNetwork } from './bern-tpf-terminal.mjs'
import { bernRailCandidates } from './bern-rail-geometry.mjs'
const rail = await loadBernTpfTerminal(), policy = rail.policy
const route = { id: '91-20-B-j26-1', agencyId: '53', line: 'S20', name: 'S20', mode: 'rail' }
const stops = new Map(policy.originalStops.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
const pattern = policy.originalPatterns.find(p => p.routeId === route.id && p.stopIds[0] === 'ch:1:sloid:4100:3:4')
const train = { routeId: route.id, directionId: pattern.directionId, calls: pattern.stopIds.map(id => ({ id })) }

it('pins three bounded source-curve spurs, preserving the federal station node', () => {
  expect(policy.routes.flatMap(r => r.pairs)).toHaveLength(9)
  expect(rail.metadata.sourceSegments).toHaveLength(5)
  expect(rail.metadata.sourceSegments.every(s => !s.reason && s.gauge === 'mm1435' && s.attachmentMetres <= 120)).toBe(true)
  for (const e of rail.metadata.terminalEvidence) {
    expect(e.sourceCurveId).toBe('ch14uvag00087313')
    expect(e.northernApproachId).toBe('ch14uvag00087314')
    expect(e.projection.attachmentMetres).toBeLessThan(18)
    expect(e.retainedMetres).toBeGreaterThan(269)
    expect(e.retainedMetres).toBeLessThan(271)
    expect(e.originalOperatingPoint).toEqual(policy.terminal.node)
    const network = { nodes: new Map([[policy.terminal.node.id, policy.terminal.node]]),
      segments: [policy.terminal.stationCurve, policy.terminal.northernApproach] }
    const v = bernTpfTerminalNetwork(network, policy.terminal, policy.terminal.stops.find(s => s[4] === e.stopId))
    expect(v.network.nodes.get(policy.terminal.node.id)).toEqual(policy.terminal.node)
    expect(v.network.segments.filter(s => [s.start, s.end].includes(policy.terminal.node.id)).map(s => s.id).sort())
      .toEqual([e.northernApproachId, e.spurId].sort())
  }
})

it('routes every reviewed full context in both directions with unchanged source endpoints', () => {
  const directions = new Set()
  for (const p of policy.originalPatterns) {
    const r = policy.routes.find(r => r.routeId === p.routeId)
    const t = { routeId: p.routeId, directionId: p.directionId, calls: p.stopIds.map(id => ({ id })) }
    const results = rail.matcher.matchPattern(t, stops, r), terminal = p.stopIds.findIndex(id => id.includes(':4100'))
    const index = terminal === 0 ? 0 : results.length - 1, result = results[index]
    expect(result.path).toBeDefined()
    expect(result.path[0]).toEqual(policy.originalStops.find(s => s[4] === p.stopIds[index]).slice(0, 2))
    expect(result.path.at(-1)).toEqual(policy.originalStops.find(s => s[4] === p.stopIds[index + 1]).slice(0, 2))
    expect(result.directedSourceSegments.map(s => s.id)).toEqual(r.pairs.find(b => b.fromId === p.stopIds[index] && b.toId === p.stopIds[index + 1]).sourceSegments)
    expect(results.filter(r => r.path)).toHaveLength(1)
    expect(result.stationAttachmentsMetres.every(m => m <= 120)).toBe(true)
    directions.add(p.directionId)
  }
  expect([...directions].sort()).toEqual(['0', '1'])
})

it('rejects cropped, reordered, repeated, through-station and unknown-platform contexts', () => {
  for (const calls of [train.calls.slice(0, 2), [train.calls[0], train.calls[2], train.calls[1], ...train.calls.slice(3)],
    [...train.calls, train.calls[0]], [train.calls[1], ...train.calls],
    [{ id: 'ch:1:sloid:4100:2:3' }, ...train.calls.slice(1)]]) {
    expect(rail.matcher.matchPattern({ ...train, calls }, stops, route).every(r => !r.path)).toBe(true)
  }
  expect(() => rail.matcher.matchPattern(train, stops, { ...route, agencyId: '11' })).toThrow()
  expect(() => rail.matcher.matchPattern(train, stops, { ...route, line: 'S1' })).toThrow()
  const raw = { metadata: { serviceDate: '2026-12-06' }, stops: policy.originalStops, trains: [] }
  expect(() => bernRailCandidates(raw, new Map([[route.id, route]]), rail)).toThrow('Unreviewed Bern rail date')
})

it('checks terminal and remote original platform coordinates before using cached patterns', () => {
  rail.matcher.matchPattern(train, stops, route)
  for (const { id } of [train.calls[0], train.calls[1], train.calls.at(-1)]) {
    const changed = new Map(stops)
    changed.set(id, { ...changed.get(id), stop_lon: changed.get(id).stop_lon + .001 })
    expect(() => rail.matcher.matchPattern(train, changed, route)).toThrow('Changed reviewed TPF stop coordinates')
  }
})
