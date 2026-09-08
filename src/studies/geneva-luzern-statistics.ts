export type SummaryRegion = 'geneva' | 'luzern'
export interface GenevaSummary {
  id: string; name: string; road: string | null; direction: string | null; siredo: number
  dailyMean: { value: number | null; referenceYear: number | null }
  workingDayMean: { value: number | null; referenceYear: number | null }
  morningPeak: number | null; eveningPeak: number | null; peakReferencePeriod: null; availability: string
}
interface Source { schemaVersion: 1; acquiredDate: string; attribution: string; sourceUrl: string; playbackEligible: false }
export interface GenevaData extends Source { source: 'geneva'; basis: 'annual-summary'; records: GenevaSummary[] }
export interface LuzernData extends Source {
  source: 'luzern'; basis: 'average-weekday'; reviewedProfiles: 1; catalogueDailyMean: number; catalogueReferenceYear: null; catalogueDiscrepancy: boolean
  profile: { stationId: string; name: string; period: { startDate: string; endDateInclusive: string }; dailyMean: number; hours: Record<'QS' | 'R1' | 'R2', number[]> }
}
export type SummaryData = GenevaData | LuzernData
export interface SummaryIndex { schemaVersion: 1; files: Record<SummaryRegion, { path: string; bytes: number; sha256: string }> }
const ensure: (condition: unknown) => asserts condition = condition => { if (!condition) throw new Error('Invalid statistical source') }
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const optionalNumber = (v: unknown) => v === null || numeric(v)
const optionalText = (v: unknown) => v === null || typeof v === 'string'
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v))
export function validateSummaryIndex(value: unknown): SummaryIndex {
  ensure(obj(value) && value.schemaVersion === 1 && obj(value.files))
  for (const region of ['geneva', 'luzern']) {
    const f = value.files[region]
    ensure(obj(f) && f.path === `${region}.json` && Number.isInteger(f.bytes) && Number(f.bytes) > 0 && typeof f.sha256 === 'string' && /^[a-f0-9]{64}$/.test(f.sha256))
  }
  return value as unknown as SummaryIndex
}
export function validateSummary(value: unknown, region: SummaryRegion): SummaryData {
  ensure(obj(value) && value.schemaVersion === 1 && value.source === region && value.playbackEligible === false && date(value.acquiredDate) && typeof value.attribution === 'string' && typeof value.sourceUrl === 'string')
  const url = new URL(value.sourceUrl)
  ensure(url.protocol === 'https:' && !url.username && !url.password && url.hostname === (region === 'geneva' ? 'sitg.ge.ch' : 'www.geo.lu.ch'))
  if (region === 'geneva') {
    ensure(value.basis === 'annual-summary' && Array.isArray(value.records) && value.records.length > 0)
    const ids = new Set()
    for (const record of value.records) {
      ensure(obj(record) && typeof record.id === 'string' && record.id.length > 0 && !ids.has(record.id) && typeof record.name === 'string')
      ids.add(record.id)
      ensure(optionalText(record.road) && optionalText(record.direction) && numeric(record.siredo) && typeof record.availability === 'string')
      for (const key of ['dailyMean', 'workingDayMean']) {
        const mean = record[key]
        ensure(obj(mean) && optionalNumber(mean.value) && (mean.referenceYear === null || Number.isInteger(mean.referenceYear) && Number(mean.referenceYear) >= 1900))
      }
      ensure(optionalNumber(record.morningPeak) && optionalNumber(record.eveningPeak) && record.peakReferencePeriod === null)
    }
  } else {
    ensure(value.basis === 'average-weekday' && value.reviewedProfiles === 1 && obj(value.profile))
    const p = value.profile
    ensure(typeof p.stationId === 'string' && typeof p.name === 'string' && obj(p.period) && date(p.period.startDate) && date(p.period.endDateInclusive) && p.period.startDate <= p.period.endDateInclusive && numeric(p.dailyMean) && obj(p.hours))
    for (const key of ['QS', 'R1', 'R2']) ensure(Array.isArray(p.hours[key]) && p.hours[key].length === 24 && p.hours[key].every(numeric))
    ensure(numeric(value.catalogueDailyMean) && value.catalogueReferenceYear === null && value.catalogueDiscrepancy === (value.catalogueDailyMean !== p.dailyMean))
  }
  return value as unknown as SummaryData
}
export async function loadSummary(base: string, region: SummaryRegion, signal: AbortSignal) {
  const manifest = await fetch(base + 'index.json', { signal })
  if (!manifest.ok) throw new Error('Statistics unavailable')
  const index = validateSummaryIndex(await manifest.json()), file = index.files[region]
  const response = await fetch(base + file.path, { signal })
  if (!response.ok) throw new Error('Statistics unavailable')
  const bytes = await response.arrayBuffer()
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('')
  if (bytes.byteLength !== file.bytes || hash !== file.sha256) throw new Error('Statistics integrity failure')
  return validateSummary(JSON.parse(new TextDecoder().decode(bytes)), region)
}
