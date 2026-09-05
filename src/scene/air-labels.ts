import type { TrainLabelMode } from './train-labels.ts'

export const MAX_AIR_LABELS = 20

export function airLabelBudget(
  cameraHeight: number,
  mode: TrainLabelMode,
  selected: boolean,
): number {
  if (mode === 'off') return 0
  if (selected) return 1
  if (mode === 'on') {
    if (cameraHeight >= 30) return 8
    if (cameraHeight >= 22) return 14
    return MAX_AIR_LABELS
  }
  if (cameraHeight >= 30) return 4
  if (cameraHeight >= 22) return 7
  return 10
}

export function airLabelScreenHeight(
  viewportWidth: number,
  selected: boolean,
  cameraHeight: number,
): number {
  if (viewportWidth <= 600) {
    const closeProgress = 1 - Math.min(1, Math.max(0, (cameraHeight - 18) / 12))
    return (selected ? 26 : 18) + closeProgress * 8
  }
  return selected ? 34 : 28
}

export function airLabelScreenWidth(
  label: string,
  screenHeight: number,
): number {
  return Math.min(
    screenHeight * 7,
    Math.max(screenHeight * 2.2, screenHeight * (1.05 + label.length * 0.18)),
  )
}

export interface AirLabelCandidatePriority {
  readonly id: string
  readonly callsign: string
  readonly retained: boolean
}

export function compareAirLabelCandidates(
  first: AirLabelCandidatePriority,
  second: AirLabelCandidatePriority,
): number {
  const firstHasCallsign = first.callsign !== first.id.toUpperCase()
  const secondHasCallsign = second.callsign !== second.id.toUpperCase()
  return (
    Number(second.retained) - Number(first.retained) ||
    Number(secondHasCallsign) - Number(firstHasCallsign) ||
    first.callsign.localeCompare(second.callsign, 'en', { numeric: true }) ||
    first.id.localeCompare(second.id, 'en', { numeric: true })
  )
}
