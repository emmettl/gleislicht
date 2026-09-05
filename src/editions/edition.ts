import type { VisualTheme } from '../theme/visual-language.ts'

export interface MotionStudyIdentity {
  readonly series: 'Motion Studies'
  readonly catalogueNumber: string
  readonly title: string
  readonly placeName: string
  readonly descriptor: string
}

export interface EditionDataCatalog<
  RegionalStudyId extends string = string,
  CorridorId extends string = string,
> {
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
  RegionalStudyId extends string = string,
  CorridorId extends string = string,
> {
  readonly id: string
  readonly identity: MotionStudyIdentity
  readonly timezone: string
  readonly languageStorageKey: string
  readonly defaultNetworkTime: number
  readonly defaultHubTime: number
  readonly theme: VisualTheme
  readonly data: EditionDataCatalog<RegionalStudyId, CorridorId>
}

export function editionDataUrl(fileName: string): string {
  return `${import.meta.env.BASE_URL}data/${fileName}`
}
