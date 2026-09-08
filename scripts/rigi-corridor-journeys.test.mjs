import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { rigiCorridorForTrain, rigiPendingJourney, isRigiCorridorId, journeyForSwissCorridor, vehicleKindForSwissCorridor } from '../src/editions/switzerland-corridors.ts'

it('keeps the two Rigi approaches and their selected timetables separate', () => {
  const rigiNetwork = JSON.parse(readFileSync(new URL('../public/data/rigi-day.json', import.meta.url), 'utf8'))
  const arth = JSON.parse(readFileSync(new URL('../public/data/arth-goldau-rigi-corridor.json', import.meta.url), 'utf8'))
  const vitznau = JSON.parse(readFileSync(new URL('../public/data/vitznau-rigi-corridor.json', import.meta.url), 'utf8'))
  const fromArth = rigiNetwork.trains.find(t => t.shortName === '145')
  const fromVitznau = rigiNetwork.trains.find(t => t.shortName === '1127')
  expect(rigiCorridorForTrain(fromArth, rigiNetwork)).toBe('arth-goldau-rigi')
  expect(rigiCorridorForTrain(fromVitznau, rigiNetwork)).toBe('vitznau-rigi')
  expect(vehicleKindForSwissCorridor(arth)).toBe('cogwheel')
  expect(isRigiCorridorId('arth-goldau-rigi')).toBe(true)
  expect(isRigiCorridorId('kiental-griesalp')).toBe(false)
  expect(rigiPendingJourney('arth-goldau-rigi').stops[0].name).toBe('Arth-Goldau RB')
  const selected = journeyForSwissCorridor(arth, fromArth, rigiNetwork)
  expect(selected.id).toBe('81-145')
  expect(selected.stops[0]).toMatchObject({ name: 'Arth-Goldau RB', departure: '12:55', progress: 0 })
  expect(selected.stops.at(-1)).toMatchObject({ name: 'Rigi Kulm', departure: '13:34', progress: 1 })
  expect(selected.stops.find(s => s.name === 'Rigi Staffel')?.progress).toBeCloseTo(0.9037)
  expect(journeyForSwissCorridor(vitznau, fromArth, rigiNetwork).id).toBe('82-1127')
  expect(journeyForSwissCorridor(arth, fromVitznau, rigiNetwork).id).toBe('81-139')
  expect(rigiCorridorForTrain({ ...fromArth, stops: [...fromArth.stops].reverse() }, rigiNetwork)).toBeUndefined()
  expect(rigiCorridorForTrain({ ...fromArth, stops: fromArth.stops.slice(1) }, rigiNetwork)).toBeUndefined()
  expect(rigiCorridorForTrain({ ...fromArth, category: 'intercity', routeType: undefined }, rigiNetwork)).toBeUndefined()
})
