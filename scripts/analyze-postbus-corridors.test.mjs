import { describe, expect, it } from 'vitest'
import { distanceKilometres } from './analyze-postbus-corridors.mjs'

describe('PostBus corridor measurements', () => {
  it('measures local WGS84 stop distances in kilometres', () => {
    expect(
      distanceKilometres(
        { longitude: 8.3, latitude: 46.8 },
        { longitude: 8.3, latitude: 46.9 },
      ),
    ).toBeCloseTo(11.132, 2)
  })
})
