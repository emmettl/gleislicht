import type { VisualTheme } from '../theme/visual-language.ts'

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

export interface SwitzerlandDataCatalog<
  RegionalStudyId extends string = string,
  CorridorId extends string = string,
> extends EditionDataCatalog {
  readonly nationalMorning: string
  readonly nationalDayManifest: string
  readonly boundary: string
  readonly water: string
  readonly hubDay: string
  readonly realtimeDemo: string
  readonly regional: Readonly<Record<RegionalStudyId, string>>
  readonly contrast: {
    readonly cityDayManifest: string
    readonly ruralDayManifest: string
  }
  readonly air: {
    readonly morning: string
    readonly dayManifest: string
  }
  readonly road: {
    readonly morning: string
    readonly topology: string
    readonly nationalManifest: string
  }
  readonly corridors: Readonly<Record<CorridorId, string>>
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

export function editionDataUrl(fileName: string): string {
  return `${import.meta.env.BASE_URL}data/${fileName}`
}
