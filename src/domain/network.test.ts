import { describe, expect, it } from 'vitest'
import { formatServiceTime, positionForTrain, type NetworkTrain } from './network.ts'

const train: NetworkTrain = {
  id: 'test',
  route: 'IC 1',
  headsign: 'St. Gallen',
  shortName: '701',
  start: 100,
  end: 400,
  stops: [
    [0, 100, 110],
    [1, 200, 220],
    [2, 400, 400],
  ],
}

describe('positionForTrain', () => {
  it('interpolates between timed stops', () => {
    expect(positionForTrain(train, 155)).toEqual({
      fromStop: 0,
      toStop: 1,
      progress: 0.5,
    })
  })

  it('holds a train at a station during dwell time', () => {
    expect(positionForTrain(train, 210)).toEqual({
      fromStop: 1,
      toStop: 1,
      progress: 0,
    })
  })

  it('omits inactive trains', () => {
    expect(positionForTrain(train, 99)).toBeUndefined()
    expect(positionForTrain(train, 401)).toBeUndefined()
  })
})

describe('formatServiceTime', () => {
  it('formats service-day seconds', () => {
    expect(formatServiceTime(7 * 3600 + 45 * 60)).toBe('07:45')
  })
})

