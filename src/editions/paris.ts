import type { MapCameraFraming } from '../scene/map-camera.ts'
import type { VisualTheme } from '../theme/visual-language.ts'
import { CORRESPONDANCES_STUDY } from './catalogue.ts'
import type { EditionDataCatalog, MotionStudyEdition } from './edition.ts'

const CORRESPONDANCES_THEME = {
  background: '#07040d',
  ink: '#fff9f1',
  muted: 'rgba(238, 224, 241, 0.58)',
  line: 'rgba(225, 193, 255, 0.17)',
  primary: '#f4cf55',
  secondary: '#ef4b68',
  panel: 'rgba(12, 5, 18, 0.76)',
  air: '#f06fca',
  roadLight: '#ffe6b0',
  roadHeavy: '#ff9f59',
} satisfies VisualTheme

/**
 * The source feed carries the official identifiers and line colours. These
 * slightly lifted variants remain legible in the dark Motion Studies palette.
 */
export const CORRESPONDANCES_ROUTE_COLORS: Readonly<Record<string, string>> = {
  'Métro 1': '#ffd75d',
  'Métro 4': '#d86bc7',
  'Métro 14': '#9b79ff',
  'RER A': '#ff4e70',
  'RER B': '#65b5ff',
}

export interface ParisDataCatalog extends EditionDataCatalog {
  readonly opening: {
    readonly network: string
    readonly geography: string
    readonly dayManifest: string
  }
  readonly layers: {
    readonly centralCrossMorning: string
  }
}

export type ParisEdition = MotionStudyEdition<ParisDataCatalog> & {
  readonly mapFraming: MapCameraFraming
}

export const PARIS_EDITION: ParisEdition = {
  id: 'paris',
  identity: CORRESPONDANCES_STUDY,
  timezone: 'Europe/Paris',
  languageStorageKey: 'correspondances-language',
  defaultNetworkTime: 8 * 3600,
  mapFraming: {
    homeDistanceScale: 0.9,
    minimumDistanceScale: 0.018,
  },
  theme: CORRESPONDANCES_THEME,
  data: {
    opening: {
      network: 'correspondances-morning.json',
      geography: 'correspondances-geography.json',
      dayManifest: 'correspondances-day-manifest.json',
    },
    layers: {
      centralCrossMorning: 'correspondances-central-cross-morning.json',
    },
  },
}
