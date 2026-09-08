import { describe, expect, it } from 'vitest'
import { activeAirTracks, type AirEndpoint, type AirSnapshot, type AirTrack } from '@motionstudies/core/domain/air'
import { airTrafficSummary } from './air-traffic-summary.ts'

const airport = (icao: string): AirEndpoint => ({
  icao, iata: '', name: icao, city: '', time: 0, evidence: 'observed-endpoint',
})
const track = (id: string, origin?: string, destination?: string): AirTrack => ({
  id, callsign: id, start: 0, end: 30,
  origin: origin ? airport(origin) : undefined,
  destination: destination ? airport(destination) : undefined,
  samples: [[0, 8, 47, 30000, 400], [30, 8.1, 47.1, 30000, 400]],
})

describe('air traffic summary', () => {
  it('counts distinct airports while including aircraft with unknown routes in the total', () => {
    expect(airTrafficSummary([
      track('a', 'LSZH', 'EGLL'), track('b', 'LSZH', 'LFPG'),
      track('c', 'LSGG', 'EGLL'), track('d'), track('e', 'LSGG'),
    ])).toEqual({ aircraft: 5, origins: 2, destinations: 2 })
    expect(airTrafficSummary([track('unknown')])).toEqual({ aircraft: 1, origins: 0, destinations: 0 })
  })

  it('follows visible aircraft through playback and excludes gaps in observed tracks', () => {
    const snapshot: AirSnapshot = {
      metadata: {
        publisher: 'Test', serviceDate: '2026-09-04', windowStart: 0, windowEnd: 120,
        sourceUrl: '', license: '', licenseUrl: '', model: '', note: '', sampleIntervalSeconds: 30,
      },
      bounds: { minLongitude: 8, maxLongitude: 9, minLatitude: 47, maxLatitude: 48 },
      tracks: [
      track('visible', 'LSZH', 'EGLL'),
      { ...track('later', 'LSGG', 'LFPG'), start: 60, end: 90,
        samples: [[60, 8, 47, 30000, 400], [90, 8.1, 47.1, 30000, 400]] },
      { ...track('gap', 'EDDF', 'LEMD'), end: 90,
        samples: [[0, 8, 47, 30000, 400], [90, 8.1, 47.1, 30000, 400]] },
    ] }
    expect(airTrafficSummary(activeAirTracks(snapshot, 15))).toEqual({ aircraft: 1, origins: 1, destinations: 1 })
    expect(airTrafficSummary(activeAirTracks(snapshot, 75))).toEqual({ aircraft: 1, origins: 1, destinations: 1 })
    expect(airTrafficSummary(activeAirTracks(snapshot, 100))).toEqual({ aircraft: 0, origins: 0, destinations: 0 })
  })
})
