import { describe, expect, it } from 'vitest'
import type { RoadTopologyRoad } from './domain/road.ts'
import { roadCorridorSearchValue, searchRoadCorridors } from './road-search.ts'

const roads: RoadTopologyRoad[] = [
  {
    id: 'N1',
    label: 'A1',
    officialLabel: 'N1',
    description: 'Genève · Lausanne · Bern · Zürich · St. Margrethen',
    bounds: {
      minLongitude: 6,
      maxLongitude: 9.5,
      minLatitude: 46.2,
      maxLatitude: 47.6,
    },
    focus: [7.75, 46.9],
    cameraScale: 0.8,
    pathCount: 20,
    stationCount: 90,
    directionalSiteCount: 170,
    sectionCount: 160,
  },
  {
    id: 'N2',
    label: 'A2',
    officialLabel: 'N2',
    description: 'Basel · Gotthard · Chiasso',
    bounds: {
      minLongitude: 7.5,
      maxLongitude: 9,
      minLatitude: 45.8,
      maxLatitude: 47.6,
    },
    focus: [8.2, 46.7],
    cameraScale: 0.75,
    pathCount: 15,
    stationCount: 64,
    directionalSiteCount: 116,
    sectionCount: 110,
  },
]

describe('road corridor search', () => {
  it('finds signed and official road numbers', () => {
    expect(searchRoadCorridors(roads, 'A2').map(({ id }) => id)).toEqual(['N2'])
    expect(searchRoadCorridors(roads, 'N1').map(({ id }) => id)).toEqual(['N1'])
  })

  it('finds corridor geography accent-insensitively', () => {
    expect(searchRoadCorridors(roads, 'zurich')[0]?.id).toBe('N1')
    expect(searchRoadCorridors(roads, 'gotthard')[0]?.id).toBe('N2')
  })

  it('formats a useful selected search value', () => {
    expect(roadCorridorSearchValue(roads[1])).toBe(
      'A2 · Basel · Gotthard · Chiasso',
    )
  })
})
