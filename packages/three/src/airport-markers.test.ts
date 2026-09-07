import { describe, expect, it } from 'vitest'
import type { StudyAirport } from '@motionstudies/core/domain/airport'
import {
  airportLabelsAreVisible,
  airportsForMap,
} from './airport-markers.ts'

const heathrow: StudyAirport = {
  id: 'heathrow',
  name: 'Heathrow Airport',
  city: 'London',
  mapLabel: 'Heathrow',
  iata: 'LHR',
  icao: 'EGLL',
  longitude: -0.4543,
  latitude: 51.47,
  approachRadiusKilometres: 4,
  maximumApproachAltitudeFeet: 6_000,
}

const londonCity: StudyAirport = {
  ...heathrow,
  id: 'london-city',
  name: 'London City Airport',
  mapLabel: 'London City',
  iata: 'LCY',
  icao: 'EGLC',
}

describe('airport map emphasis', () => {
  it('pins the edition airport catalogue while air is isolated', () => {
    expect(airportsForMap([heathrow, londonCity], true)).toEqual([
      heathrow,
      londonCity,
    ])
  })

  it('otherwise keeps only a specifically selected airport visible', () => {
    expect(airportsForMap([heathrow, londonCity], false, heathrow)).toEqual([
      heathrow,
    ])
    expect(airportsForMap([heathrow, londonCity], false)).toEqual([])
  })

  it('respects the explicit labels-off setting', () => {
    expect(airportLabelsAreVisible('auto')).toBe(true)
    expect(airportLabelsAreVisible('on')).toBe(true)
    expect(airportLabelsAreVisible('off')).toBe(false)
  })
})
