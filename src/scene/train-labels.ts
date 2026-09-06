import type { ServiceCategory } from '../domain/network.ts'

export type TrainLabelMode = 'auto' | 'on' | 'off'

export const MAX_TRAIN_LABELS = 56
export const TRAIN_LABEL_ARRIVAL_FADE_SECONDS = 1.6

export function trainLabelIdentity(route: string, shortName: string): string {
  const routeLabel = route.trim()
  const serviceLabel = shortName.trim()
  if (!routeLabel) return serviceLabel
  if (!serviceLabel) return routeLabel
  if (
    routeLabel.localeCompare(serviceLabel, undefined, {
      sensitivity: 'accent',
    }) === 0
  ) {
    return routeLabel
  }
  return `${routeLabel} · ${serviceLabel}`
}

export function nonRailCategorySuppressesTrainLabels(
  airCategorySelected = false,
  roadCategorySelected = false,
): boolean {
  return airCategorySelected || roadCategorySelected
}

export function trainLabelArrivalOpacity(
  time: number,
  end: number,
  playbackRate: number,
): number {
  if (time <= end) return 1
  const timetableFadeSeconds =
    TRAIN_LABEL_ARRIVAL_FADE_SECONDS * Math.max(1, playbackRate)
  return Math.max(0, 1 - (time - end) / timetableFadeSeconds)
}

export function trainLabelScreenHeight(
  viewportWidth: number,
  selected: boolean,
  cameraHeight: number,
): number {
  if (viewportWidth <= 600) {
    const overviewProgress = Math.min(
      1,
      Math.max(0, (cameraHeight - 18) / 12),
    )
    const closeHeight = selected ? 52 : 44
    return closeHeight - overviewProgress * 20
  }
  return selected ? 46 : 38
}

export function trainLabelScreenWidth(
  label: string,
  screenHeight: number,
): number {
  return Math.min(
    screenHeight * 9,
    Math.max(screenHeight * 2.4, screenHeight * (1.2 + label.length * 0.2)),
  )
}

const CATEGORY_PRIORITY: Readonly<Record<ServiceCategory, number>> = {
  international: 0,
  intercity: 1,
  interregio: 2,
  'regional-express': 3,
  's-bahn': 4,
  regional: 5,
  tram: 6,
  metro: 7,
  bus: 8,
  ferry: 9,
  funicular: 10,
  cableway: 11,
  other: 12,
}

export function trainLabelBudget(
  cameraHeight: number,
  mode: TrainLabelMode,
): number {
  if (mode === 'off') return 0
  if (mode === 'on') {
    if (cameraHeight >= 30) return 18
    if (cameraHeight >= 22) return 32
    return MAX_TRAIN_LABELS
  }
  if (cameraHeight >= 30) return 8
  if (cameraHeight >= 22) return 16
  return 32
}

export function trainLabelPriority(category: ServiceCategory): number {
  return CATEGORY_PRIORITY[category]
}

export interface TrainLabelCandidatePriority {
  readonly id: string
  readonly category: ServiceCategory
  readonly retained: boolean
}

export function compareTrainLabelCandidates(
  first: TrainLabelCandidatePriority,
  second: TrainLabelCandidatePriority,
): number {
  return (
    trainLabelPriority(first.category) - trainLabelPriority(second.category) ||
    Number(second.retained) - Number(first.retained) ||
    first.id.localeCompare(second.id, 'de-CH', { numeric: true })
  )
}

export function categoryIsVisibleInAutoMode(
  category: ServiceCategory,
  cameraHeight: number,
): boolean {
  const priority = CATEGORY_PRIORITY[category]
  if (cameraHeight >= 30) return priority <= CATEGORY_PRIORITY.intercity
  if (cameraHeight >= 22) return priority <= CATEGORY_PRIORITY['regional-express']
  return true
}
