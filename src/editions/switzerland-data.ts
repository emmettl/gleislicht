import type { EditionDataCatalog } from '@motionstudies/core/edition'

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
