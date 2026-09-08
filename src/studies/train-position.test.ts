import { expect, it } from 'vitest'
import { positionForTrain as original, type NetworkSnapshot, type NetworkTrain } from '@motionstudies/core/domain/network'
import rail from '../../public/data/swiss-rail-morning.json'
import zurich from '../../public/data/zurich-city-morning.json'
import geneva from '../../public/data/geneva-tpg-morning.json'
import { positionForTrain } from './train-position'

it('matches the installed renderer at arrivals, departures, dwells and seeks in real schedules', () => {
  for (const data of [rail, zurich, geneva]) {
    const snapshot = data as unknown as NetworkSnapshot
    for (const train of snapshot.trains.filter((_, index) => index % 37 === 0)) {
      const times = [train.start - 1, train.end + 1, ...train.stops.flatMap(stop =>
        [stop[1] - 0.01, stop[1], stop[1] + 0.01, stop[2] - 0.01, stop[2], stop[2] + 0.01])]
      // Descending order also exercises backwards scrubbing and trail samples.
      for (const time of times.sort((a, b) => b - a)) {
        expect(positionForTrain(train, time)).toEqual(original(train, time))
      }
    }
  }
})

it('preserves cancellation, duplicate timestamps, nonchronological stops and schedule replacement', () => {
  const train: NetworkTrain = { id: 'test', route: 'R', shortName: 'R', headsign: '', category: 'regional', start: 0, end: 40,
    stops: [[0, 0, 5], [1, 10, 10], [2, 10, 10], [3, 20, 25]] }
  const variants: NetworkTrain[] = [train,
    { ...train, stops: [[0, 0, 10], [1, 5, 8], [2, 7, 20]] },
    { ...train, stops: [[0, 0, 1]] },
    { ...train, stops: [[0, 0, 2], [1, 4, 6]] },
    { ...train, realtime: { status: 'cancelled', delaySeconds: 0, skippedStops: 0, generatedAt: '' } }]
  for (const variant of variants) for (const time of [-1, 0, 1, 5, 8, 10, 15, 20, 25, 30, 40, 41, NaN]) {
    expect(positionForTrain(variant, time)).toEqual(original(variant, time))
  }
})
