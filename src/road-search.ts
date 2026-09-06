import { foldSearchText } from './search-text.ts'

const ROAD_TERMS = 'motorway autobahn autoroute autostrada autostrasse'

export interface RoadSearchCorridor {
  readonly id: string
  readonly label: string
  readonly officialLabel: string
  readonly description?: string
  readonly focus: readonly [longitude: number, latitude: number]
  readonly cameraScale: number
  readonly stationCount?: number
}

function searchText(road: RoadSearchCorridor): string {
  return foldSearchText(
    `${road.label} ${road.officialLabel} ${road.description ?? ''} ${ROAD_TERMS}`,
  )
}

export function searchRoadCorridors<Road extends RoadSearchCorridor>(
  roads: readonly Road[],
  query: string,
  maximum = 5,
): readonly Road[] {
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
        (second.stationCount ?? 0) - (first.stationCount ?? 0) ||
        first.id.localeCompare(second.id, 'en', { numeric: true })
      )
    })
    .slice(0, maximum)
}

export function roadCorridorSearchValue(road: RoadSearchCorridor): string {
  return road.description ? `${road.label} · ${road.description}` : road.label
}
