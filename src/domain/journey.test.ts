import { describe, expect, it } from 'vitest'
import { positionOnJourney, prototypeJourney } from './journey.ts'

describe('positionOnJourney', () => {
  it('finds the active leg and its local progress', () => {
    const result = positionOnJourney(prototypeJourney, 0.28)

    expect(result.previous.name).toBe('Thalwil')
    expect(result.next.name).toBe('Pfäffikon SZ')
    expect(result.legProgress).toBeCloseTo(0.5)
  })

  it('clamps progress outside the route', () => {
    expect(positionOnJourney(prototypeJourney, -1).legProgress).toBe(0)
    expect(positionOnJourney(prototypeJourney, 2).next.name).toBe('Chur')
  })
})

