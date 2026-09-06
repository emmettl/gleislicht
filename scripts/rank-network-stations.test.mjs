import { describe, expect, it } from 'vitest'
import { applyStationLabelRanks, rankNetworkStations } from './rank-network-stations.mjs'

const snapshot = {
  metadata: {},
  stops: [
    [-0.2, 51.5, 'Outer'],
    [-0.1, 51.51, 'Junction'],
    [0, 51.52, 'Terminus'],
  ],
  edges: [[0, 1], [1, 2]],
  trains: [
    { id: 'a', route: 'Alpha', mode: 'tube', category: 'metro', stops: [[0], [1]] },
    { id: 'b', route: 'Beta', mode: 'overground', category: 'metro', stops: [[1], [2]] },
    { id: 'c', route: 'Alpha', mode: 'tube', category: 'metro', stops: [[0], [1]] },
  ],
}

describe('compiled station-label hierarchy', () => {
  it('puts multimodal interchanges ahead of busier single-mode stops', () => {
    const ranking = rankNetworkStations(snapshot)
    expect(ranking.map(({ name }) => name)).toEqual(['Junction', 'Outer', 'Terminus'])
    expect(ranking[0]).toMatchObject({ modeCount: 2, routeCount: 2, movementCount: 3 })
  })

  it('writes one stable rank for every stop sharing a station name', () => {
    const ranked = applyStationLabelRanks({
      ...snapshot,
      stops: [...snapshot.stops, [0.01, 51.521, 'Junction']],
    })
    expect(ranked.stops[1][5]).toBe(0)
    expect(ranked.stops[3][5]).toBe(0)
    expect(ranked.metadata.labelHierarchy.stationCount).toBe(3)
  })

  it('uses advertised topology to recognise an interchange across branch-only lines', () => {
    const catalogue = {
      lines: [
        { id: 'alpha', name: 'Alpha', mode: 'tube', directions: [{ branches: [{ stopIds: ['outer', 'junction'] }] }] },
        { id: 'gamma', name: 'Gamma', mode: 'overground', directions: [{ branches: [{ stopIds: ['junction', 'terminus'] }] }] },
      ],
    }
    const withSourceIds = {
      ...snapshot,
      stops: snapshot.stops.map((stop) => [...stop, '', stop[2].toLowerCase()]),
    }
    const ranking = rankNetworkStations(withSourceIds, { catalogue })
    expect(ranking[0]).toMatchObject({ name: 'Junction', modeCount: 2 })
    expect(ranking[0].routeCount).toBeGreaterThanOrEqual(2)
  })
})
