export const STATISTIC_METRICS = ['DTV', 'DTV24', 'DWV24', 'DTVt', 'DTVn', 'MSPW', 'ASPW'] as const
export type StatisticMetric = typeof STATISTIC_METRICS[number]
export interface StatisticStation { id: string; name: string; municipality: string; owner: string; road: string; shard: string; records: number }
export interface StatisticRecord {
  id: string; year: number
  period: { startLocal: string | null; endExclusiveLocal: string | null; timezone: 'Europe/Zurich'; status: 'available' | 'missing' | 'invalid' }
  direction: { scope: 'both' | '1' | '2'; destination: string | null; geometryReviewed: false }
  latestPlausible: boolean; metrics: Record<StatisticMetric, number | null>
  quality: 'report-unreviewed' | 'report-reviewed-with-substitution'; reportUrl: string | null
  substitution: { date: string; replacement: string } | null
}
export interface StatisticIndex {
  schemaVersion: 1; productType: 'road-survey-statistics'; playbackEligible: false; acquiredDate: string
  attribution: string; sourceUrl: string; archiveSha256: string; stations: StatisticStation[]
  files: Record<string, { path: string; bytes: number; sha256: string }>
}
const ensure: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message) }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown) => typeof value === 'string'
const hash = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const civil = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}Z`))
export const safeReportUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'www.ag.ch' && !url.username && !url.password } catch { return false }
}
export function validateStatisticIndex(input: unknown): StatisticIndex {
  ensure(object(input) && input.schemaVersion === 1 && input.productType === 'road-survey-statistics' && input.playbackEligible === false, 'Invalid statistical product')
  ensure(text(input.acquiredDate) && text(input.attribution) && safeReportUrl(input.sourceUrl) && hash(input.archiveSha256), 'Invalid source metadata')
  ensure(Array.isArray(input.stations) && input.stations.length > 0 && object(input.files), 'Missing stations')
  const ids = new Set<string>()
  for (const station of input.stations) {
    ensure(object(station) && ['id', 'name', 'municipality', 'owner', 'road', 'shard'].every(key => text(station[key])), 'Invalid station')
    const s = station as unknown as StatisticStation
    ensure(!ids.has(s.id) && s.id.length > 0 && Number.isInteger(s.records) && s.records > 0 && /^[a-f0-9]$/.test(s.shard), 'Invalid station identity')
    ids.add(s.id)
    const file = input.files[s.shard]
    ensure(object(file) && file.path === `${s.shard}.json` && Number.isInteger(file.bytes) && Number(file.bytes) > 0 && hash(file.sha256), 'Invalid shard metadata')
  }
  return input as unknown as StatisticIndex
}
export function validateStatisticShard(input: unknown, shard: string, index: StatisticIndex): Record<string, StatisticRecord[]> {
  ensure(object(input) && input.schemaVersion === 1 && input.shard === shard && object(input.stations), 'Invalid shard identity')
  const expected = index.stations.filter(s => s.shard === shard)
  ensure(Object.keys(input.stations).length === expected.length, 'Unexpected station coverage')
  const ids = new Set<string>()
  for (const station of expected) {
    const rows = input.stations[station.id]
    ensure(Array.isArray(rows) && rows.length === station.records, 'Incomplete station records')
    for (const row of rows) {
      ensure(object(row) && typeof row.id === 'string' && /^agis:[a-f0-9]{64}$/.test(row.id) && !ids.has(row.id), 'Duplicate or invalid record identity')
      ids.add(row.id)
      ensure(Number.isInteger(row.year) && Number(row.year) >= 1900 && typeof row.latestPlausible === 'boolean', 'Invalid reference year')
      ensure(object(row.period) && row.period.timezone === 'Europe/Zurich', 'Invalid period')
      const p = row.period
      ensure((p.startLocal === null || civil(p.startLocal)) && (p.endExclusiveLocal === null || civil(p.endExclusiveLocal)), 'Invalid civil date')
      const status = p.startLocal === null && p.endExclusiveLocal === null ? 'missing' : p.startLocal === null || p.endExclusiveLocal === null || String(p.startLocal) >= String(p.endExclusiveLocal) ? 'invalid' : 'available'
      ensure(p.status === status, 'Hidden period issue')
      ensure(object(row.direction) && ['both', '1', '2'].includes(String(row.direction.scope)) && (row.direction.destination === null || text(row.direction.destination)) && row.direction.geometryReviewed === false, 'Invalid direction')
      ensure(object(row.metrics) && STATISTIC_METRICS.every(key => row.metrics && object(row.metrics) && (row.metrics[key] === null || typeof row.metrics[key] === 'number' && Number.isFinite(row.metrics[key]) && Number(row.metrics[key]) >= 0)), 'Invalid statistic')
      ensure(row.reportUrl === null || safeReportUrl(row.reportUrl), 'Unsafe report URL')
      ensure(row.quality === 'report-unreviewed' && row.substitution === null || row.quality === 'report-reviewed-with-substitution' && object(row.substitution) && civil(`${row.substitution.date}T00:00:00`) && civil(`${row.substitution.replacement}T00:00:00`), 'Hidden report qualification')
    }
  }
  return input.stations as unknown as Record<string, StatisticRecord[]>
}
export async function loadStatisticIndex(base: string, signal: AbortSignal) {
  const response = await fetch(`${base}index.json`, { signal })
  if (!response.ok) throw new Error('Statistics unavailable')
  return validateStatisticIndex(await response.json())
}
export async function loadStatisticShard(base: string, station: StatisticStation, index: StatisticIndex, signal: AbortSignal) {
  const file = index.files[station.shard]
  const response = await fetch(base + file.path, { signal })
  if (!response.ok) throw new Error('Statistics unavailable')
  const bytes = await response.arrayBuffer()
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('')
  if (bytes.byteLength !== file.bytes || digest !== file.sha256) throw new Error('Statistics integrity failure')
  return validateStatisticShard(JSON.parse(new TextDecoder().decode(bytes)), station.shard, index)[station.id]
}
export function defaultStatisticRecord(records: StatisticRecord[]) {
  return [...records].sort((a, b) => Number(b.latestPlausible) - Number(a.latestPlausible) || b.year - a.year || Number(a.direction.scope !== 'both') - Number(b.direction.scope !== 'both') || (b.period.startLocal ?? '').localeCompare(a.period.startLocal ?? '') || a.id.localeCompare(b.id))[0]
}
