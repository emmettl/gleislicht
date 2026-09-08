import { describe, expect, it } from 'vitest'
import type { CorridorSnapshot } from '@motionstudies/core/domain/corridor'
import type { NetworkSnapshot, NetworkTrain } from '@motionstudies/core/domain/network'
import {
  isZurichChurTrain,
  isVitznauRigiTrain,
  journeyForSwissCorridor,
  swissCorridorProgressForTime,
  vehicleKindForSwissCorridor,
} from './switzerland-corridors.ts'

const train: NetworkTrain = {
  id: 'ic3',
  route: 'IC3',
  shortName: '557',
  headsign: 'Chur',
  category: 'intercity',
  start: 100,
  end: 3700,
  stops: [[0, 100, 100], [1, 1900, 1910], [2, 3700, 3700]],
}

const network = {
  stops: [[8.5, 47.3, 'Zürich HB'], [9.4, 47, 'Sargans'], [9.5, 46.8, 'Chur']],
} as unknown as NetworkSnapshot

const corridor = {
  id: 'zurich-chur',
  route: {
    service: 'IR35',
    representativeTrain: '2353',
    destination: 'Chur',
    operator: 'SBB CFF FFS',
    distanceMetres: 116000,
    points: [],
    stops: [
      { name: 'Zürich HB', progress: 0, departure: 100 },
      { name: 'Sargans', progress: 0.78, departure: 310 },
      { name: 'Chur', progress: 1, departure: 500 },
    ],
  },
} as unknown as CorridorSnapshot

describe('Swiss terrain corridor journey', () => {
  it('assigns distinct vehicles to rail and PostBus corridors', () => {
    expect(vehicleKindForSwissCorridor(corridor)).toBe('train')
    expect(vehicleKindForSwissCorridor({ id: 'kiental-griesalp' })).toBe('bus')
  })

  it('recognises only Zürich-to-Chur services in travel order', () => {
    expect(isZurichChurTrain(train, network)).toBe(true)
    expect(
      isZurichChurTrain({ ...train, stops: [...train.stops].reverse() }, network),
    ).toBe(false)
  })

  it('adapts the corridor card to the selected service', () => {
    const journey = journeyForSwissCorridor(corridor, train, network)
    expect(journey.service).toBe('IC3')
    expect(journey.stops[1]).toMatchObject({ name: 'Sargans', progress: 0.78 })
    expect(journey.speedKmh).toBe(116)
  })

  it('starts the descent near the selected timetable moment', () => {
    expect(swissCorridorProgressForTime(train, network, 1900)).toBeCloseTo(0.5)
    expect(swissCorridorProgressForTime(train, network, 0)).toBe(0.015)
  })

  it('uses only a complete uphill Rigi run and preserves its source stop times', () => {
    const rigiNetwork = { stops: [[8.48, 47.0, 'Vitznau'], [8.46, 47.04, 'Rigi Staffel'], [8.48, 47.06, 'Rigi Kulm']] } as unknown as NetworkSnapshot
    const rigi = { ...corridor, id: 'vitznau-rigi', route: { ...corridor.route, destination: 'Rigi Kulm', service: '82', stops: [{ name: 'Vitznau', progress: 0, departure: 100 }, { name: 'Rigi Staffel', progress: 0.88, departure: 300 }, { name: 'Rigi Kulm', progress: 1, departure: 500 }] } }
    const selected = { ...train, route: '82', stops: [[0, 100, 120], [1, 400, 460], [2, 900, 920]] } as NetworkTrain
    expect(isVitznauRigiTrain(selected, rigiNetwork)).toBe(true)
    expect(isVitznauRigiTrain({ ...selected, stops: [...selected.stops].reverse() }, rigiNetwork)).toBe(false)
    expect(isVitznauRigiTrain({ ...selected, stops: selected.stops.slice(1) }, rigiNetwork)).toBe(false)
    expect(vehicleKindForSwissCorridor(rigi)).toBe('cogwheel')
    const journey = journeyForSwissCorridor(rigi, selected, rigiNetwork)
    expect(journey.destination).toBe('Rigi Kulm')
    expect(journey.stops[1]).toEqual({ name: 'Rigi Staffel', progress: 0.88, departure: '00:07' })
    expect(journey.stops.at(-1)?.departure).toBe('00:15') // Arrival, not terminal departure.
    expect(journeyForSwissCorridor(rigi, train, network).service).toBe('82')
  })
})
