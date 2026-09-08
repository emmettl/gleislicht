import { describe, expect, it } from 'vitest'
import { orbitalCoordinate, orbitalIdentity, orbitalTrajectory, ORBITAL_SOURCES } from './build-orbital-study.mjs'

describe('combined orbital dataset', () => {
  it('deduplicates regional wrappers without merging frequency departures or preceding-day runs', () => {
    expect(orbitalIdentity({ id: '2026-09-04:rail-1', sourceServiceDate: '2026-09-04' }, '2026-09-04')).toBe(orbitalIdentity({ id: 'rail-1' }, '2026-09-08'))
    expect(orbitalIdentity({ id: 'service:2026-09-03:rail-1' }, '2026-09-04')).not.toBe('rail-1')
    expect(orbitalIdentity({ id: 'frequency:bus-1:3600' }, '2026-09-04')).not.toBe(orbitalIdentity({ id: 'frequency:bus-1:3900' }, '2026-09-04'))
    expect(orbitalIdentity({ id: 'bus-1:run:500' }, '2026-09-04')).toBe('bus-1')
  })
  it('orients source geometry toward the journey and preserves timetable dwells', () => {
    const a = [8, 47], b = [8.1, 47.1], middle = [8, 47.1]
    const network = { stops: [a, b], paths: [[b, middle, a]] }
    const train = { id: 'test', stops: [[0, 100, 120], [1, 240, 260]], pathSegments: [0] }
    const knots = orbitalTrajectory(train, network)
    expect(knots.slice(0, 6)).toEqual([100, ...orbitalCoordinate(a), 120, ...orbitalCoordinate(a)])
    expect(knots.slice(-6)).toEqual([240, ...orbitalCoordinate(b), 260, ...orbitalCoordinate(b)])
    expect(knots).toContain(orbitalCoordinate(middle)[0])
    const times = knots.filter((_, i) => i % 3 === 0)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
  it('retains direct interpolation where no path is available', () => {
    const network = { stops: [[8, 47], [8.1, 47.1]] }
    expect(orbitalTrajectory({ id: 'fallback', stops: [[0, 0, 0], [1, 60, 60]] }, network)).toEqual([0, ...orbitalCoordinate(network.stops[0]), 60, ...orbitalCoordinate(network.stops[1])])
  })
  it('never adds withheld local archives to public orbital assets', () => {
    expect(ORBITAL_SOURCES.some(s => s.file.includes('st-gallen'))).toBe(false)
    expect(ORBITAL_SOURCES.every(s => !s.file.startsWith('/') && !s.file.includes('..'))).toBe(true)
  })
})
