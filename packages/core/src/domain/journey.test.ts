import { describe, expect, it } from 'vitest'
import { positionOnJourney, type Journey } from './journey.ts'

const journey: Journey = {
  id: 'test',
  service: 'T',
  destination: 'C',
  operator: 'Test',
  speedKmh: 80,
  stops: [
    { name: 'A', progress: 0, departure: '00:00' },
    { name: 'B', progress: 0.2, departure: '00:10' },
    { name: 'C', progress: 0.4, departure: '00:20' },
    { name: 'D', progress: 1, departure: '00:30' },
  ],
}

describe('positionOnJourney', () => {
  it('finds the active leg and its local progress', () => {
    const result = positionOnJourney(journey, 0.3)

    expect(result.previous.name).toBe('B')
    expect(result.next.name).toBe('C')
    expect(result.legProgress).toBeCloseTo(0.5)
  })

  it('clamps progress outside the route', () => {
    expect(positionOnJourney(journey, -1).legProgress).toBe(0)
    expect(positionOnJourney(journey, 2).next.name).toBe('D')
  })
})
