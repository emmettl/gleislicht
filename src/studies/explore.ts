import { ADDITIONAL_REGION_IDS, isAdditionalRegion } from './additional-regions.ts'
import pilotCatalog from '../../data/cantonal-road-pilots.json'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { SwitzerlandNetworkStudy } from '../editions/switzerland.ts'

export const STUDY_IDS = ['national', 'postbus', 'zvv-region', 'geneva-tpg', 'zurich-city', 'rigi-lake', 'contrast', 'jungfrau', 'lausanne-region', 'basel-core', 'bern-region', 'gornergrat', 'solothurn-region', 'nyon-region', 'ticino-region', 'valais-region', 'graubuenden-region', 'pilatus', 'rochers', 'territet', 'riviera-region', ...ADDITIONAL_REGION_IDS] as const
export const REGIONAL_DAYS = { 'luzern-region': 'luzern-region/2026-09-04/study/luzern-region-day-manifest.json', 'zug-region': 'zug-region/2026-09-04/study/zug-region-day-manifest.json', 'thurgau-region': 'thurgau-region/2026-09-04/study/thurgau-region-day-manifest.json', 'fribourg-region': 'fribourg-region/2026-09-04/study/fribourg-region-day-manifest.json', 'riviera-region': 'riviera-region-day-manifest.json', 'valais-region': 'valais-region-day-manifest.json', 'graubuenden-region': 'graubuenden-region/2026-09-04/graubuenden-region-day-manifest.json', 'ticino-region': 'ticino-region/2026-09-04/ticino-region-day-manifest.json', 'nyon-region': 'nyon-region-day-manifest.json', 'solothurn-region': 'solothurn-region-day-manifest.json', 'bern-region': 'bern-region-day-manifest.json', 'basel-core': 'basel-core-day-manifest.json', 'lausanne-region': 'lausanne-region-day-manifest.json', 'zvv-region': 'zvv-region-day-manifest.json', 'geneva-tpg': 'geneva-tpg-day-manifest.json', 'zurich-city': 'zurich-city-day-manifest.json' } as const
export const isRegionalDayStudy = (id: SwitzerlandNetworkStudy): id is keyof typeof REGIONAL_DAYS => id in REGIONAL_DAYS
export function withinStudy(location: { longitude: number; latitude: number }, bounds?: NetworkSnapshot['bounds']) {
  return Boolean(bounds && location.longitude >= bounds.minLongitude && location.longitude <= bounds.maxLongitude && location.latitude >= bounds.minLatitude && location.latitude <= bounds.maxLatitude)
}
export interface StudyLink { postbus?: boolean; sbb?: boolean; glion?: string; study: SwitzerlandNetworkStudy; range: 'morning' | 'day'; time?: number; date?: string; station?: string; train?: string; recording?: string; invalidRecording?: true }
export function readStudyLink(search: string): StudyLink {
  const p = new URLSearchParams(search)
  if (p.has('recording')) {
    const pilot = pilotCatalog.find(entry => entry.id === p.get('recording'))
    const time = p.has('time') ? Number(p.get('time')) : pilot?.initialTime
    if (!pilot || (p.has('date') && p.get('date') !== pilot.serviceDate) || time === undefined || !Number.isFinite(time) || time < pilot.windowStart || time > pilot.windowEnd) {
      return { study: 'national', range: 'morning', invalidRecording: true }
    }
    return { study: 'national', range: 'morning', recording: pilot.id, date: pilot.serviceDate, time }
  }
  const legacyPostbus = p.get('study') === 'postbus'
  const study = legacyPostbus ? 'national' : STUDY_IDS.includes(p.get('study') as SwitzerlandNetworkStudy) ? p.get('study') as SwitzerlandNetworkStudy : 'national'
  const time = p.has('time') ? Number(p.get('time')) : NaN
  const date = p.get('date') ?? ''
  const glion = study === 'territet' && /^\.ojp-91-37-F\.1\.TA\.\d+\.j26$/.test(p.get('glion') ?? '') ? p.get('glion')! : undefined
  return { ...(study === 'national' && (legacyPostbus || p.get('postbus') === '1') ? { postbus: true, sbb: legacyPostbus ? false : p.get('sbb') !== '0' } : {}), ...(glion ? {glion} : {}), study, range: legacyPostbus ? 'day' : p.get('range') === 'day' || ((isAdditionalRegion(study) || ['graubuenden-region', 'valais-region', 'ticino-region', 'lausanne-region', 'basel-core', 'bern-region', 'solothurn-region', 'nyon-region', 'riviera-region'].includes(study)) && p.get('range') !== 'morning') ? 'day' : 'morning', time: Number.isFinite(time) && time >= 0 && time < 86400 ? time : undefined, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined, station: p.get('station')?.slice(0, 200) || undefined, train: p.get('train')?.slice(0, 200) || undefined }
}
