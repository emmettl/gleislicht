import {describe, expect, it} from 'vitest'
import type {NetworkSnapshot} from '@motionstudies/core/domain/network'
import funicular from '../public/data/territet-day.json'
import railway from '../public/data/rochers-day.json'
import terrain from '../public/data/rochers-ascent-terrain.json'
import {glionJourneys} from '../src/studies/glion.ts'
import {bindGlionTerrain} from '../src/studies/glion-terrain.ts'
import {bindRochersTerrain} from '../src/studies/rochers-terrain.ts'
import {measuredTerrainPosition, railPoint, railSamples} from '../src/studies/measured-terrain.ts'
const f = funicular as unknown as NetworkSnapshot, r = railway as unknown as NetworkSnapshot

describe('Glion combined railway terrain', () => {
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
