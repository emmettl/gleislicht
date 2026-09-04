import { describe, expect, it } from 'vitest'
import {
  chunkNetworkSnapshot,
  parseBounds,
  parseModes,
  transportModeForRouteType,
} from './ingest-gtfs.mjs'

const compactSnapshot = {
  metadata: { windowStart: 0, windowEnd: 21_600 },
  bounds: {},
  stops: [],
  edges: [],
  trains: [
    { id: 'early', start: 600, end: 1_200 },
    { id: 'boundary', start: 10_700, end: 11_000 },
    { id: 'late', start: 18_500, end: 20_000 },
  ],
}

describe('Swiss GTFS transport modes', () => {
  it('recognises the standard and Swiss extended mode codes', () => {
    expect(transportModeForRouteType('2')).toBe('rail')
    expect(transportModeForRouteType('109')).toBe('rail')
    expect(transportModeForRouteType('900')).toBe('tram')
    expect(transportModeForRouteType('700')).toBe('bus')
    expect(transportModeForRouteType('1000')).toBe('ferry')
    expect(transportModeForRouteType('1300')).toBe('cableway')
    expect(transportModeForRouteType('1400')).toBe('funicular')
  })

  it('parses regional mode and bounds profiles', () => {
    expect([...parseModes('rail,tram,bus')]).toEqual(['rail', 'tram', 'bus'])
    expect(parseBounds('8.45,47.32,8.63,47.44')).toEqual({
      minLongitude: 8.45,
      minLatitude: 47.32,
      maxLongitude: 8.63,
      maxLatitude: 47.44,
    })
  })
})

describe('chunked network snapshots', () => {
  it('keeps topology in a manifest and overlaps boundary-crossing trips', () => {
    const { manifest, chunks } = chunkNetworkSnapshot(
      compactSnapshot,
      10_800,
      'day-chunks',
    )

    expect(manifest.tripCount).toBe(3)
    expect(manifest.chunks.map((chunk) => chunk.path)).toEqual([
      'day-chunks/00-03.json',
      'day-chunks/03-06.json',
    ])
    expect(chunks[0].payload.trains.map((train) => train.id)).toEqual([
      'early',
      'boundary',
    ])
    expect(chunks[1].payload.trains.map((train) => train.id)).toEqual([
      'boundary',
      'late',
    ])
  })
})
