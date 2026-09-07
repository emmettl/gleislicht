import type { MotionStudyIdentity } from '@motionstudies/core/edition'

export type MotionStudyStatus = 'released' | 'foundation' | 'planned'

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

export function motionStudyMark(identity: MotionStudyIdentity): string {
  return `${identity.series.toUpperCase()} · ${identity.catalogueNumber}`
}
