import type { MotionStudyEdition } from '@motionstudies/core/edition'
import { GLEISLICHT_STUDY } from './catalogue.ts'
import type { VisualTheme } from '@motionstudies/core/theme'
import type { HubDefinition } from '@motionstudies/core/domain/hub'
import type { MapCameraFraming } from '@motionstudies/three/map-camera'
import type { SwitzerlandDataCatalog } from './switzerland-data.ts'

export type SwitzerlandHubId = 'zurich' | 'bern' | 'basel' | 'geneva'

const GLEISLICHT_THEME = {
  background: '#050410',
  ink: '#f8f7ff',
  muted: 'rgba(229, 231, 255, 0.58)',
  line: 'rgba(193, 204, 255, 0.2)',
  primary: '#8dfaff',
  secondary: '#ff5edb',
  panel: 'rgba(7, 7, 22, 0.58)',
  air: '#ff5edb',
  roadLight: '#fff1cf',
  roadHeavy: '#ff9d52',
} satisfies VisualTheme

export const SWITZERLAND_HUBS = [
  {
    id: 'zurich',
    name: 'Zürich HB',
    displayName: 'Zürich HB',
    character: "Switzerland's busiest station",
  },
  {
    id: 'bern',
    name: 'Bern',
    displayName: 'Bern',
    character: 'the national interchange',
  },
  {
    id: 'basel',
    name: 'Basel SBB',
    displayName: 'Basel SBB',
    character: 'the tri-national gateway',
  },
  {
    id: 'geneva',
    name: 'Genève',
    displayName: 'Genève',
    character: 'the western gateway',
  },
] as const satisfies readonly HubDefinition<SwitzerlandHubId>[]

export const SWITZERLAND_MAP_FRAMINGS = {
  national: {
    homeDistanceScale: 1,
    minimumDistanceScale: 0.02,
  },
  pilatus: { homeDistanceScale: 0.06, minimumDistanceScale: 0.003, portraitMinimumDistanceScale: 0.003 },
  rochers: { homeDistanceScale: 0.035, minimumDistanceScale: 0.003, portraitMinimumDistanceScale: 0.003 },
  territet: { homeDistanceScale: 0.01, minimumDistanceScale: 0.0005, portraitMinimumDistanceScale: 0.0005 },
  gornergrat: { homeDistanceScale: 0.03, minimumDistanceScale: 0.004, portraitMinimumDistanceScale: 0.003 },
  jungfrau: {
    homeDistanceScale: 0.12,
    minimumDistanceScale: 0.006,
    portraitMinimumDistanceScale: 0.006,
  },
  rigi: {
    homeDistanceScale: 0.14,
    minimumDistanceScale: 0.008,
    portraitMinimumDistanceScale: 0.006,
  },
  zvv: {
    homeDistanceScale: 0.24,
    minimumDistanceScale: 0.012,
    localDetailHierarchy: true,
  },
  ticino: {
    homeDistanceScale: 0.3,
    minimumDistanceScale: 0.008,
    portraitMinimumDistanceScale: 0.006,
    localDetailHierarchy: true,
  },
  graubuenden: { homeDistanceScale: 0.45, minimumDistanceScale: 0.008, portraitMinimumDistanceScale: 0.006, localDetailHierarchy: true },
  valais: { homeDistanceScale: 0.46, minimumDistanceScale: 0.008, portraitMinimumDistanceScale: 0.006, localDetailHierarchy: true },
  solothurn: {
    homeDistanceScale: 0.28,
    minimumDistanceScale: 0.008,
    portraitMinimumDistanceScale: 0.006,
    localDetailHierarchy: true,
  },
  bern: {
    homeDistanceScale: 0.42,
    minimumDistanceScale: 0.008,
    portraitMinimumDistanceScale: 0.006,
    localDetailHierarchy: true,
  },
  riviera: { homeDistanceScale: 0.34, minimumDistanceScale: 0.006, portraitMinimumDistanceScale: 0.006, localDetailHierarchy: true },
  nyon: { homeDistanceScale: 0.16, minimumDistanceScale: 0.006, portraitMinimumDistanceScale: 0.006, localDetailHierarchy: true },
  basel: {
    homeDistanceScale: 0.18,
    minimumDistanceScale: 0.008,
    portraitMinimumDistanceScale: 0.006,
    localDetailHierarchy: true,
  },
  lausanne: {
    homeDistanceScale: 0.18,
    minimumDistanceScale: 0.008,
    portraitMinimumDistanceScale: 0.006,
    localDetailHierarchy: true,
  },
  geneva: {
    homeDistanceScale: 0.1,
    // Preserve the detail thresholds while opening close enough to show trams.
    localDetailDistanceScale: 0.13,
    minimumDistanceScale: 0.01,
    portraitMinimumDistanceScale: 0.008,
    localDetailHierarchy: true,
  },
  zurich: {
    homeDistanceScale: 0.06,
    minimumDistanceScale: 0.01,
    portraitMinimumDistanceScale: 0.008,
    stationLabelHeightScale: 0.78,
    stationLabelPrefix: 'Zürich',
    stationLabelPrimaryName: 'Zürich HB',
  },
} as const satisfies Readonly<Record<string, MapCameraFraming & { readonly localDetailDistanceScale?: number }>>

export type SwitzerlandRegionalStudyId =
  | 'pilatus'
  | 'rochers'
  | 'territet'
  | 'gornergrat'
  | 'jungfrau'
  | 'rigi-lake'
  | 'zvv-region'
  | 'lausanne-region'
  | 'luzern-region'
  | 'zug-region'
  | 'thurgau-region'
  | 'fribourg-region'
  | 'ticino-region'
  | 'graubuenden-region'
  | 'valais-region'
  | 'solothurn-region'
  | 'bern-region'
  | 'riviera-region'
  | 'nyon-region'
  | 'basel-core'
  | 'geneva-tpg'
  | 'zurich-city'

export type SwitzerlandNetworkStudy =
  | 'national'
  | 'postbus'
  | SwitzerlandRegionalStudyId
  | 'contrast'

export type SwitzerlandTerrainCorridorId =
  | 'zurich-chur'
  | 'kiental-griesalp'
  | 'vitznau-rigi'
  | 'arth-goldau-rigi'

export type SwitzerlandEdition = MotionStudyEdition<
  SwitzerlandDataCatalog<
    SwitzerlandRegionalStudyId,
    SwitzerlandTerrainCorridorId
  >
> & {
  readonly defaultHubTime: number
}

export const SWITZERLAND_EDITION: SwitzerlandEdition = {
  id: 'switzerland',
  identity: GLEISLICHT_STUDY,
  timezone: 'Europe/Zurich',
  languageStorageKey: 'gleislicht-language',
  defaultNetworkTime: 7 * 3600 + 45 * 60,
  defaultHubTime: 7 * 3600 + 45 * 60,
  theme: GLEISLICHT_THEME,
  data: {
    opening: {
      network: 'swiss-rail-morning.json',
      dayManifest: 'swiss-rail-day-manifest.json',
      layouts: [
        {
          id: 'geographic',
          label: 'Geography',
          kind: 'geographic',
        },
      ],
    },
    nationalMorning: 'swiss-rail-morning.json',
    nationalDayManifest: 'swiss-rail-day-manifest.json',
    postbusDayManifest: 'postbus-national-day-manifest.json',
    boundary: 'swiss-boundary.json',
    water: 'swiss-lakes.json',
    hubDay: 'swiss-hub-day.json',
    realtimeDemo: 'realtime-demo.json',
    regional: {
      'pilatus': 'pilatus-day.json',
      'rochers': 'rochers-day.json',
      'territet': 'territet-day.json',
      'gornergrat': 'gornergrat-day.json',
      'jungfrau': 'jungfrau-day.json',
      'rigi-lake': 'rigi-day.json',
      'zurich-city': 'zurich-city-morning.json',
      'zvv-region': 'zvv-region-morning.json',
      'luzern-region': 'luzern-region/2026-09-04/study/luzern-region-morning.json',
      'zug-region': 'zug-region/2026-09-04/study/zug-region-morning.json',
      'thurgau-region': 'thurgau-region/2026-09-04/study/thurgau-region-morning.json',
      'fribourg-region': 'fribourg-region/2026-09-04/study/fribourg-region-morning.json',
      'ticino-region': 'ticino-region/2026-09-04/ticino-region-morning.json',
      'graubuenden-region': 'graubuenden-region/2026-09-04/graubuenden-region-morning.json',
      'valais-region': 'valais-region-morning.json',
      'solothurn-region': 'solothurn-region-morning.json',
      'bern-region': 'bern-region-morning.json',
      'riviera-region': 'riviera-region-morning.json',
      'nyon-region': 'nyon-region-morning.json',
      'basel-core': 'basel-core-morning.json',
      'lausanne-region': 'lausanne-region-morning.json',
      'geneva-tpg': 'geneva-tpg-morning.json',
    },
    contrast: {
      cityDayManifest: 'zurich-tram-day-manifest.json',
      ruralDayManifest: 'kiental-postbus-day-manifest.json',
    },
    air: {
      morning: 'swiss-air-morning.json',
      dayManifest: 'swiss-air-day-manifest.json',
    },
    road: {
      morning: 'swiss-road-morning.json',
      topology: 'swiss-road-topology.json',
      nationalManifest: 'swiss-road-national-manifest.json',
    },
    corridors: {
      'vitznau-rigi': 'vitznau-rigi-corridor.json',
      'arth-goldau-rigi': 'arth-goldau-rigi-corridor.json',
      'zurich-chur': 'zurich-chur-corridor.json',
      'kiental-griesalp': 'kiental-griesalp-corridor.json',
    },
  },
}
