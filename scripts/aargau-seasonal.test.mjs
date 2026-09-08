import { expect, test } from 'vitest'
import { applyAargauGeometry } from './build-aargau-study.mjs'
import { summarizeSeasonalGeometry, seasonalRouteInventory, assertPriorGeometryPreserved } from './aargau-seasonal.mjs'
import { symmetricVertexSeparation } from './review-aargau-alignments.mjs'

test('seasonal coverage retains repeated loop occurrences and incomplete journeys', () => {
  const raw = { metadata: { feed: {}, serviceDate: '2026-01-16' }, stops: [[8, 47, 'A', '', 'a'], [8.01, 47, 'B', '', 'b']],
    trains: [0, 1].map(i => ({ id: `t${i}`, routeId: 'r', agencyId: 'x', route: '1', category: 'bus', directionId: '0', calls: [['a', 0, 0, '0', '0'], ['b', 60, 60, '0', '0'], ['a', 120, 120, '0', '0']] })) }
  const roads = { matchPattern: () => [{ path: [[8, 47], [8.01, 47]], geometrySource: 'osm' }, { roadFailure: 'unmatched-road' }] }
  const result = applyAargauGeometry(raw, new Map(), ['a'], roads)
  const day = summarizeSeasonalGeometry(result, '2026-01-16', new Set())
  expect(day.trips).toBe(2)
  expect(day.total).toBe(4)
  expect(day.matched).toBe(2)
  expect(day.unresolvedPatterns).toBe(1)
  expect(day.fullyMatchedPairs).toBe(1)
  expect(day.newPatterns).toBe(1)
  expect(day.patterns[0].stopIds).toEqual(['a', 'b', 'a'])
  expect(day.patterns[0].occurrences).toBe(2)
})

test('seasonal inventory distinguishes newly active gaps from routes absent on all sample dates', () => {
  const dates = ['2026-01-16', '2026-09-04']
  const context = { baseline: { routes: ['r', 's'].map(routeId => ({ routeId, days: [{ trips: 0 }] })) }, inventory: { routes: ['r', 's'].map(routeId => ({ routeId, cantonSourceTrips: 1,
    days: dates.map((date, i) => ({ date, trips: routeId === 'r' && !i ? 2 : 0 })) })) } }
  const days = dates.map((date, i) => ({ date, routes: i ? [] : [{ routeId: 'r', trips: 2, total: 4, matched: 2 }] }))
  const rows = seasonalRouteInventory(context, days)
  expect(rows[0].status).toBe('active-with-geometry-gaps')
  expect(rows[0].inactiveOnSeptemberFixtures).toBe(true)
  expect(rows[1].status).toBe('inactive-on-sampled-dates')
  days[0].routes[0].trips++
  expect(() => seasonalRouteInventory(context, days)).toThrow()
})

test('alignment separation finds route deviations but cannot prove direction', () => {
  const straight = [[0, 0], [100, 0]]
  expect(symmetricVertexSeparation(straight, [...straight].reverse())).toBe(0)
  expect(symmetricVertexSeparation(straight, [[0, 0], [50, 80], [100, 0]])).toBe(80)
})

test('seasonal road extensions may fill a gap but cannot replace a prior path', () => {
  const before = { snapshot: { paths: [[[8, 47], [8.01, 47]]] }, patterns: [{ id: 'p', stopIds: ['a', 'b', 'c'], occurrences: 3,
    segments: [{ pathIndex: 0, geometrySource: 'agis' }, { pathIndex: null }] }] }
  const after = structuredClone(before)
  after.snapshot.paths.push([[8.01, 47], [8.02, 47]])
  after.patterns[0].segments[1] = { pathIndex: 1, geometrySource: 'osm' }
  expect(assertPriorGeometryPreserved(before, after)).toEqual({ allPriorPathsPreserved: true, preservedOccurrences: 3, addedOccurrences: 3 })
  after.snapshot.paths[0][1][0] += .001
  expect(() => assertPriorGeometryPreserved(before, after)).toThrow('Seasonal fallback replaced a prior path')
})
