import type {
  EditionDataCatalog,
  MotionStudyEdition,
} from './edition.ts'
import { ALL_CHANGE_STUDY } from './catalogue.ts'
import { ALL_CHANGE_THEME } from '../theme/visual-language.ts'

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
        readonly artifact?: string
      },
    ]
  }
}

export type LondonEdition = MotionStudyEdition<LondonDataCatalog>

export const LONDON_EDITION: LondonEdition = {
  id: 'london',
  identity: ALL_CHANGE_STUDY,
  timezone: 'Europe/London',
  languageStorageKey: 'all-change-language',
  defaultNetworkTime: 7 * 3600 + 45 * 60,
  defaultHubTime: 7 * 3600 + 45 * 60,
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
        },
      ],
    },
  },
}
