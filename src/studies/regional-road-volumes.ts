export type VolumeRegion = 'basel' | 'thurgau' | 'zurich-city'
export const VOLUME_REGIONS: VolumeRegion[] = ['basel', 'thurgau', 'zurich-city']
export interface VolumeCounter {
  id: string; stationId: string; source: VolumeRegion; name: string; directionLabel: string
  coordinate: [number, number]; measurementBasis: 'reported-total' | 'sum-of-published-classes'
  geometryStatus: string; directionStatus: string
  orientation: null | { bearingDegrees: number; method: string; evidence: string; pathId: string }
}
export interface VolumeFile { source: VolumeRegion; serviceDate: string; path: string; sha256: string; bytes: number; series: number }
export interface VolumeIndex {
  metadata: { schemaVersion: number; dates: string[]; measurementKind: string; playbackEligible: false
    sources: Record<string, { publisher: string; license: string; sourceUrl?: string; metadataUrl?: string; licenseUrl?: string }> }
  series: VolumeCounter[]; files: VolumeFile[]
}
export interface VolumeHour {
  value: number | null; reportedValue: number | null
  quality: { status: string; validation: string; sourceFlags: Record<string, unknown> }
  issues: string[]; sourceRow: unknown
}
export interface VolumeSeries {
  detectorId: string; hours: VolumeHour[]; measuredSubtotal: number | null; dayTotal: number | null
  coverage: { expectedHours: number; measuredHours: number; quality: Record<string, number>; issueHours: number }
}
export interface VolumeDay {
  metadata: { schemaVersion: number; source: VolumeRegion; serviceDate: string; measurementKind: string; timeZone: string; playbackEligible: false }
  slots: { start: string; end: string; localStart: string }[]; series: VolumeSeries[]
}
const kind = 'historical-hourly-counter-volumes'
const count = (n: unknown) => n === null || (Number.isSafeInteger(n) && (n as number) >= 0)
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const unique = (values: string[]) => new Set(values).size === values.length

export function validateVolumeIndex(value: unknown): VolumeIndex {
  const data = value as VolumeIndex
  if (data?.metadata?.schemaVersion !== 1 || data.metadata.measurementKind !== kind || data.metadata.playbackEligible !== false || !Array.isArray(data.metadata.dates) || !data.metadata.dates.length || !unique(data.metadata.dates) || data.metadata.dates.some(d => !datePattern.test(d)) || !Array.isArray(data.series) || !data.series.length || !Array.isArray(data.files)) throw new Error('Invalid volume index')
  for (const s of data.series) {
    if (!s || !VOLUME_REGIONS.includes(s.source) || ![s.id, s.name, s.directionLabel, s.stationId, s.geometryStatus, s.directionStatus].every(v => typeof v === 'string') || !['reported-total', 'sum-of-published-classes'].includes(s.measurementBasis) || !Array.isArray(s.coordinate) || s.coordinate.length !== 2 || !s.coordinate.every(Number.isFinite)) throw new Error('Invalid counter')
    if (s.orientation !== null && (s.directionStatus !== 'validated' || s.geometryStatus !== 'axis-candidate' || !Number.isFinite(s.orientation?.bearingDegrees) || s.orientation.bearingDegrees < 0 || s.orientation.bearingDegrees >= 360)) throw new Error('Invalid counter orientation')
  }
  if (!unique(data.series.map(s => s.id)) || !unique(data.files.map(f => `${f.source}/${f.serviceDate}`)) || data.files.length !== VOLUME_REGIONS.length * data.metadata.dates.length) throw new Error('Duplicate or missing volume coverage')
  for (const f of data.files) {
    if (!VOLUME_REGIONS.includes(f.source) || !data.metadata.dates.includes(f.serviceDate) || f.path !== `${f.source}/${f.serviceDate}.json` || !/^[a-f0-9]{64}$/.test(f.sha256) || !Number.isSafeInteger(f.bytes) || f.bytes <= 0 || f.series !== data.series.filter(s => s.source === f.source).length) throw new Error('Invalid volume file identity')
  }
  for (const key of [...VOLUME_REGIONS, 'thurgau-classes']) {
    const source = data.metadata.sources?.[key]
    if (!source || typeof source.publisher !== 'string' || typeof source.license !== 'string') throw new Error('Missing source attribution')
  }
  return data
}

export function validateVolumeDay(value: unknown, file: VolumeFile, index: VolumeIndex): VolumeDay {
  const day = value as VolumeDay
  if (day?.metadata?.schemaVersion !== 1 || day.metadata.measurementKind !== kind || day.metadata.source !== file.source || day.metadata.serviceDate !== file.serviceDate || day.metadata.playbackEligible !== false || day.metadata.timeZone !== 'Europe/Zurich' || !Array.isArray(day.slots) || ![23, 24, 25].includes(day.slots.length) || !Array.isArray(day.series) || day.series.length !== file.series) throw new Error('Invalid hourly volume identity')
  for (const [i, slot] of day.slots.entries()) {
    const start = Date.parse(slot.start), end = Date.parse(slot.end)
    if (!Number.isFinite(start) || end - start !== 3600000 || Date.parse(slot.localStart) !== start || !slot.localStart.startsWith(file.serviceDate) || (i > 0 && Date.parse(day.slots[i - 1].end) !== start)) throw new Error('Invalid hourly slots')
  }
  const ids = new Set(index.series.filter(s => s.source === file.source).map(s => s.id))
  for (const series of day.series) {
    if (!ids.delete(series.detectorId) || !Array.isArray(series.hours) || series.hours.length !== day.slots.length) throw new Error('Invalid counter hours')
    for (const hour of series.hours) {
      if (!count(hour.value) || !count(hour.reportedValue) || !Array.isArray(hour.issues) || !hour.issues.every(issue => typeof issue === 'string') || typeof hour.quality?.status !== 'string' || typeof hour.quality.validation !== 'string') throw new Error('Invalid hour quality')
      const usable = hour.reportedValue !== null && hour.quality.status === 'measured' && hour.issues.length === 0
      if (hour.value !== (usable ? hour.reportedValue : null)) throw new Error('Unmeasured value presented as measured')
    }
    const measured = series.hours.filter(h => h.value !== null)
    const sum = measured.reduce((n, h) => n + h.value!, 0)
    if (series.coverage?.expectedHours !== day.slots.length || series.coverage.measuredHours !== measured.length || series.measuredSubtotal !== (measured.length ? sum : null) || series.dayTotal !== (measured.length === day.slots.length ? sum : null)) throw new Error('Invalid daily total or coverage')
  }
  if (ids.size) throw new Error('Missing counter series')
  return day
}

export async function loadVolumeIndex(base: string, signal: AbortSignal): Promise<VolumeIndex> {
  const response = await fetch(`${base}index.json`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) })
  if (!response.ok) throw new Error('Volume index unavailable')
  return validateVolumeIndex(await response.json())
}
export async function loadVolumeDay(base: string, file: VolumeFile, index: VolumeIndex, signal: AbortSignal): Promise<VolumeDay> {
  const response = await fetch(`${base}${file.path}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) })
  if (!response.ok) throw new Error('Hourly volumes unavailable')
  const bytes = await response.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  if (bytes.byteLength !== file.bytes || sha !== file.sha256) throw new Error('Hourly volume integrity mismatch')
  return validateVolumeDay(JSON.parse(new TextDecoder().decode(bytes)), file, index)
}

export function defaultVolumeCounter(counters: VolumeCounter[]): string {
  return (counters.find(c => c.orientation !== null) ?? counters[0])?.id ?? ''
}
