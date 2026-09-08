import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rigiSequences } from '../src/studies/rigi-sequence.ts'
import { bindRigiTerrain, rigiTerrainPosition, advanceRigiTerrainClock } from '../src/studies/rigi-timetable-terrain.ts'
const read = file => JSON.parse(readFileSync(new URL(`../public/data/${file}`, import.meta.url)))
const n = read('rigi-day.json'), c = read('vitznau-rigi-corridor.json')
const noon = route => rigiSequences(n, route).find(s => s.start === 43920)
const b = bindRigiTerrain(c, n, noon('vitznau'))

describe('Rigi terrain on the timetable clock', () => {
  it('holds station dwells and interpolates movement between the selected service calls', () => {
    const p = c.route.stops.find(s => s.name === 'Rigi Kaltbad-First').progress
    for (const time of [48780, 48840, 48900]) expect(rigiTerrainPosition(b, time)).toMatchObject({ progress: p, stopped: true })
    expect(rigiTerrainPosition(b, 48960).progress).toBeCloseTo((p + c.route.stops[6].progress) / 2)
    expect(rigiTerrainPosition(b, 47700).progress).toBe(0)
    expect(rigiTerrainPosition(b, 49620).progress).toBe(1)
    expect(rigiTerrainPosition(b, 48840).progress).toBe(p) // Seeking back after completion has no playback history.
  })
  it('starts the Weggis railway leg at Kaltbad, on its own service timetable', () => {
    const s = noon('weggis'), binding = bindRigiTerrain(c, n, s)
    expect(s.departure).toBe(52500)
    expect(rigiTerrainPosition(binding, s.departure)).toMatchObject({ from: 'Rigi Kaltbad-First', stopped: true })
    expect(rigiTerrainPosition(binding, s.departure).progress).toBeCloseTo(0.656633)
    expect(rigiTerrainPosition(binding, s.end).progress).toBe(1)
  })
  it('rejects a different approach, changed source metadata, unmatched stops and nonmonotonic times', () => {
    expect(bindRigiTerrain(read('arth-goldau-rigi-corridor.json'), n, noon())).toBeUndefined()
    const changed = structuredClone(c); changed.metadata.railSource.serviceDate = 'other'
    expect(bindRigiTerrain(changed, n, noon())).toBeUndefined()
    const missing = structuredClone(c); missing.route.stops.splice(3, 1)
    expect(bindRigiTerrain(missing, n, noon())).toBeUndefined()
    const s = structuredClone(noon()); s.rail.stops[2][1] = s.rail.stops[0][1]
    expect(bindRigiTerrain(c, n, s)).toBeUndefined()
  })
  it('honours playback rate, caps background gaps and stops exactly at the summit', () => {
    expect(advanceRigiTerrainClock(48000, .25, 4, 49620)).toBe(48001)
    expect(advanceRigiTerrainClock(48000, 30, 4, 49620)).toBe(48001)
    expect(advanceRigiTerrainClock(49619, .25, 64, 49620)).toBe(49620)
  })
})
