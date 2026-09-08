import { describe, expect, it } from 'vitest'
import { createOrbitalTunnelMatcher } from './orbital-tunnels.mjs'

const metre = 12 / 111320
const create = coordinates => createOrbitalTunnelMatcher([{ id: 1, coordinates }], p => p.map(v => v * metre))
const knots = points => points.flatMap(([time, x, z]) => [time, x * metre, z * metre])
describe('mapped orbital tunnels', () => {
  it('locates both portals in either travel direction, with an unsampled short tunnel', () => {
    const matcher = create([[200, 0], [800, 0]])
    expect(matcher.intervals(knots([[0, 0, 0], [100, 1000, 0]]), 1)).toEqual([20, 80])
    expect(matcher.intervals(knots([[0, 1000, 0], [100, 0, 0]]), 1)).toEqual([20, 80])
  })
  it('keeps station dwells underground, including a journey that begins underground', () => {
    const matcher = create([[200, 0], [800, 0]])
    expect(matcher.intervals(knots([[0, 0, 0], [50, 500, 0], [100, 500, 0], [150, 1000, 0]]), 7)).toEqual([20, 130])
    expect(matcher.intervals(knots([[0, 500, 0], [50, 500, 0], [100, 1000, 0]]), 7)).toEqual([0, 80])
    expect(matcher.intervals(knots([[0, 500, 0], [50, 500, 0], [100, 1000, 0]]), 7, 40, 70)).toEqual([40, 70])
  })
  it('leaves roads, cableways, perpendicular crossings and nearby surface rails visible', () => {
    const matcher = create([[200, 0], [800, 0]])
    for (const category of [6, 8, 9, 10, 12]) expect(matcher.intervals(knots([[0, 0, 0], [100, 1000, 0]]), category)).toEqual([])
    expect(matcher.intervals(knots([[0, 500, -500], [100, 500, 500]]), 1)).toEqual([])
    expect(matcher.intervals(knots([[0, 0, 150], [100, 1000, 150]]), 1)).toEqual([])
  })
  it('merges adjoining mapped pieces and shared tracks without dropping a surface gap', () => {
    const matcher = createOrbitalTunnelMatcher([
      { id: 1, coordinates: [[100, 0], [300, 0], [500, 0]] },
      { id: 2, coordinates: [[300, 2], [500, 2]] },
      { id: 3, coordinates: [[700, 0], [900, 0]] },
    ], p => p.map(v => v * metre))
    const ranges = matcher.intervals(knots([[0, 0, 0], [50, 500, 0], [100, 1000, 0]]), 1)
    expect(ranges).toHaveLength(4)
    ranges.forEach((v, i) => expect(v).toBeCloseTo([10, 50, 70, 90][i]))
  })
})

describe('reviewed coarse Alpine passages', () => {
  it('masks the Simplon timetable chord in both directions without widening the ordinary tunnel mask', () => {
    const project = ([lon, lat]) => [(lon - 8.23) * Math.cos(46.8 * Math.PI / 180) * 12, -(lat - 46.8) * 12]
    const matcher = createOrbitalTunnelMatcher([], project, [{ name: 'Simplon', portals: [[8.0072597, 46.3246788], [8.2005954, 46.2077572]] }])
    const a = project([7.990577333, 46.32002124]), b = project([8.20701742, 46.20701])
    const forward = matcher.intervals([0, ...a, 1000, ...b], 3), reverse = matcher.intervals([0, ...b, 1000, ...a], 3)
    expect(forward[0]).toBeCloseTo(33.569, 2)
    expect(forward[1]).toBeCloseTo(978.81, 2)
    expect(reverse[0]).toBeCloseTo(1000 - forward[1], 2)
    expect(reverse[1]).toBeCloseTo(1000 - forward[0], 2)
    expect(matcher.intervals([0, ...a, 1000, ...b], 8)).toEqual([])
    expect(matcher.intervals([0, a[0] + 1, a[1], 1000, b[0] + 1, b[1]], 3)).toEqual([])
  })
})
