import { describe, expect, it } from 'vitest'
import type { AirTrack } from './domain/air.ts'
import {
  airTrackSearchValue,
  searchAirTracks,
} from './air-search.ts'

const tracks: readonly AirTrack[] = [
  { id: '4b1801', callsign: 'SWR18K', start: 100, end: 300, samples: [] },
  { id: '4b1802', callsign: 'SWR180', start: 400, end: 600, samples: [] },
  { id: '3c65aa', callsign: 'DLH4XN', start: 100, end: 300, samples: [] },
]

describe('air search', () => {
  it('finds flights by callsign and ICAO address without case sensitivity', () => {
    expect(searchAirTracks(tracks, 'swr18k', 200).map(({ id }) => id)).toEqual([
      '4b1801',
    ])
    expect(searchAirTracks(tracks, '4B1802', 200).map(({ callsign }) => callsign)).toEqual([
      'SWR180',
    ])
  })

  it('ranks exact codes, prefixes and active tracks predictably', () => {
    expect(searchAirTracks(tracks, 'swr', 200).map(({ callsign }) => callsign)).toEqual([
      'SWR18K',
      'SWR180',
    ])
    expect(searchAirTracks(tracks, 'SWR180', 200)[0]?.id).toBe('4b1802')
  })

  it('uses a compact searchable selection value', () => {
    expect(airTrackSearchValue(tracks[0])).toBe('SWR18K · 4B1801')
  })
})
