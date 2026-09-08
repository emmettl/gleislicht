import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rigiDayRhythm, rigiRhythmAt } from '../src/studies/rigi-day-rhythm.ts'
const network = JSON.parse(readFileSync(new URL('../public/data/rigi-day.json', import.meta.url)))
const lanes = rigiDayRhythm(network)

describe('dated Rigi service rhythm', () => {
  it('accounts for all 190 services, including the two partial early Vitznau runs', () => {
    expect(lanes.map(l => [l.id, l.trains.length])).toEqual([['boats', 89], ['vitznau', 28], ['arth', 22], ['cable', 51]])
    expect(new Set(lanes.flatMap(l => l.trains.map(t => t.id))).size).toBe(190)
    expect(lanes.map(l => l.trains[0].start)).toEqual([22800, 23700, 27000, 24000])
    expect(lanes[1].trains[0].headsign).toBe('Rigi Staffelhöhe')
  })
  it('shows quiet hours and actual later departures, with departure inclusive and arrival exclusive', () => {
    for (const lane of lanes) {
      expect(rigiRhythmAt(lane, 0, 86400)).toMatchObject({ active: 0, next: lane.trains[0] })
      expect(rigiRhythmAt(lane, lane.trains[0].start, 86400).active).toBeGreaterThan(0)
    }
    const cable = lanes[3], first = cable.trains[0]
    expect(rigiRhythmAt(cable, first.end, 86400).active).toBe(0)
    expect(rigiRhythmAt(cable, first.end, 86400).next.start).toBeGreaterThan(first.end)
    expect(rigiRhythmAt(cable, 85000, 86400)).toEqual({ active: 0, next: undefined })
    expect(rigiRhythmAt(cable, first.start, 86400).active).toBe(1) // reverse seek
  })
  it('merges overlapping services but preserves each real quiet gap and station dwell', () => {
    for (const lane of lanes) {
      expect(lane.intervals.every(([s, e], i) => s < e && (!i || s > lane.intervals[i - 1][1]))).toBe(true)
      for (let time = 0; time < 86400; time += 30) expect(lane.intervals.some(([s, e]) => s <= time && time < e)).toBe(rigiRhythmAt(lane, time, 86400).active > 0)
    }
    expect(rigiRhythmAt(lanes[1], 48840, 86400).active).toBeGreaterThan(0) // 1133 dwells at Kaltbad
  })
  it('clips the late boat to the study boundary without pretending it finishes at midnight or wrapping tomorrow', () => {
    expect(lanes[0].trains.some(t => t.end === 86520)).toBe(true)
    expect(lanes[0].intervals.at(-1)[1]).toBe(86400)
    expect(rigiRhythmAt(lanes[0], 86399, 86400)).toEqual({ active: 1, next: undefined })
    expect(rigiRhythmAt(lanes[0], 86400, 86400)).toEqual({ active: 0, next: undefined })
  })
  it('does not invent services for an empty scope or unsupported headway and operator evidence', () => {
    const empty = rigiDayRhythm({ ...network, trains: [] })
    expect(empty.every(l => !l.trains.length && !l.intervals.length)).toBe(true)
    const altered = rigiDayRhythm({ ...network, trains: network.trains.map(t => ({ ...t, frequency: { exactTimes: 0 } })) })
    expect(altered.every(l => !l.trains.length)).toBe(true)
    expect(rigiDayRhythm({ ...network, trains: network.trains.map(t => ({ ...t, agencyId: 'unknown' })) }).every(l => !l.trains.length)).toBe(true)
  })
})
