import {describe, expect, it} from 'vitest'
import type {NetworkSnapshot} from '@motionstudies/core/domain/network'
import funicular from '../public/data/territet-day.json'
import railway from '../public/data/rochers-day.json'
import terrain from '../public/data/rochers-ascent-terrain.json'
import funicularTerrain from '../public/data/territet-ascent-terrain.json'
import {glionJourneys} from '../src/studies/glion.ts'
import {bindGlionTerrain, bindGlionFunicularTerrain} from '../src/studies/glion-terrain.ts'
import {bindTerritetTerrain} from '../src/studies/territet-terrain.ts'
import {bindRochersTerrain} from '../src/studies/rochers-terrain.ts'
import {measuredTerrainPosition, railPoint, railSamples} from '../src/studies/measured-terrain.ts'
const f = funicular as unknown as NetworkSnapshot, r = railway as unknown as NetworkSnapshot

describe('Glion combined railway terrain', () => {
 it('preserves the separate funicular binding and its masks for every checked combined journey', () => {
  for (const direction of ['ascent', 'descent'] as const) for (const {connection: c} of glionJourneys(f, r, direction)) {
   const b = bindGlionFunicularTerrain(funicularTerrain, f, r, c.railwayTripId)!
   const leg = c.legs.find(l => l.tripId !== c.railwayTripId)!, train = f.trains.find(t => t.id === leg.tripId)!
   const full = bindTerritetTerrain(funicularTerrain, f, train)!
   expect(b).toEqual(full)
   expect(b.data.terrain.columns).toBe(193); expect(b.data.terrain.rows).toBe(321)
   expect(b.data.viewScale).toBe(180); expect(b.data.contextTracks).toHaveLength(2)
   expect(b.routes[0].calls.map(c => [c.arrival, c.departure])).toEqual(leg.calls.map(c => [c.arrival, c.departure]))
   const rail = bindGlionTerrain(terrain, f, r, c.railwayTripId)!
   expect(rail.data.terrain.columns).toBe(257)
   expect(rail.data.contextTracks).toBeUndefined()
   for (const w of b.windows) {
    const t = (w.start + w.end) / 2
    expect(measuredTerrainPosition(b, t)).toEqual(measuredTerrainPosition(full, t))
    expect(rail.windows.some(w => t >= w.start && t < w.end)).toBe(false)
   }
   for (const t of [c.start - 1, c.transfer.arrival, (c.transfer.arrival + c.transfer.departure) / 2, c.end]) {
    expect(measuredTerrainPosition(b, t)).toBeUndefined()
    expect(measuredTerrainPosition(rail, t)).toBeUndefined()
   }
   for (const mask of b.routes[0].route.maskedRanges) {
    const calls = b.routes[0].calls, p = (mask.start + mask.end) / 2
    const i = calls.findIndex((call, i) => calls[i + 1] && p >= call.progress && p <= calls[i + 1].progress)
    const a = calls[i], z = calls[i + 1], t = a.departure + (z.arrival - a.departure) * (p - a.progress) / (z.progress - a.progress)
    expect(b.windows.some(w => t >= w.start && t < w.end)).toBe(false)
   }
  }
 })
 it('refuses mismatched pairs and one leg’s terrain without affecting the valid other binding', () => {
  const id = '.ojp-91-37-F.1.TA.89.j26'
  const changed = structuredClone(funicularTerrain); changed.contextTracks.pop()
  expect(bindGlionFunicularTerrain(changed, f, r, id)).toBeUndefined()
  expect(bindGlionTerrain(terrain, f, r, id)).toBeDefined()
  expect(bindGlionFunicularTerrain(funicularTerrain, f, r, id)).toBeDefined()
  expect(bindGlionFunicularTerrain(terrain, f, r, id)).toBeUndefined()
  expect(bindGlionTerrain(funicularTerrain, f, r, id)).toBeUndefined()
  expect(bindGlionFunicularTerrain(funicularTerrain, f, r, 'unknown')).toBeUndefined()
  const changedRail = structuredClone(r); (changedRail.trains.find(t => t.id === id)!.stops[4] as number[])[1]++
  expect(bindGlionFunicularTerrain(funicularTerrain, f, changedRail, id)).toBeUndefined()
  expect(bindGlionFunicularTerrain(funicularTerrain, {...f, metadata: {...f.metadata, serviceDate: '2026-09-05'}}, r, id)).toBeUndefined()
 })
 it('retains original XYZ, progress and masks for all 20 checked railway legs', () => {
  for (const direction of ['ascent', 'descent'] as const) for (const {connection: c} of glionJourneys(f, r, direction)) {
   const b = bindGlionTerrain(terrain, f, r, c.railwayTripId)!
   const train = r.trains.find(t => t.id === c.railwayTripId)!, full = bindRochersTerrain(terrain, r, train)!
   const leg = c.legs.find(l => l.tripId === c.railwayTripId)!
   expect(b.routes).toHaveLength(1)
   expect(b.routes[0].calls).toHaveLength(12)
   expect(b.routes[0].calls.map(c => [c.arrival, c.departure])).toEqual(leg.calls.map(c => [c.arrival, c.departure]))
   expect(b.routes[0].route).toEqual(full.routes[0].route)
   expect(b.data).toEqual(full.data)
   expect(b.windows.length).toBeGreaterThan(0)
   expect(b.windows.every(w => w.start >= leg.calls[0].departure && w.end <= leg.calls.at(-1)!.arrival)).toBe(true)
   const calls = b.routes[0].calls
   if (direction === 'ascent') expect(calls[0].progress).toBeGreaterThan(0)
   else expect(calls.at(-1)!.progress).toBeLessThan(1)
   for (const w of b.windows) {
    const time = (w.start + w.end) / 2, p = measuredTerrainPosition(b, time)!, original = measuredTerrainPosition(full, time)!
    expect(p.progress).toBe(original.progress)
    expect(p.mask).toBeUndefined()
    expect(railPoint(p.route.points, railSamples(p.route.points), p.progress)).toEqual(railPoint(original.route.points, railSamples(original.route.points), original.progress))
   }
   for (const time of [c.transfer.arrival, (c.transfer.arrival + c.transfer.departure) / 2, c.end]) expect(measuredTerrainPosition(b, time)).toBeUndefined()
   const funiTime = direction === 'ascent' ? c.start + 60 : c.transfer.departure + 60
   expect(measuredTerrainPosition(b, funiTime)).toBeUndefined()
  }
 })
 it('preserves outdoor dwells and masks and stops downhill terrain at Glion arrival', () => {
  const up = bindGlionTerrain(terrain, f, r, '.ojp-91-37-F.1.TA.45.j26')!
  expect(measuredTerrainPosition(up, 42960)?.stopped).toBe(true)
  expect(measuredTerrainPosition(up, 43080)?.progress).toBe(measuredTerrainPosition(up, 42960)?.progress)
  expect(measuredTerrainPosition(up, 43650)?.mask?.reason).toBe('covered')
  expect(measuredTerrainPosition(up, 44200)?.mask?.reason).toBe('tunnel')
  const down = bindGlionTerrain(terrain, f, r, '.ojp-91-37-F.1.TA.89.j26')!
  expect(down.routes[0].calls.at(-1)).toMatchObject({arrival: 47400, departure: 47460})
  expect(measuredTerrainPosition(down, 47400)).toBeUndefined()
  expect(down.windows.every(w => w.end <= 47400)).toBe(true)
 })
 it('rejects unauthorised directions, changed source pairs and malformed terrain', () => {
  const up = '.ojp-91-37-F.1.TA.45.j26', down = '.ojp-91-37-F.1.TA.89.j26'
  const changed = structuredClone(terrain)
  changed.routes[0].reverseTripIds = []
  expect(bindGlionTerrain(changed, f, r, down)).toBeUndefined()
  expect(bindGlionTerrain(terrain, f, r, 'unknown')).toBeUndefined()
  expect(bindGlionTerrain(terrain, {...f, metadata: {...f.metadata, serviceDate: '2026-09-05'}}, r, up)).toBeUndefined()
  const badRail = structuredClone(railway)
  badRail.trains.find(t => t.id === up)!.stops[4][1]++
  expect(bindGlionTerrain(terrain, f, badRail as unknown as NetworkSnapshot, up)).toBeUndefined()
  for (const value of [null, {}, {...terrain, metadata: {...terrain.metadata, timetableSha256: 'changed'}}, {...terrain, terrain: {...terrain.terrain, elevations: []}}]) expect(bindGlionTerrain(value, f, r, up)).toBeUndefined()
 })
})
