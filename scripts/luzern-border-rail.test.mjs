import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadLuzernBorderRail, luzernBorderMatcher, luzernBorderConsensus } from './luzern-border-rail.mjs'
const json = p => JSON.parse(readFileSync(p))
const config = json('data/luzern-policy.json').borderRailFallback
const border = await loadLuzernBorderRail(config), policy = border.policy, inputs = border.inputs
const page = json(`${policy.sourceDirectory}/foreign-review.json`)
const matcher = () => luzernBorderMatcher(page, policy)
const stops = new Map(inputs.stops.map(s => [s.stop_id, s]))
const route = inputs.inventory.find(r => r.line === 'IR75')
const train = inputs.snapshots[0].trains.find(t => t.calls[0].id === '8014586')

it('replays every complete fixture context, retaining both detailed source curves in both directions', () => {
  expect(border.patterns).toHaveLength(45)
  expect(border.inventory).toHaveLength(59)
  expect(border.inventory.filter(r => r.usedBy.length)).toHaveLength(2)
  const [forward, reverse] = [...border.pairs.values()]
  expect(forward.path).toHaveLength(120)
  expect(reverse.path).toEqual([...forward.path].reverse())
  expect(forward.railPatternIds).toHaveLength(8)
  expect(reverse.railPatternIds).toHaveLength(12)
  expect(forward.stationAttachmentsMetres.every(m => m < 100)).toBe(true)
  expect(forward.directedSourceSegments.map(s => [s.from, s.to])).toEqual([['KODB', 'KRGR'], ['KRGR', 'KR']])
})

it('rejects source truncation, duplicate identities, wrong gauge, schematics and broken exact joins', () => {
  const bad = mutate => { const p = structuredClone(page); mutate(p); return () => luzernBorderMatcher(p, policy) }
  expect(bad(p => p.results.pop())).toThrow('Truncated')
  expect(bad(p => { p.results.push(p.results[0]); p.total_count++ })).toThrow('Duplicate')
  const selected = p => p.results.find(r => r.bp_anfang === 'KR')
  expect(bad(p => { selected(p).spurweite = 'M' })).toThrow('gauge')
  expect(bad(p => { selected(p).geo_shape.geometry.coordinates = selected(p).geo_shape.geometry.coordinates.slice(0, 2) })).toThrow('Schematic')
  expect(bad(p => { selected(p).geo_shape.geometry.coordinates.at(-1)[0] += .00001 })).toThrow('Disconnected')
  expect(bad(p => { selected(p).bp_anf_bez = 'Wrong station' })).toThrow('station-name')
})

it('rejects distant or renamed GTFS stops and changed route/operator identities', () => {
  const m = matcher(), distant = new Map(stops)
  distant.set('8014586', { ...stops.get('8014586'), stop_lon: '9.19' })
  expect(m.match(train, distant, route)[0].reason).toBe('sbb-rail-station-attachment')
  const renamed = new Map(stops); renamed.set('8014586', { ...stops.get('8014586'), stop_name: 'Other' })
  expect(() => m.match(train, renamed, route)).toThrow('station-name')
  expect(() => m.match(train, stops, { ...route, agencyId: '65' })).toThrow('route identity')
})

it('does not admit an interior Konstanz call or reuse a pair when one full context fails', () => {
  const altered = structuredClone(inputs), t = altered.snapshots[0].trains.find(t => t.calls[0].id === '8014586')
  t.calls.unshift(t.calls.at(-1))
  expect(() => luzernBorderConsensus(altered, matcher(), policy)).toThrow('rejected border pair consensus')
})

it('rejects changed geometry reviews and records Como as schematic, without admitting its EC pairs', () => {
  const changed = structuredClone(policy); changed.pairs[0].geometrySha256 = 'wrong'
  expect(() => luzernBorderConsensus(inputs, matcher(), changed)).toThrow('Changed reviewed border path')
  const como = border.inventory.filter(r => r.from === 'Como S. Giovanni' || r.to === 'Como S. Giovanni')
  expect(como.length).toBeGreaterThan(0)
  expect(como.every(r => r.exclusion === 'schematic-two-point-record')).toBe(true)
  expect([...border.pairs.keys()].some(k => k.includes('91-3R-Y-j26-1'))).toBe(false)
})
