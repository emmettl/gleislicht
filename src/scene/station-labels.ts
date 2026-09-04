import type { StationIndexEntry } from '../domain/network.ts'

export const MAX_STATION_LABELS = 96

export function stationLabelBudget(cameraHeight: number): number {
  if (cameraHeight >= 30) return 8
  if (cameraHeight >= 22) return 20
  if (cameraHeight >= 15) return 48
  return MAX_STATION_LABELS
}

export function rankStationsForLabels(
  stations: readonly StationIndexEntry[],
): readonly StationIndexEntry[] {
  return [...stations].sort(
    (first, second) =>
      second.trainIds.length - first.trainIds.length ||
      second.routes.length - first.routes.length ||
      first.name.localeCompare(second.name, 'de-CH'),
  )
}
