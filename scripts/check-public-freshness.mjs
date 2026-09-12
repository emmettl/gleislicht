import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { serviceDate } from './service-date.mjs'

const SITE = 'https://motionstudies.app/gleislicht/'
const REALTIME = 'https://gleislicht-realtime.louis-emmett.workers.dev/realtime.json'
const regions = ['zurich-city', 'zvv-region', 'geneva-tpg', 'lausanne-region']
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export async function checkPublicFreshness({ now, fetcher = fetch } = {}) {
  const { date } = serviceDate(undefined, now ?? new Date())
  const request = async url => {
    const response = await fetcher(url, { cache: 'no-store', headers: { Origin: 'https://motionstudies.app' }, signal: AbortSignal.timeout(30_000) })
    assert(response.ok, `${url}: HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }
  const json = async url => JSON.parse(await request(url))
  const calendar = await json(SITE + '_timetable-calendar.json')
  const pointer = await json(SITE + '_data-release.json')
  assert.equal(calendar.schemaVersion, 1, 'Missing published timetable calendar')
  assert(/^https:\/\/data\.motionstudies\.app\/gleislicht\/releases\/[a-f0-9]{64}\/$/.test(calendar.baseUrl), 'Unexpected data host or unpinned release')
  assert.equal(calendar.baseUrl, pointer.baseUrl, 'App calendar and data pointer disagree')
  assert.equal(calendar.realtimeUrl, REALTIME, 'Published app has realtime disabled')
  const release = await json(calendar.baseUrl + '_release.json')
  assert.equal(release.id, pointer.id, 'App references an incomplete release')
  const today = calendar.days.find(day => day.date === date)
  assert(today, `No published timetable for ${date}`)
  const tomorrowDate = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)
  const tomorrow = calendar.days.find(day => day.date === tomorrowDate)
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', hourCycle: 'h23' }).format(now ?? new Date()))
  // The early-morning build prepares the next day; alert by noon if it hasn't.
  assert(hour < 12 || tomorrow, `Tomorrow (${tomorrowDate}) is not prepared by Swiss noon`)
  const validateDay = async day => {
    assert.equal(day.prefix, `calendar/${day.date}/`, 'Unsafe calendar prefix')
    const root = calendar.baseUrl + day.prefix
    const bytes = await request(root + 'swiss-rail-realtime-index.json')
    assert.equal(hash(bytes), day.indexSha256, 'Published realtime index checksum mismatch')
    const index = JSON.parse(bytes)
    assert.equal(index.serviceDate, day.date, 'Index service date mismatch')
    assert.equal(index.feedVersion, day.feedVersion, 'Index feed version mismatch')
    assert(Object.keys(index.trips).length > 1000, 'Published trip identities are incomplete')
    const manifestBytes = await request(root + 'swiss-rail-day-manifest.json')
    assert.equal(hash(manifestBytes), index.manifestSha256, 'Published national manifest checksum mismatch')
    const manifest = JSON.parse(manifestBytes)
    assert.equal(manifest.metadata.serviceDate, day.date, 'National service date mismatch')
    assert.equal(manifest.metadata.feedVersion, day.feedVersion, 'National feed version mismatch')
    let end = 0
    for (const chunk of manifest.chunks) {
      assert.equal(chunk.windowStart, end, 'National timetable has a chunk gap')
      assert(chunk.windowEnd > end && /^[a-z0-9-]+\/\d{2}-\d{2}\.json$/.test(chunk.path), 'Invalid national chunk')
      end = chunk.windowEnd
    }
    assert.equal(end, 86400, 'National timetable is incomplete')
    // Exercise a real movement download, in addition to the small metadata files.
    const chunk = manifest.chunks[Math.floor(hour / 3)]
    assert.equal(hash(await request(root + chunk.path)), chunk.sha256, 'Published movement chunk is missing or corrupt')
    for (const id of [...regions, 'postbus-national']) {
      const regional = await json(root + id + '-day-manifest.json')
      assert.equal(regional.metadata.serviceDate, day.date, `${id}: stale timetable`)
      assert.equal(regional.metadata.windowStart, 0, `${id}: incomplete start`)
      assert.equal(regional.metadata.windowEnd, 86400, `${id}: incomplete end`)
    }
  }
  await validateDay(today)
  if (tomorrow) await validateDay(tomorrow)
  const health = await json(new URL('/health', REALTIME))
  assert.equal(health.status, 'ok', 'Realtime Worker is not ready')
  assert.equal(health.alignment, 'published-timetable-v1', 'Realtime Worker has not been upgraded')
  assert.equal(health.indexSha256, today.indexSha256, 'Realtime Worker is using a different timetable index')
  const live = await json(REALTIME)
  const observedAt = now?.getTime() ?? Date.now()
  for (const metadata of [health, live.metadata]) {
    assert.equal(metadata.serviceDate, date, 'Realtime has the wrong service date')
    assert.equal(metadata.staticFeedVersion, today.feedVersion, 'Realtime has the wrong static feed version')
    for (const field of ['generatedAt', 'receivedAt']) {
      const age = observedAt - Date.parse(metadata[field])
      assert(Number.isFinite(age) && age >= 0 && age <= 150_000, `Realtime ${field} is stale or invalid`)
    }
  }
  return `Public refresh healthy: ${date}, feed ${today.feedVersion}; ${live.updates.length} matched Trip Updates; tomorrow ${tomorrow ? 'ready' : 'due by noon'}.`
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let error
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await checkPublicFreshness()
      console.log(result)
      if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, result + '\n')
      error = undefined
      break
    } catch (failure) {
      error = failure
      console.error(`Freshness check ${attempt + 1}/4: ${failure.message}`)
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 45_000))
    }
  }
  if (error) { console.error(`::error::${error.message}`); process.exitCode = 1 }
}
