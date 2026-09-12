import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { checkPublicFreshness } from './check-public-freshness.mjs'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
function fixture() {
  const site = 'https://motionstudies.app/gleislicht/', worker = 'https://gleislicht-realtime.louis-emmett.workers.dev/'
  const id = 'a'.repeat(64), baseUrl = `https://data.motionstudies.app/gleislicht/releases/${id}/`
  const now = new Date('2026-09-13T12:00:00Z'), files = new Map()
  const put = (url, value) => { const bytes = JSON.stringify(value); files.set(url, bytes); return bytes }
  const days = ['2026-09-13', '2026-09-14'].map(date => {
    const prefix = `calendar/${date}/`, root = baseUrl + prefix
    const metadata = { serviceDate: date, feedVersion: '20260909', windowStart: 0, windowEnd: 86400 }
    const chunks = Array.from({ length: 8 }, (_, i) => {
      const path = `chunks/${String(i * 3).padStart(2, '0')}-${String(i * 3 + 3).padStart(2, '0')}.json`
      const data = put(root + path, { trains: [] }); return { windowStart: i * 10800, windowEnd: (i + 1) * 10800, path, sha256: hash(data) }
    })
    const manifest = put(root + 'swiss-rail-day-manifest.json', { metadata, chunks })
    const index = put(root + 'swiss-rail-realtime-index.json', { schemaVersion: 1, serviceDate: date, feedVersion: '20260909', manifestSha256: hash(manifest), trips: Object.fromEntries(Array.from({ length: 1001 }, (_, i) => [i, ['a', 'b']])) })
    for (const name of ['zurich-city', 'zvv-region', 'geneva-tpg', 'lausanne-region', 'postbus-national']) put(root + name + '-day-manifest.json', { metadata })
    return { date, feedVersion: '20260909', prefix, indexSha256: hash(index) }
  })
  const calendar = { schemaVersion: 1, baseUrl, days, realtimeUrl: worker + 'realtime.json' }
  put(site + '_timetable-calendar.json', calendar)
  put(site + '_data-release.json', { baseUrl, id })
  put(baseUrl + '_release.json', { id })
  const health = { status: 'ok', alignment: 'published-timetable-v1', indexSha256: days[0].indexSha256, serviceDate: days[0].date, staticFeedVersion: days[0].feedVersion, generatedAt: now.toISOString(), receivedAt: now.toISOString() }
  put(worker + 'health', health)
  put(worker + 'realtime.json', { metadata: health, updates: [] })
  return { now, files, calendar, put, site, worker, health, fetcher: async url => files.has(String(url)) ? new Response(files.get(String(url))) : new Response('', { status: 404 }) }
}
describe('public freshness monitor', () => {
  it('verifies the published app/data/realtime chain and accepts quiet overnight feeds', async () => {
    expect(await checkPublicFreshness(fixture())).toContain('tomorrow ready')
  })
  it('fails on stale realtime, missing tomorrow, disabled LIVE or corrupt movement bytes', async () => {
    for (const failure of ['stale', 'tomorrow', 'disabled', 'corrupt', 'wrong-index']) {
      const f = fixture()
      if (failure === 'stale') f.put(f.worker + 'health', { ...f.health, generatedAt: '2026-09-12T12:00:00Z' })
      if (failure === 'tomorrow') f.put(f.site + '_timetable-calendar.json', { ...f.calendar, days: [f.calendar.days[0]] })
      if (failure === 'disabled') f.put(f.site + '_timetable-calendar.json', { ...f.calendar, realtimeUrl: undefined })
      if (failure === 'corrupt') f.files.set(f.calendar.baseUrl + f.calendar.days[0].prefix + 'chunks/12-15.json', '{}')
      if (failure === 'wrong-index') f.put(f.worker + 'health', { ...f.health, indexSha256: 'b'.repeat(64) })
      await expect(checkPublicFreshness(f)).rejects.toThrow()
    }
  })
})
