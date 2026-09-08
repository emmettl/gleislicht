import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import { cogwheelNetwork, compatibleCogwheelCatalogue, type CogwheelCatalogue } from './cogwheel.ts'

const metadata = { feedVersion: 'v1', serviceDate: '2026-09-04', publisher: 'SBB', sourceUrl: '', model: '', note: '', windowStart: 0, windowEnd: 86400, focusTime: 36000 }
const catalogue: CogwheelCatalogue = {
  metadata,
  routes: { rigi: { id: 'rigi', name: '81', operator: 'Rigi Bahnen', agencyId: '137', routeType: 116, routeDescription: 'CC' } },
  trips: { cog: 'rigi' },
}
const snapshot: NetworkSnapshot = {
  metadata,
  bounds: { minLongitude: 8, maxLongitude: 9, minLatitude: 46, maxLatitude: 47 },
  stops: [[8, 46, 'A'], [8.5, 46.5, 'B'], [9, 47, 'C']],
  edges: [[0, 1], [1, 2]], edgePaths: [0, 1], paths: [[[8, 46], [8.5, 46.5]], [[8.5, 46.5], [9, 47]]],
  trains: [
    { id: 'cog', route: '81', category: 'other', headsign: 'A', shortName: '1', start: 36000, end: 37000, stops: [[1, 36000, 36000], [0, 37000, 37000]], pathSegments: [0] },
    { id: 'unrelated', route: '81', category: 'other', headsign: 'C', shortName: '2', start: 36000, end: 37000, stops: [[1, 36000, 36000], [2, 37000, 37000]], pathSegments: [1] },
  ],
}

describe('cogwheel lens', () => {
  it('requires matching dates, versions, source types and valid route references', () => {
    expect(compatibleCogwheelCatalogue(catalogue, metadata)).toBe(true)
    expect(compatibleCogwheelCatalogue(catalogue, { ...metadata, serviceDate: '2026-09-05' })).toBe(false)
    expect(compatibleCogwheelCatalogue(catalogue, { ...metadata, feedVersion: 'v2' })).toBe(false)
    expect(compatibleCogwheelCatalogue({ ...catalogue, trips: { cog: 'absent' } }, metadata)).toBe(false)
    expect(compatibleCogwheelCatalogue({ ...catalogue, routes: { rigi: { routeType: 106 } } }, metadata)).toBe(false)
    expect(compatibleCogwheelCatalogue(null, metadata)).toBe(false)
  })

  it('joins trip identity, preserving reverse travel geometry while removing unrelated stations', () => {
    const result = cogwheelNetwork(snapshot, catalogue)
    expect(result.trains.map(train => train.id)).toEqual(['cog'])
    expect(result.edges).toEqual([[0, 1]])
    expect(result.edgePaths).toEqual([0])
    expect(result.stops).toEqual(snapshot.stops.slice(0, 2))
    expect(result.paths).toBe(snapshot.paths)
    expect(result.trains[0].pathSegments).toEqual([0])
    expect(snapshot.trains).toHaveLength(2)
    expect(cogwheelNetwork({ ...snapshot, trains: [{ ...snapshot.trains[0], stops: [[2, 36000, 36000], [0, 37000, 37000]] }], edges: [[2, 0]], edgePaths: [1] }, catalogue).trains[0].stops).toEqual([[1, 36000, 36000], [0, 37000, 37000]])
  })

  it('shows no unrelated network when loading, unavailable or quiet overnight', () => {
    expect(cogwheelNetwork(snapshot).trains).toEqual([])
    expect(cogwheelNetwork(snapshot).edges).toEqual([])
    const empty = cogwheelNetwork({ ...snapshot, trains: [] }, catalogue)
    expect(empty.edges).toEqual([])
    expect(empty.metadata).toBe(metadata)
  })
})
