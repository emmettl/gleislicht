import type { RoadTopologyRoad } from './domain/road.ts'
import { foldSearchText } from './search-text.ts'

const ROAD_TERMS = 'motorway autobahn autoroute autostrada autostrasse'

function searchText(road: RoadTopologyRoad): string {
  return foldSearchText(
    `${road.label} ${road.officialLabel} ${road.description ?? ''} ${ROAD_TERMS}`,
  )
}

export function searchRoadCorridors(
  roads: readonly RoadTopologyRoad[],
  query: string,
  maximum = 5,
): readonly RoadTopologyRoad[] {
  const foldedQuery = foldSearchText(query)
  if (!foldedQuery) return []
  return roads
    .filter((road) => searchText(road).includes(foldedQuery))
    .sort((first, second) => {
      const firstText = searchText(first)
      const secondText = searchText(second)
      return (
        Number(secondText.startsWith(foldedQuery)) -
          Number(firstText.startsWith(foldedQuery)) ||
        second.stationCount - first.stationCount ||
        Number(first.id.slice(1)) - Number(second.id.slice(1))
      )
    })
    .slice(0, maximum)
}

export function roadCorridorSearchValue(road: RoadTopologyRoad): string {
  return road.description ? `${road.label} · ${road.description}` : road.label
}
