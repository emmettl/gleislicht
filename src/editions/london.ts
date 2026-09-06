import type {
  EditionDataCatalog,
  MotionStudyEdition,
} from './edition.ts'
import { ALL_CHANGE_STUDY } from './catalogue.ts'
import type { VisualTheme } from '../theme/visual-language.ts'
import type { MapCameraFraming } from '../scene/map-camera.ts'

const ALL_CHANGE_THEME = {
  background: '#04040d',
  ink: '#fbf8ff',
  muted: 'rgba(235, 228, 246, 0.58)',
  line: 'rgba(210, 200, 232, 0.2)',
  primary: '#89f7ff',
  secondary: '#ff63cf',
  panel: 'rgba(8, 7, 18, 0.68)',
  air: '#ff63cf',
  roadLight: '#fff1cf',
  roadHeavy: '#ff9d52',
} satisfies VisualTheme

/**
 * TfL's August 2026 screen colours, gently lifted where the literal colour
 * would disappear into All Change's near-black field. These belong to the
 * diagram view; geography retains the Motion Studies modal palette.
 * Source: https://content.tfl.gov.uk/tfl-colour-standard.pdf
 */
export const ALL_CHANGE_ROUTE_COLORS: Readonly<Record<string, string>> = {
  Bakerloo: '#b26300',
  Central: '#dc241f',
  Circle: '#ffc80a',
  DLR: '#00afad',
  District: '#007d32',
  'Elizabeth line': '#60399e',
  'Hammersmith & City': '#f589a6',
  Jubilee: '#838d93',
  Liberty: '#767a7c',
  Lioness: '#faa61a',
  Metropolitan: '#9b0058',
  Mildmay: '#0077ad',
  Northern: '#777480',
  Piccadilly: '#1839c6',
  Suffragette: '#5bbd72',
  Tram: '#5fb526',
  Victoria: '#039be5',
  'Waterloo & City': '#76d0bd',
  Weaver: '#823a62',
  Windrush: '#ed1b00',
}

export interface LondonDataCatalog extends EditionDataCatalog {
  readonly opening: {
    readonly network: string
    readonly geography: string
    readonly dayManifest: string
    readonly layouts: readonly [
      {
        readonly id: 'geographic'
        readonly label: 'Geography'
        readonly kind: 'geographic'
      },
      {
        readonly id: 'diagram'
        readonly label: 'Diagram'
        readonly kind: 'topological'
        readonly artifact: string
      },
    ]
  }
  readonly air: {
    readonly morning: string
    readonly dayManifest: string
  }
  readonly road: {
    readonly topology: string
    readonly dayManifest: string
  }
  readonly surface: {
    readonly day: string
  }
}

export type LondonEdition = MotionStudyEdition<LondonDataCatalog> & {
  readonly mapFraming: MapCameraFraming
}

export const LONDON_EDITION: LondonEdition = {
  id: 'london',
  identity: ALL_CHANGE_STUDY,
  timezone: 'Europe/London',
  languageStorageKey: 'all-change-language',
  defaultNetworkTime: 7 * 3600 + 45 * 60,
  mapFraming: {
    homeDistanceScale: 1,
    minimumDistanceScale: 0.02,
  },
  theme: ALL_CHANGE_THEME,
  data: {
    opening: {
      network: 'all-change-rail-led-morning.json',
      geography: 'all-change-geography.json',
      dayManifest: 'all-change-day-manifest.json',
      layouts: [
        {
          id: 'geographic',
          label: 'Geography',
          kind: 'geographic',
        },
        {
          id: 'diagram',
          label: 'Diagram',
          kind: 'topological',
          artifact: 'all-change-diagram.json',
        },
      ],
    },
    air: {
      morning: 'all-change-air-morning.json',
      dayManifest: 'all-change-air-day-manifest.json',
    },
    road: {
      topology: 'all-change-road-topology.json',
      dayManifest: 'all-change-road-day-manifest.json',
    },
    surface: {
      day: 'all-change-surface-day.json',
    },
  },
}
