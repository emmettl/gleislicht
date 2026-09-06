import { describe, expect, it } from 'vitest'
import type { AirTrack } from './air.ts'
import {
  airTrackServesAirport,
  airportAirTrackIds,
  searchAirports,
  type StudyAirport,
} from './airport.ts'

const airport: StudyAirport = {
  id: 'heathrow',
  name: 'Heathrow Airport',
  city: 'London',
  iata: 'LHR',
  icao: 'EGLL',
  longitude: -0.4543,
  latitude: 51.47,
  approachRadiusKilometres: 4,
  maximumApproachAltitudeFeet: 6_000,
}

const approach: AirTrack = {
  id: 'approach',
  callsign: 'BAW123',
  start: 100,
  end: 110,
  samples: [
    [100, -0.49, 51.47, 4_000, 150],
    [110, -0.46, 51.47, 1_500, 130],
  ],
}

describe('airport search and association', () => {
  it('finds an airport by name, IATA or ICAO code', () => {
    expect(searchAirports([airport], 'heathrow')).toEqual([airport])
    expect(searchAirports([airport], 'lhr')).toEqual([airport])
    expect(searchAirports([airport], 'egll')).toEqual([airport])
  })

  it('accepts a low approach and rejects a high overflight', () => {
    expect(airTrackServesAirport(approach, airport)).toBe(true)
    expect(
      airTrackServesAirport(
        {
          ...approach,
          id: 'overflight',
          samples: approach.samples.map(
            ([time, longitude, latitude, , speed]) =>
              [time, longitude, latitude, 20_000, speed] as const,
          ),
        },
        airport,
      ),
    ).toBe(false)
  })

  it('uses baked associations when the current chunk is away from the airport', () => {
    const continued = {
      ...approach,
      id: 'continued',
      airportIds: ['heathrow'],
      samples: [[100, 0.2, 51.6, 20_000, 300]] as const,
    }
    expect(airportAirTrackIds([continued], airport)).toEqual(
      new Set(['continued']),
    )
  })
})
