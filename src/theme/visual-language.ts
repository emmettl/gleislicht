import type { ServiceCategory } from '../domain/network.ts'

export interface VisualTheme {
  readonly background: string
  readonly ink: string
  readonly muted: string
  readonly line: string
  readonly primary: string
  readonly secondary: string
  readonly panel: string
  readonly air: string
  readonly roadLight: string
  readonly roadHeavy: string
}

export const GLEISLICHT_THEME: VisualTheme = {
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
}

export const ALL_CHANGE_THEME: VisualTheme = {
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
}

export const SERVICE_CATEGORIES: ReadonlyArray<{
  readonly id: ServiceCategory
  readonly label: string
  readonly color: string
}> = [
  { id: 'international', label: 'International', color: '#ffd166' },
  { id: 'intercity', label: 'IC', color: '#ff4fd8' },
  { id: 'interregio', label: 'IR', color: '#9d7bff' },
  { id: 'regional-express', label: 'RE', color: '#4fc3ff' },
  { id: 's-bahn', label: 'S-Bahn', color: '#7dffbb' },
  { id: 'regional', label: 'Regional', color: '#fff3a6' },
  { id: 'tram', label: 'Tram', color: '#ff6ea9' },
  { id: 'metro', label: 'Metro', color: '#a78bfa' },
  { id: 'bus', label: 'Bus', color: '#ff9f43' },
  { id: 'ferry', label: 'Ferry', color: '#48c6ef' },
  { id: 'cableway', label: 'Cableway', color: '#d7ff70' },
  { id: 'funicular', label: 'Funicular', color: '#f8f38d' },
  { id: 'other', label: 'Other', color: '#b9c1da' },
]

export const SERVICE_COLORS: Readonly<Record<ServiceCategory, string>> =
  Object.fromEntries(
    SERVICE_CATEGORIES.map((category) => [category.id, category.color]),
  ) as Record<ServiceCategory, string>

export function applyVisualTheme(
  theme: VisualTheme,
  root: HTMLElement = document.documentElement,
): void {
  root.style.setProperty('--background', theme.background)
  root.style.setProperty('--ink', theme.ink)
  root.style.setProperty('--muted', theme.muted)
  root.style.setProperty('--line', theme.line)
  root.style.setProperty('--cyan', theme.primary)
  root.style.setProperty('--pink', theme.secondary)
  root.style.setProperty('--panel', theme.panel)
  root.style.setProperty('--air', theme.air)
  root.style.setProperty('--road-light', theme.roadLight)
  root.style.setProperty('--road-heavy', theme.roadHeavy)
}
