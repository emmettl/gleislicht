import type {
  MotionStudyEdition,
  SwitzerlandDataCatalog,
} from './edition.ts'
import { GLEISLICHT_STUDY } from './catalogue.ts'
import { GLEISLICHT_THEME } from '../theme/visual-language.ts'

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
>

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
