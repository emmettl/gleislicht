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

describe('Weggis cableway approach', () => {
  const choices = rigiSequences(network, 'weggis'), noon = choices.find(s => s.start === 43920)
  it('keeps the two longer waits and boards the railway at its intermediate Kaltbad stop', () => {
    expect(choices).toHaveLength(10)
    expect(noon).toMatchObject({ arrival: 46380, departure: 52500, end: 53220, cable: { departure: 49200, arrival: 49800 } })
    expect(noon.cable.train.shortName).toBe('10025')
    expect(noon.rail.shortName).toBe('1139')
    expect(noon.rail.start).toBe(51300) // 14:15 Vitznau; we only board at 14:35.
    expect(choices.every(s => s.cable.departure - s.arrival === 47 * 60 && s.departure - s.cable.arrival === 45 * 60)).toBe(true)
    expect(sequenceFocus(noon, 'cable').trainId).toBe(noon.cable.train.id)
    expect(sequenceFocus(noon, 'kaltbad')).toEqual({ trainId: undefined, station: 'Rigi Kaltbad (Luftseilbahn)' })
  })
  it('uses 20 minutes uphill at Weggis, including the exact boundary, instead of the 15-minute reverse rule', () => {
    const earlierCable = 47400
    for (const gap of [900, 1199, 1200]) {
      const n = read(), b = n.trains.find(t => t.id === noon.boat.id)
      b.stops.find(s => n.stops[s[0]][2] === 'Weggis')[1] = earlierCable - gap
      const result = rigiSequences(n, 'weggis').find(s => s.id === noon.id)
      expect(result.cable.departure).toBe(gap === 1200 ? earlierCable : 49200)
    }
  })
  it('requires five minutes between the cableway arrival and railway departure', () => {
    for (const gap of [299, 300]) {
      const n = read(), c = n.trains.find(t => t.id === noon.cable.train.id)
      c.stops.at(-1)[1] = noon.departure - gap
      const result = rigiSequences(n, 'weggis').find(s => s.id === noon.id)
      if (gap === 300) expect(result.rail.id).toBe(noon.rail.id)
      else expect(result?.rail.id).not.toBe(noon.rail.id)
    }
  })
  it('resolves all five stages in either direction, without following the railway before boarding', () => {
    for (const [time, phase] of [[43919, 'before'], [43920, 'boat'], [46379, 'boat'], [46380, 'interchange'], [49199, 'interchange'], [49200, 'cable'], [49799, 'cable'], [49800, 'kaltbad'], [52499, 'kaltbad'], [52500, 'rail'], [53220, 'complete'], [51300, 'kaltbad'], [49200, 'cable'], [46380, 'interchange'], [43920, 'boat']]) expect(sequencePhase(noon, time)).toBe(phase)
  })
  it('rejects unsupported cable service, unknown interchange stop identities and changed dates', () => {
    for (const patch of [{ pathSegments: [] }, { frequency: { exactTimes: 0 } }, { routeType: 3 }]) {
      const n = read(); for (const t of n.trains.filter(t => t.routeType === 1300)) Object.assign(t, patch)
      expect(rigiSequences(n, 'weggis')).toEqual([])
    }
    const n = read(); n.stops = n.stops.map(s => s[2] === 'Rigi Kaltbad-First' ? [...s.slice(0, 4), 'unknown'] : s)
    expect(rigiSequences(n, 'weggis')).toEqual([])
    const changed = read(); changed.metadata.serviceDate = '2026-09-05'
    expect(rigiSequences(changed, 'weggis')).toEqual([])
  })
})
