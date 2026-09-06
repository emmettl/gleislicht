import type { StationIndexEntry } from '../domain/network.ts'
import {
  homeMapDistanceScale,
  type MapCameraFraming,
} from './map-camera.ts'

export const MAX_STATION_LABELS = 96
export const STATION_LABEL_SETTLE_SECONDS = 0.16

export function stationLabelsCanRepopulate(stableSeconds: number): boolean {
  return stableSeconds >= STATION_LABEL_SETTLE_SECONDS
}

export function stableStationLabelBudget(
  targetBudget: number,
  retainedCount: number,
  canRepopulate: boolean,
): number {
  return canRepopulate ? targetBudget : Math.max(targetBudget, retainedCount)
}

export interface StationScreenPoint {
  readonly index: number
  readonly x: number
  readonly y: number
}

export interface StationLabelCandidatePriority {
  readonly name: string
  readonly rank: number
  readonly priority: number
  readonly retained: boolean
  readonly distance: number
}

export function compareStationLabelCandidates(
  first: StationLabelCandidatePriority,
  second: StationLabelCandidatePriority,
): number {
  return (
    first.priority - second.priority ||
    Number(second.retained) - Number(first.retained) ||
    first.rank - second.rank ||
    first.distance - second.distance ||
    first.name.localeCompare(second.name, 'de-CH')
  )
}

export function stationTapRadius(pointerType: string): number {
  return pointerType === 'touch' || pointerType === 'pen' ? 30 : 16
}

export function stationIndexAtScreenPoint(
  x: number,
  y: number,
  stations: readonly StationScreenPoint[],
  radius: number,
): number | undefined {
  let selectedIndex: number | undefined
  let closestSquaredDistance = radius * radius

  stations.forEach((station) => {
    const squaredDistance =
      (station.x - x) ** 2 + (station.y - y) ** 2
    if (squaredDistance > closestSquaredDistance) return
    selectedIndex = station.index
    closestSquaredDistance = squaredDistance
  })

  return selectedIndex
}

export function stationLabelScreenHeight(
  selected: boolean,
  emphasised: boolean,
): number {
  if (selected) return 56
  if (emphasised) return 46
  return 40
}

export function stationLabelScreenWidth(
  label: string,
  screenHeight: number,
): number {
  return Math.min(
    screenHeight * 8.25,
    Math.max(
      screenHeight * 1.6,
      label.length * screenHeight * 0.2 + screenHeight,
    ),
  )
}

export function stationLabelWorldHeight(
  cameraDepth: number,
  verticalFieldOfView: number,
  viewportHeight: number,
  screenHeight: number,
): number {
  if (
    cameraDepth <= 0 ||
    viewportHeight <= 0 ||
    screenHeight <= 0 ||
    !Number.isFinite(verticalFieldOfView)
  ) {
    return 0
  }

  const halfFieldOfView = (verticalFieldOfView * Math.PI) / 360
  const visibleWorldHeight = 2 * cameraDepth * Math.tan(halfFieldOfView)
  return (screenHeight / viewportHeight) * visibleWorldHeight
}

export function stationLabelCameraHeight(
  cameraHeight: number,
  framing: MapCameraFraming,
): number {
  const relativeHeight = cameraHeight / homeMapDistanceScale(framing)
  return framing === 'zurich' ? relativeHeight * 0.78 : relativeHeight
}

export function stationLabelText(
  name: string,
  framing: MapCameraFraming,
): string {
  if (framing !== 'zurich' || name === 'Zürich HB') return name
  if (name.startsWith('Zürich, ')) return name.slice('Zürich, '.length)
  if (name.startsWith('Zürich ') && name.includes(',')) {
    return name.slice('Zürich '.length)
  }
  return name
}

export function stationLabelBudget(cameraHeight: number): number {
  if (cameraHeight >= 30) return 8
  if (cameraHeight >= 22) return 20
  if (cameraHeight >= 15) return 48
  return MAX_STATION_LABELS
}

export function stationLabelRankLimit(cameraHeight: number): number {
  if (cameraHeight >= 30) return 8
  if (cameraHeight >= 22) return 20
  if (cameraHeight >= 15) return 48
  if (cameraHeight >= 14) return MAX_STATION_LABELS
  return Number.POSITIVE_INFINITY
}

export function rankStationsForLabels(
  stations: readonly StationIndexEntry[],
): readonly StationIndexEntry[] {
  return [...stations].sort(
    (first, second) =>
      (first.labelRank ?? Number.POSITIVE_INFINITY) -
        (second.labelRank ?? Number.POSITIVE_INFINITY) ||
      second.trainIds.length - first.trainIds.length ||
      second.routes.length - first.routes.length ||
      first.name.localeCompare(second.name, 'de-CH'),
  )
}
