import { describe, expect, it } from 'vitest'
import type { NetworkTrain } from './network.ts'
import { buildTrainTimeIndex, trainsNearTime } from './train-time-index.ts'

function train(id: string, start: number, end: number): NetworkTrain {
  return {
    id,
    route: 'IC',
    headsign: 'Somewhere',
    shortName: id,
    category: 'intercity',
    start,
    end,
    stops: [
      [0, start, start],
      [1, end, end],
    ],
  }
}

describe('train time index', () => {
  it('returns only trips near the current time bucket', () => {
    const morning = train('morning', 300, 900)
    const evening = train('evening', 3_900, 4_500)
    const index = buildTrainTimeIndex(
      [morning, evening],
      0,
      7_200,
      0,
      900,
    )

    expect(trainsNearTime(index, 450)).toEqual([morning])
    expect(trainsNearTime(index, 4_000)).toEqual([evening])
  })

  it('uses padding to retain recent trips for trails', () => {
    const departure = train('departure', 900, 1_050)
    const index = buildTrainTimeIndex([departure], 0, 3_600, 180, 900)

    expect(trainsNearTime(index, 800)).toContain(departure)
    expect(trainsNearTime(index, 1_100)).toContain(departure)
  })

  it('clamps the exact end of the day to the final bucket', () => {
    const night = train('night', 85_800, 86_400)
    const index = buildTrainTimeIndex([night], 0, 86_400)

    expect(trainsNearTime(index, 86_400)).toContain(night)
  })
})
