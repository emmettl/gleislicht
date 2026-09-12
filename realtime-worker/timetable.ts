import type { RealtimeTripUpdate } from '@motionstudies/core/domain/realtime'

export const ALIGNMENT = 'published-timetable-v1'
const CALENDAR_URL = 'https://motionstudies.app/gleislicht/_timetable-calendar.json'
export interface IdentityIndex {
  schemaVersion: number
  serviceDate: string
  feedVersion: string
  manifestSha256: string
  trips: Record<string, string[]>
}
interface PublishedCalendar {
  schemaVersion: number
  baseUrl: string
  days: { date: string; feedVersion: string; prefix: string; indexSha256: string }[]
}
let cached: { key: string; index: IdentityIndex } | undefined
export async function publishedTimetable(date: string, fetcher = fetch): Promise<{ index: IdentityIndex; sha256: string }> {
  const response = await fetcher(CALENDAR_URL, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`Published timetable unavailable: ${response.status}`)
  const calendar = await response.json() as PublishedCalendar
  const day = calendar.schemaVersion === 1 && calendar.days?.find(day => day.date === date)
  if (!day || day.prefix !== `calendar/${date}/` || !/^\d{8}$/.test(day.feedVersion) || !/^[a-f0-9]{64}$/.test(day.indexSha256)) throw new Error('No validated timetable for today')
  if (!/^https:\/\/data\.motionstudies\.app\/gleislicht\/releases\/[a-f0-9]{64}\/$/.test(calendar.baseUrl)) throw new Error('Invalid published data root')
  const url = `${calendar.baseUrl}${day.prefix}swiss-rail-realtime-index.json`
  const key = `${url}:${day.indexSha256}`
  if (cached?.key === key) return { index: cached.index, sha256: day.indexSha256 }
  const result = await fetcher(url, { signal: AbortSignal.timeout(20_000) })
  if (!result.ok) throw new Error(`Timetable identity index unavailable: ${result.status}`)
  const bytes = await result.arrayBuffer()
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('')
  if (hash !== day.indexSha256) throw new Error('Timetable identity checksum mismatch')
  const index = JSON.parse(new TextDecoder().decode(bytes)) as IdentityIndex
  if (index.schemaVersion !== 1 || index.serviceDate !== date || index.feedVersion !== day.feedVersion || !/^[a-f0-9]{64}$/.test(index.manifestSha256) || !index.trips || Object.keys(index.trips).length < 1000 || !Object.values(index.trips).every(stops => Array.isArray(stops) && stops.length >= 2 && stops.every(id => typeof id === 'string' && id))) throw new Error('Invalid timetable identities')
  cached = { key, index }
  return { index, sha256: day.indexSha256 }
}

/** Trip ids alone can be reused by a new feed. Require ordered stop evidence
 * for delays; cancellations may carry just the exact dated trip identity.
 * Sequence numbers are not array positions (Swiss feeds can skip numbers).
 */
export function matchesTimetable(update: RealtimeTripUpdate, index: IdentityIndex): boolean {
  if (!Object.hasOwn(index.trips, update.tripId)) return false
  if (update.startDate && update.startDate !== index.serviceDate.replaceAll('-', '')) return false
  if (update.scheduleRelationship === 'added') return false
  const stops = index.trips[update.tripId]
  const updates = update.stopTimeUpdates ?? []
  if (!updates.length) return Boolean(update.startDate) && (update.scheduleRelationship === 'cancelled' || update.scheduleRelationship === 'deleted')
  let position = -1
  for (const stop of updates) {
    if (!stop.stopId) return false
    const next = stops.indexOf(stop.stopId, position + 1)
    if (next === -1) return false
    position = next
  }
  return true
}
