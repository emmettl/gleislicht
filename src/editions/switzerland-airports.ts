import type { StudyAirport } from '@motionstudies/core/domain/airport.ts'

// Primary gateways in the national Luftraum composition. The deliberately
// compact catalogue keeps pinned labels legible at the national map scale.
export const SWITZERLAND_AIRPORTS = [
  {
    id: 'zurich',
    name: 'Zürich Airport',
    city: 'Zürich',
    mapLabel: 'Zürich',
    iata: 'ZRH',
    icao: 'LSZH',
    longitude: 8.54917,
    latitude: 47.46472,
    approachRadiusKilometres: 6,
    maximumApproachAltitudeFeet: 7_000,
  },
  {
    id: 'geneva',
    name: 'Genève Aéroport',
    city: 'Genève',
    mapLabel: 'Genève',
    iata: 'GVA',
    icao: 'LSGG',
    longitude: 6.10895,
    latitude: 46.2381,
    approachRadiusKilometres: 6,
    maximumApproachAltitudeFeet: 7_000,
  },
  {
    id: 'basel',
    name: 'EuroAirport Basel Mulhouse Freiburg',
    city: 'Basel',
    mapLabel: 'Basel',
    iata: 'BSL',
    icao: 'LFSB',
    longitude: 7.52917,
    latitude: 47.58958,
    approachRadiusKilometres: 6,
    maximumApproachAltitudeFeet: 7_000,
  },
] as const satisfies readonly StudyAirport[]
