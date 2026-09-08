import {describe, expect, it} from 'vitest'
import type {NetworkSnapshot} from '@motionstudies/core/domain/network'
import fixture from '../public/data/territet-day.json'
import terrain from '../public/data/territet-ascent-terrain.json'
import source from '../data/territet-terrain-source.json'
import evidence from '../data/territet-journey-source.json'
import fot from '../data/territet-funicular-source.json'
import audit from '../data/territet-terrain-playback-audit.json'
import {bindTerritetTerrain} from '../src/studies/territet-terrain.ts'
import {measuredTerrainPosition, railPoint, railSamples, type TerrainPoint} from '../src/studies/measured-terrain.ts'
import {territetTerrainRoutes, territetGridHeight} from './territet-terrain-geometry.mjs'
import {gzipSync} from 'node:zlib'

const network = fixture as unknown as NetworkSnapshot
describe('Territet terrain playback', () => {
 it('reproduces trimmed XYZ, both contextual branches and spatial progress from the pinned audit', () => {
  const mapped = territetTerrainRoutes(source, fixture, evidence, fot, terrain.origin)
  expect(mapped.route.points).toEqual(terrain.routes[0].points)
  expect(mapped.route.stops).toEqual(terrain.routes[0].stops)
  expect(mapped.contextTracks).toEqual(terrain.contextTracks)
  expect(mapped.alternatives).toEqual(audit.alternatives)
  expect(terrain.routes[0].points).toHaveLength(26)
  expect(terrain.contextTracks).toHaveLength(2)
  expect(terrain.routes[0].vehicle).toBe('funicular')
  expect(terrain.terrain.elevations).toHaveLength(193 * 321)
  expect(gzipSync(JSON.stringify(terrain)).length).toBeLessThan(100 * 1024)
  expect(terrain.routes[0].points[0][2]).toBe(386.794)
  expect(terrain.routes[0].points.at(-1)![2]).toBe(686.188)
 })
 it('binds every original departure in both directions with exact calls and equal reversed heights', () => {
  for (const t of network.trains) {
   const binding = bindTerritetTerrain(terrain, network, t)!
   expect(binding).toBeDefined()
   expect(binding.routes[0].calls.map(c => [c.arrival, c.departure])).toEqual(t.stops.map(c => c.slice(1)))
   expect(binding.windows.length).toBeGreaterThan(0)
   expect(measuredTerrainPosition(binding, t.stops[0][2] - 1)).toBeUndefined()
   expect(measuredTerrainPosition(binding, t.stops.at(-1)![1])).toBeUndefined()
   const reverse = network.stops[t.stops[0][0]][4] === 'ch:1:sloid:30031'
   expect(binding.routes[0].route.points).toEqual(reverse ? [...terrain.routes[0].points].reverse() : terrain.routes[0].points)
   for (const window of binding.windows) {
    expect(window.start).toBeGreaterThanOrEqual(t.stops[0][2]); expect(window.end).toBeLessThanOrEqual(t.stops.at(-1)![1])
    const position = measuredTerrainPosition(binding, (window.start + window.end) / 2)!
    expect(position.mask).toBeUndefined()
    const p = railPoint(position.route.points, railSamples(position.route.points), position.progress)
    const forward = terrain.routes[0].points as TerrainPoint[]
    const q = railPoint(forward, railSamples(forward), reverse ? 1 - position.progress : position.progress)
    p.forEach((value, i) => expect(value).toBeCloseTo(q[i], 7))
   }
   // Every independently measured loop hypothesis falls inside the same map mask.
   const c = binding.routes[0].calls
   for (const hypothesis of audit.alternatives) {
    const middle = hypothesis.stops[1].progress
    for (const edge of hypothesis.loop) {
     const fraction = (edge - middle) / (1 - middle)
     const a = reverse ? c[0] : c[1], b = reverse ? c[1] : c[2]
     const time = a.departure + (b.arrival - a.departure) * (reverse ? 1 - fraction : fraction)
     expect(binding.windows.some(w => time >= w.start && time < w.end)).toBe(false)
     expect(measuredTerrainPosition(binding, time)?.mask?.kinds).toContain('Unassigned passing-loop branches')
    }
   }
  }
 })
 it('preserves distinct Collonge times and masks clearance discrepancies without changing rail height', () => {
  const up = network.trains.find(t => t.id === '.ojp-93-TG.1.TA.16.j26')!, down = network.trains.find(t => t.id === '.ojp-93-TG.1.TA.108.j26')!
  expect(measuredTerrainPosition(bindTerritetTerrain(terrain, network, up)!, 43500)?.from).toBe('Collonge (funi)')
  expect(measuredTerrainPosition(bindTerritetTerrain(terrain, network, down)!, 43620)?.from).toBe('Collonge (funi)')
  for (const sample of audit.clearanceSamples) {
   if (sample.groundHeight - sample.railHeight > 2.5) expect(terrain.routes[0].maskedRanges.some(m => sample.progress >= m.start && sample.progress <= m.end)).toBe(true)
  }
  const grid = {columns: 2, rows: 2, widthMetres: 2, depthMetres: 2, elevations: [0, 0, 0, 10]}
  expect(territetGridHeight(grid, [-.5, -.5])).toBe(0)
  expect(territetGridHeight(grid, [.5, .5])).toBe(5)
 })
 it('rejects altered branches, omitted masks, unlisted directions, malformed terrain and changed calls', () => {
  const t = network.trains[0]
  const mutations = [
   (d: typeof terrain) => { d.contextTracks.pop() },
   (d: typeof terrain) => { d.routes[0].points[0][2]++ },
   (d: typeof terrain) => { d.routes[0].maskedRanges = [] },
   (d: typeof terrain) => { d.routes[0].reverseTripIds = [] },
   (d: typeof terrain) => { d.terrain.elevations[0] = -9999 },
   (d: typeof terrain) => { d.terrain.elevations.pop() },
   (d: typeof terrain) => { d.viewScale = 0 },
  ]
  for (const mutate of mutations) {const copy = structuredClone(terrain); mutate(copy); expect(bindTerritetTerrain(copy, network, t)).toBeUndefined()}
  const changed = structuredClone(network); (changed.trains[0].stops[1] as number[])[1]++
  expect(bindTerritetTerrain(terrain, changed, changed.trains[0])).toBeUndefined()
  expect(bindTerritetTerrain(terrain, {...network, metadata: {...network.metadata, serviceDate: '2026-09-05'}}, t)).toBeUndefined()
 })
})
