import { readFileSync } from 'node:fs'
import type { NetworkTrain } from '@motionstudies/core/domain/network'
import { expect, it } from 'vitest'
import { createActiveTrainCounter, orderTrainSearchMatches, trainSearchResults } from '../src/studies/network-ui-index'

const postbus: NetworkTrain[] = JSON.parse(readFileSync('public/data/postbus-national-day-chunks/06-09.json', 'utf8')).trains
const rail: NetworkTrain[] = JSON.parse(readFileSync('public/data/swiss-rail-morning.json', 'utf8')).trains
const count = (trains: readonly NetworkTrain[], time: number) => trains.reduce((n, train) =>
  train.realtime?.status !== 'cancelled' && train.start <= time && train.end >= time ? n + 1 : n, 0)
const search = (trains: readonly NetworkTrain[], time: number, locale: string) => [...trains].sort((a, b) =>
  Number(!(a.start <= time && a.end >= time)) - Number(!(b.start <= time && b.end >= time)) ||
  a.start - b.start || a.route.localeCompare(b.route, locale)).slice(0, 8)

it('counts exact arrival/departure boundaries, cancellations and malformed intervals', () => {
  const intervals = [[10, 20], [20, 30], [20, 20], [30, 10], [NaN, 20], [-Infinity, Infinity]]
  const trains = intervals.map(([start, end], i) => ({ ...rail[0], id: String(i), start, end }))
  trains.push({ ...rail[0], start: 0, end: 100, realtime: { ...rail[0].realtime, status: 'cancelled' } } as NetworkTrain)
  const indexed = createActiveTrainCounter(trains)
  for (const time of [-Infinity, 0, 9.999, 10, 19.999, 20, 20.001, 30, Infinity, NaN]) {
    expect(indexed(time), String(time)).toBe(count(trains, time))
  }
  expect(createActiveTrainCounter([])(20)).toBe(0)
})

it('matches linear counts through real timetables, selection subsets and backwards seeks', () => {
  for (const trains of [postbus, rail, rail.filter(train => train.category === 'intercity')]) {
    const indexed = createActiveTrainCounter(trains)
    const times = trains.slice(0, 30).flatMap(train => [train.start - .001, train.start, train.end, train.end + .001])
    times.push(0, 86400, 27900, 62100, 3600)
    for (const time of times.reverse()) expect(indexed(time), String(time)).toBe(count(trains, time))
  }
})

it('preserves active-first search ordering, locale ties and original input order', () => {
  const trains = Array.from({ length: 30 }, (_, i) => ({ ...rail[0], id: String(i), start: i % 3 * 10,
    end: 20 + i % 5 * 10, route: ['Zürich', 'Zurich', 'IC2', 'IC10', 'Évian'][i % 5] }))
  for (const locale of ['en-CH', 'de-CH', 'fr-CH', 'it-CH']) {
    const ordered = orderTrainSearchMatches(trains, locale)
    for (const time of [0, 10, 20, 20.001, 40, 100, 10, NaN]) {
      expect(trainSearchResults(ordered, time).map(train => train.id)).toEqual(search(trains, time, locale).map(train => train.id))
    }
  }
  expect(trains.map(train => train.id)).toEqual(Array.from({ length: 30 }, (_, i) => String(i)))
  expect(trainSearchResults([], 0)).toEqual([])
  expect(trainSearchResults([trains[0]], 100)).toEqual([trains[0]])
})

it('matches the previous search on real PostBus and rail schedules', () => {
  for (const source of [postbus, rail]) {
    const matches = source.filter(train => `${train.id} ${train.route}`.includes('1'))
    const ordered = orderTrainSearchMatches(matches, 'de-CH')
    for (const time of [0, 21600, 24300, 27900, 28800, 31500, 62100, 86400, 25000]) {
      expect(trainSearchResults(ordered, time).map(train => train.id)).toEqual(search(matches, time, 'de-CH').map(train => train.id))
    }
  }
})
