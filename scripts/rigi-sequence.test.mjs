import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rigiSequences, sequencePhase, sequenceFocus } from '../src/studies/rigi-sequence.ts'
const read = () => JSON.parse(readFileSync(new URL('../public/data/rigi-day.json', import.meta.url)))
const network = read(), choices = rigiSequences(network), noon = choices.find(s => s.start === 43920)

describe('source-backed lake-to-summit sequences', () => {
  it('pairs ten dated departures with the first eligible uphill train, excluding the 116-minute evening gap', () => {
    expect(choices).toHaveLength(10)
    expect(choices.every(s => s.departure - s.arrival === 360)).toBe(true)
    expect(noon).toMatchObject({ start: 43920, arrival: 47340, departure: 47700, end: 49620 })
    expect(noon.boat.end).toBeGreaterThan(noon.end) // The boat continues to Flüelen after we alight.
    expect(noon.rail.shortName).toBe('1133')
  })
  it('hands off exactly at arrival/departure and supports backward scrubbing without history', () => {
    for (const [time, phase] of [[43919, 'before'], [43920, 'boat'], [47339, 'boat'], [47340, 'interchange'], [47699, 'interchange'], [47700, 'rail'], [49619, 'rail'], [49620, 'complete'], [47340, 'interchange'], [43920, 'boat']]) expect(sequencePhase(noon, time)).toBe(phase)
    expect(sequenceFocus(noon, 'interchange')).toEqual({ trainId: undefined, station: 'Vitznau' })
    expect(sequenceFocus(noon, 'complete')).toEqual({ trainId: undefined, station: 'Rigi Kulm' })
  })
  it('fails closed for a new source/date and skips missing geometry or unexpected frequency service', () => {
    for (const key of ['feedVersion', 'serviceDate']) { const n = read(); n.metadata[key] = 'changed'; expect(rigiSequences(n)).toEqual([]) }
    const n = read(); n.metadata.sources.timetable.sha256 = 'changed'; expect(rigiSequences(n)).toEqual([])
    for (const patch of [{ pathSegments: [] }, { frequency: { exactTimes: 0 } }, { agencyId: 'different' }, { routeType: 3 }]) {
      const altered = read(); Object.assign(altered.trains.find(t => t.id === noon.boat.id), patch)
      expect(rigiSequences(altered).some(s => s.id === noon.id)).toBe(false)
    }
  })
  it('enforces the 60-second minimum including the exact boundary', () => {
    for (const gap of [59, 60]) {
      const n = read(), b = n.trains.find(t => t.id === noon.boat.id)
      b.stops.find(s => n.stops[s[0]][4] === 'ch:1:sloid:8464')[1] = noon.departure - gap
      const candidate = rigiSequences(n).find(s => s.id === noon.id)
      if (gap === 60) expect(candidate.rail.id).toBe(noon.rail.id)
      else expect(candidate?.rail.id).not.toBe(noon.rail.id)
    }
  })
  it('does not turn a return boat or a partial railway journey into an ascent', () => {
    const n = read(); n.trains = n.trains.map(t => t.routeType === 116 ? { ...t, stops: t.stops.slice(1), pathSegments: t.pathSegments.slice(1) } : t)
    expect(rigiSequences(n)).toEqual([])
  })
})
