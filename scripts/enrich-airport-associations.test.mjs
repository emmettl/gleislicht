import { describe, expect, it } from 'vitest'
import { airportIdsForTrack } from './enrich-airport-associations.mjs'

const airports = [
  {
    id: 'city',
    longitude: 0.0553,
    latitude: 51.5053,
    approachRadiusKilometres: 4,
    maximumApproachAltitudeFeet: 6_000,
  },
]

describe('air artifact airport association', () => {
  it('bakes only a low-altitude track inside the approach envelope', () => {
    expect(
      airportIdsForTrack(
        {
          samples: [
            [100, 0.06, 51.51, 3_000, 150],
            [110, 0.05, 51.5, 2_000, 130],
          ],
        },
        airports,
      ),
    ).toEqual(['city'])
    expect(
      airportIdsForTrack(
        { samples: [[100, 0.06, 51.51, 18_000, 320]] },
        airports,
      ),
    ).toEqual([])
  })
})
