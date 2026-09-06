import { describe, expect, it } from 'vitest'
import {
  adjacentAirDayChunks,
  airDayChunkForTime,
  airSnapshotForDayChunk,
  type AirDayManifest,
} from './air-day.ts'

const chunks = [0, 1, 2].map((hour) => ({
  id: String(hour).padStart(2, '0'),
  windowStart: hour * 3_600,
  windowEnd: (hour + 1) * 3_600,
  path: `air-${hour}.json`,
  trackCount: 1,
  sampleCount: 2,
}))

const manifest: AirDayManifest = {
  metadata: {
    publisher: 'ADSB.lol',
    serviceDate: '2026-09-04',
    windowStart: 0,
    windowEnd: 10_800,
    sourceUrl: 'https://example.com',
    license: 'ODbL 1.0',
    licenseUrl: 'https://example.com/license',
    model: 'test',
    note: 'test',
    sampleIntervalSeconds: 10,
  },
  bounds: {
    minLongitude: 5,
    minLatitude: 45,
    maxLongitude: 11,
    maxLatitude: 48,
  },
  trackCount: 1,
  sampleCount: 2,
  aircraft: [],
  chunks,
}

describe('progressive air day', () => {
  it('selects exact hourly chunks including the final boundary', () => {
    expect(airDayChunkForTime(manifest, 0).id).toBe('00')
    expect(airDayChunkForTime(manifest, 3_600).id).toBe('01')
    expect(airDayChunkForTime(manifest, 10_800).id).toBe('02')
  })

  it('returns the current chunk and its neighbours for prefetch', () => {
    expect(adjacentAirDayChunks(manifest, chunks[1]).map(({ id }) => id)).toEqual([
      '00',
      '01',
      '02',
    ])
  })

  it('combines static manifest metadata with a loaded hour', () => {
    const track = {
      id: '4b1801',
      callsign: 'SWR18K',
      start: 3_600,
      end: 3_610,
      samples: [
        [3_600, 8.5, 47.4, 20_000, 300],
        [3_610, 8.6, 47.5, 21_000, 310],
      ] as const,
    }
    expect(
      airSnapshotForDayChunk(manifest, {
        windowStart: 3_600,
        windowEnd: 7_200,
        tracks: [track],
      }).tracks,
    ).toEqual([track])
  })
})
