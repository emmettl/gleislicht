
export const ADDITIONAL_REGION_IDS = ['luzern-region', 'zug-region', 'thurgau-region', 'fribourg-region'] as const
export type AdditionalRegionId = typeof ADDITIONAL_REGION_IDS[number]
export const REGIONAL_FIXTURE_DATES = ['2026-09-04', '2026-09-06'] as const
export const isAdditionalRegion = (id: string): id is AdditionalRegionId => ADDITIONAL_REGION_IDS.some(value => value === id)
export const additionalRegionDate = (date?: string) => REGIONAL_FIXTURE_DATES.find(value => value === date) ?? REGIONAL_FIXTURE_DATES[0]

export const ADDITIONAL_REGIONS = {
  'luzern-region': { name: 'Luzern', code: 'LU' },
  'zug-region': { name: 'Zug', code: 'ZG' },
  'thurgau-region': { name: 'Thurgau', code: 'TG' },
  'fribourg-region': { name: 'Fribourg', code: 'FR' },
} as const

export function additionalRegionKey(id: AdditionalRegionId, date?: string) {
  return `${id}/${additionalRegionDate(date)}/study`
}
