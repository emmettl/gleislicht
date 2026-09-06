import type { MapCameraFraming } from '../scene/map-camera.ts'
import type { VisualTheme } from '../theme/visual-language.ts'
import { LOCAL_EXPRESS_STUDY } from './catalogue.ts'
import type {
  EditionDataCatalog,
  MotionStudyEdition,
} from './edition.ts'

const LOCAL_EXPRESS_THEME = {
  background: '#03070a',
  ink: '#f7fbf5',
  muted: 'rgba(220, 235, 224, 0.58)',
  line: 'rgba(156, 255, 183, 0.18)',
  primary: '#82ffae',
  secondary: '#fff15d',
  panel: 'rgba(4, 12, 9, 0.74)',
  air: '#ff5fc7',
  roadLight: '#fff0c6',
  roadHeavy: '#ff9e55',
} satisfies VisualTheme

/**
 * Both patterns belong to the Lexington Avenue trunk. Pattern—not operator
 * branding—is the primary distinction in this bounded study.
 */
export const LOCAL_EXPRESS_ROUTE_COLORS: Readonly<Record<string, string>> = {
  'Lexington Avenue Local': '#69d98b',
  'Lexington Avenue Express': '#b9ff63',
}

export interface NewYorkDataCatalog extends EditionDataCatalog {
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
}

export type NewYorkEdition = MotionStudyEdition<NewYorkDataCatalog> & {
  readonly mapFraming: MapCameraFraming
}

export const NEW_YORK_EDITION: NewYorkEdition = {
  id: 'new-york',
  identity: LOCAL_EXPRESS_STUDY,
  timezone: 'America/New_York',
  languageStorageKey: 'local-express-language',
  defaultNetworkTime: 8 * 3600,
  mapFraming: {
    homeDistanceScale: 0.88,
    minimumDistanceScale: 0.018,
  },
  theme: LOCAL_EXPRESS_THEME,
  data: {
    opening: {
      network: 'local-express-lexington-morning.json',
      geography: 'local-express-geography.json',
      dayManifest: 'local-express-day-manifest.json',
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
          artifact: 'local-express-diagram.json',
        },
      ],
    },
  },
}
