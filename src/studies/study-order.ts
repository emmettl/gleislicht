import type { SwitzerlandNetworkStudy } from '../editions/switzerland.ts'

/** Overview first, then regional networks and mountain journeys from west to east. */
export const STUDY_ORDER = [
  'national', 'postbus', 'contrast',
  'geneva-tpg', 'nyon-region', 'lausanne-region', 'riviera-region',
  'fribourg-region', 'valais-region', 'bern-region', 'solothurn-region', 'basel-core',
  'luzern-region', 'zug-region', 'zvv-region', 'zurich-city', 'thurgau-region',
  'graubuenden-region', 'ticino-region',
  'territet', 'rochers', 'gornergrat', 'jungfrau', 'pilatus', 'rigi-lake',
] as const satisfies readonly SwitzerlandNetworkStudy[]

export function studyOrder(value: string): number {
  const id = value === 'national-morning' || value === 'national-day' ? 'national' : value
  const index = STUDY_ORDER.indexOf(id as SwitzerlandNetworkStudy)
  return index < 0 ? Infinity : index * 2 + (value === 'national-day' ? 1 : 0)
}
