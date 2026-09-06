import type { ServiceCategory } from './domain/network.ts'

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
