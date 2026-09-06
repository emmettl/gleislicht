import type {
  MotionStudyEdition,
  SwitzerlandDataCatalog,
} from './edition.ts'
import { GLEISLICHT_STUDY } from './catalogue.ts'
import type { VisualTheme } from '../theme/visual-language.ts'
import type { HubDefinition } from '../domain/hub.ts'
import type { MapCameraFraming } from '../scene/map-camera.ts'

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
  zvv: {
    homeDistanceScale: 0.24,
    minimumDistanceScale: 0.012,
    localDetailHierarchy: true,
  },
  geneva: {
    homeDistanceScale: 0.13,
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
} as const satisfies Readonly<Record<string, MapCameraFraming>>

export type SwitzerlandRegionalStudyId =
  | 'zvv-region'
  | 'geneva-tpg'
  | 'zurich-city'

export type SwitzerlandNetworkStudy =
  | 'national'
  | SwitzerlandRegionalStudyId
  | 'contrast'

export type SwitzerlandTerrainCorridorId =
  | 'zurich-chur'
  | 'kiental-griesalp'

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
    boundary: 'swiss-boundary.json',
    water: 'swiss-lakes.json',
    hubDay: 'swiss-hub-day.json',
    realtimeDemo: 'realtime-demo.json',
    regional: {
      'zurich-city': 'zurich-city-morning.json',
      'zvv-region': 'zvv-region-morning.json',
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
      'zurich-chur': 'zurich-chur-corridor.json',
      'kiental-griesalp': 'kiental-griesalp-corridor.json',
    },
  },
}
