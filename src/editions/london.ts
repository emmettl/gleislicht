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

export interface LondonDataCatalog extends EditionDataCatalog {
  readonly opening: {
    readonly network: string
    readonly geography: string
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
  },
}
