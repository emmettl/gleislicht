import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyRivieraRailGeometry, assertCompleteRivieraCalls, rivieraRailCorridors } from './riviera-rail-geometry.mjs'
const source = JSON.parse(readFileSync(new URL('../data/riviera-sources/fot-reviewed-corridors.json', import.meta.url)))
const network = () => ({ nodes: new Map(source.nodes.map(n => [n.id, n])), segments: structuredClone(source.segments) })

describe('Riviera operator corridors', () => {
  it('reaches the narrow-gauge terminals without selecting adjacent SBB platforms', () => {
    const n = network(), corridors = rivieraRailCorridors(n)
    const numbers = segments => new Set(segments.flatMap(s => [n.nodes.get(s.start).number, n.nodes.get(s.end).number]))
    expect(numbers(corridors['42']).has('8519324')).toBe(true)
    expect(numbers(corridors['42']).has('8501288')).toBe(true)
    expect(numbers(corridors['64']).has('8501352')).toBe(true)
    expect(numbers(corridors['64']).has('8507279')).toBe(true)
    expect(numbers(corridors['131']).has('8501353')).toBe(true)
    expect(numbers(corridors['131']).has('8501369')).toBe(true)
    for (const segments of Object.values(corridors)) {
      expect(numbers(segments).has('8501300')).toBe(false)
      expect(numbers(segments).has('8501200')).toBe(false)
    }
  })
  it('rejects a misleading shortcut through the mainline instead of silently accepting it', () => {
    const n = network(), id = number => source.nodes.find(n => n.number === number).id
    for (const [a, b] of [['8519324', '8501200'], ['8501200', '8501281']]) n.segments.push({ id: `false:${a}:${b}`, start: id(a), end: id(b), length: 1, points: [[6.8, 46.4], [6.9, 46.5]] })
    expect(() => rivieraRailCorridors(n)).toThrow('incorrectly reaches mainline')
  })
  it('does not apply the Rochers-de-Naye alignment to a funicular sharing agency 131', () => {
    const snapshot = { stops: [[6.9, 46.4, 'A'], [6.91, 46.41, 'B']], edges: [[0, 1]], trains: [{ id: 'f', routeId: 'funicular', category: 'funicular', stops: [[0, 0, 0], [1, 120, 120]] }] }
    const result = applyRivieraRailGeometry(snapshot, new Map([['funicular', { agencyId: '131', mode: 'funicular' }]]), rivieraRailCorridors(network()))
    expect(result.snapshot.trains[0].pathSegments).toEqual([null])
    expect(result.snapshot.paths).toEqual([])
  })
  it('preserves repeated calls, dwell times and preceding-day spillover', () => {
    const stops = [[0, 0, 'A', '', 'a'], [1, 1, 'B', '', 'b']]
    const calls = [{ id: 'a', arrival: 86000, departure: 86010 }, { id: 'b', arrival: 86350, departure: 86360 }, { id: 'a', arrival: 86600, departure: 86610 }]
    const train = { sourceServiceDate: '2026-09-07', stops: [[0, -400, -390], [1, -50, -40], [0, 200, 210]] }
    expect(() => assertCompleteRivieraCalls(train, stops, calls, '2026-09-08')).not.toThrow()
    expect(() => assertCompleteRivieraCalls({ ...train, stops: train.stops.slice(1) }, stops, calls, '2026-09-08')).toThrow('clipped or reordered')
    const changed = structuredClone(train); changed.stops[1][2]++
    expect(() => assertCompleteRivieraCalls(changed, stops, calls, '2026-09-08')).toThrow('changed source times')
  })
})
