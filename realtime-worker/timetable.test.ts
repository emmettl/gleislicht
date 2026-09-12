import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { matchesTimetable, publishedTimetable, type IdentityIndex } from './timetable.ts'
const index: IdentityIndex = { schemaVersion: 1, serviceDate: '2026-09-13', feedVersion: '20260909', manifestSha256: 'a'.repeat(64), trips: { train: ['a', 'b', 'c'] } }
describe('published timetable alignment', () => {
  it('matches source stops in order without treating GTFS sequence numbers as array offsets', () => {
    expect(matchesTimetable({ tripId: 'train', startDate: '20260913', stopTimeUpdates: [{ stopId: 'a', stopSequence: 10 }, { stopId: 'c', stopSequence: 30 }] }, index)).toBe(true)
    expect(matchesTimetable({ tripId: 'train', stopTimeUpdates: [{ stopId: 'c' }, { stopId: 'a' }] }, index)).toBe(false)
  })
  it('rejects new trip ids, reused trips with different stops, unknown sequences and wrong dates', () => {
    for (const update of [
      { tripId: 'new', stopTimeUpdates: [{ stopId: 'a' }] },
      { tripId: 'train', stopTimeUpdates: [{ stopId: 'changed' }] },
      { tripId: 'train', stopTimeUpdates: [{ stopSequence: 1 }] },
      { tripId: 'train', startDate: '20260912', stopTimeUpdates: [{ stopId: 'a' }] },
      { tripId: 'train', stopTimeUpdates: [] },
    ]) expect(matchesTimetable(update, index)).toBe(false)
    expect(matchesTimetable({ tripId: 'train', startDate: '20260913', scheduleRelationship: 'cancelled', stopTimeUpdates: [] }, index)).toBe(true)
  })
  it('loads an immutable index only when the calendar, bytes and internal identities agree', async () => {
    const large = { ...index, trips: Object.fromEntries(Array.from({ length: 1001 }, (_, i) => [`trip-${i}`, ['a', 'b']])) }
    const bytes = JSON.stringify(large)
    const day = { date: index.serviceDate, feedVersion: index.feedVersion, prefix: `calendar/${index.serviceDate}/`, indexSha256: createHash('sha256').update(bytes).digest('hex') }
    const calendar = { schemaVersion: 1, baseUrl: `https://data.motionstudies.app/gleislicht/releases/${'b'.repeat(64)}/`, days: [day] }
    const fetcher = async (url: string | URL | Request) => new Response(String(url).endsWith('_timetable-calendar.json') ? JSON.stringify(calendar) : bytes)
    expect((await publishedTimetable(index.serviceDate, fetcher)).index.feedVersion).toBe(index.feedVersion)
    await expect(publishedTimetable('2026-09-14', fetcher)).rejects.toThrow('No validated timetable')
    day.indexSha256 = 'f'.repeat(64)
    await expect(publishedTimetable(index.serviceDate, fetcher)).rejects.toThrow('checksum')
    calendar.baseUrl = 'https://untrusted.example/'
    await expect(publishedTimetable(index.serviceDate, fetcher)).rejects.toThrow('data root')
  })
})
