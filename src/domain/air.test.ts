import { describe, expect, it } from 'vitest'
import {
  activeAirTracks,
  headingBetweenSamples,
  positionForAirTrack,
  type AirSnapshot,
  type AirTrack,
} from './air.ts'

const track: AirTrack = {
  id: '4b1801',
  callsign: 'SWR123',
  start: 25_200,
  end: 25_220,
  samples: [
    [25_200, 8.5, 47.4, 10_000, 240],
    [25_210, 8.51, 47.41, 10_500, 242],
    [25_220, 8.52, 47.42, 11_000, 244],
  ],
}

describe('air track replay', () => {
  it('interpolates observed values and derives motion', () => {
    const position = positionForAirTrack(track, 25_205)
    expect(position).toMatchObject({
      altitudeFeet: 10_250,
      groundSpeedKnots: 241,
      verticalRateFeetPerMinute: 3_000,
    })
    expect(position?.longitude).toBeCloseTo(8.505)
    expect(position?.latitude).toBeCloseTo(47.405)
  })

  it('does not bridge observation gaps', () => {
    const sparse = {
      ...track,
      end: 25_300,
      samples: [track.samples[0], [25_300, 8.7, 47.5, 12_000, 250]] as const,
    }
    expect(positionForAirTrack(sparse, 25_250)).toBeUndefined()
  })

  it('uses clockwise headings from north', () => {
    expect(headingBetweenSamples(track.samples[0], track.samples[1])).toBeGreaterThan(0)
    expect(headingBetweenSamples(track.samples[0], track.samples[1])).toBeLessThan(90)
    expect(
      headingBetweenSamples(
        [25_200, 8.5, 47.4, 10_000, 240],
        [25_210, 8.49, 47.41, 10_500, 242],
      ),
    ).toBeGreaterThan(270)
  })

  it('finds tracks active at the shared study time', () => {
    const snapshot = {
      metadata: {},
      bounds: {},
      tracks: [track],
    } as unknown as AirSnapshot
    expect(activeAirTracks(snapshot, 25_210)).toEqual([track])
    expect(activeAirTracks(snapshot, 25_400)).toEqual([])
  })
})
