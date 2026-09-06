import type { VisualTheme } from './theme.ts'

export interface MotionStudyIdentity {
  readonly series: 'Motion Studies'
  readonly catalogueNumber: string
  readonly title: string
  readonly placeName: string
  readonly descriptor: string
}

export type SpatialLayoutId = 'geographic' | 'diagram'

export interface EditionSpatialLayout {
  readonly id: SpatialLayoutId
  readonly label: string
  readonly kind: 'geographic' | 'topological'
  readonly artifact?: string
}

export interface EditionOpeningDataCatalog {
  readonly network: string
  readonly geography?: string
  readonly dayManifest?: string
  readonly layouts?: readonly EditionSpatialLayout[]
}

export interface EditionDataCatalog {
  readonly opening: EditionOpeningDataCatalog
}

export interface MotionStudyEdition<
  DataCatalog extends EditionDataCatalog = EditionDataCatalog,
> {
  readonly id: string
  readonly identity: MotionStudyIdentity
  readonly timezone: string
  readonly languageStorageKey: string
  readonly defaultNetworkTime: number
  readonly defaultHubTime?: number
  readonly theme: VisualTheme
  readonly data: DataCatalog
}
