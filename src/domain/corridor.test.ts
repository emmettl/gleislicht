import { describe, expect, it } from 'vitest'
import {
  corridorProgressForTime,
  isZurichChurTrain,
  journeyForCorridor,
  type CorridorSnapshot,
} from './corridor.ts'
import type { NetworkSnapshot, NetworkTrain } from './network.ts'

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

describe('terrain corridor journey', () => {
  it('recognises only Zürich-to-Chur services in travel order', () => {
    expect(isZurichChurTrain(train, network)).toBe(true)
    expect(
      isZurichChurTrain({ ...train, stops: [...train.stops].reverse() }, network),
    ).toBe(false)
  })

  it('adapts the corridor card to the selected service', () => {
    const journey = journeyForCorridor(corridor, train, network)
    expect(journey.service).toBe('IC3')
    expect(journey.stops[1]).toMatchObject({ name: 'Sargans', progress: 0.78 })
    expect(journey.speedKmh).toBe(116)
  })

  it('starts the descent near the selected timetable moment', () => {
    expect(corridorProgressForTime(train, network, 1900)).toBeCloseTo(0.5)
    expect(corridorProgressForTime(train, network, 0)).toBe(0.015)
  })
})
