import type { MotionStudyIdentity } from './edition.ts'

export type MotionStudyStatus = 'released' | 'planned'

export interface MotionStudyCatalogueEntry extends MotionStudyIdentity {
  readonly status: MotionStudyStatus
}

export const GLEISLICHT_STUDY = {
  series: 'Motion Studies',
  catalogueNumber: '005',
  title: 'Gleislicht',
  placeName: 'Switzerland',
  descriptor: 'A Swiss motion study',
  status: 'released',
} as const satisfies MotionStudyCatalogueEntry

export const ALL_CHANGE_STUDY = {
  series: 'Motion Studies',
  catalogueNumber: '006',
  title: 'All Change',
  placeName: 'London',
  descriptor: 'A London motion study',
  status: 'planned',
} as const satisfies MotionStudyCatalogueEntry

export const MOTION_STUDIES_CATALOGUE = [
  GLEISLICHT_STUDY,
  ALL_CHANGE_STUDY,
] as const satisfies ReadonlyArray<MotionStudyCatalogueEntry>

export function motionStudyMark(identity: MotionStudyIdentity): string {
  return `${identity.series.toUpperCase()} · ${identity.catalogueNumber}`
}
