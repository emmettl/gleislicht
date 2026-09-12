import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, cp, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { serviceDate } from './service-date.mjs'
import { readRegionalDirectory } from './regional-artifacts.mjs'

export const DAILY_REGIONS = ['zurich-city', 'zvv-region', 'geneva-tpg', 'lausanne-region']
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const nextDate = date => new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
export const refreshedFile = path => /^(?:swiss-(?:rail|hub|cogwheel)|postbus-national|zurich-city|zvv-region|geneva-tpg|lausanne-region)(?:[-/]|\.)/.test(path)

export async function prepareRailDay(directory, expectedDate) {
  serviceDate(expectedDate)
  const json = async file => JSON.parse(await readFile(join(directory, file), 'utf8'))
  const day = await json('swiss-rail-day-manifest.json')
  const { feedVersion, serviceDate: date } = day.metadata
  assert.equal(date, expectedDate, 'Prepared day has the wrong date')
  assert(/^\d{8}$/.test(feedVersion), 'Invalid source feed version')
  assert.equal(day.metadata.windowStart, 0)
  assert.equal(day.metadata.windowEnd, 86400)
  for (const file of ['swiss-rail-morning.json', 'swiss-hub-day.json', 'swiss-cogwheel-catalogue.json', 'postbus-national-day-manifest.json']) {
    const other = await json(file)
    assert.equal(other.metadata.serviceDate, date, `${file}: date mismatch`)
    assert.equal(other.metadata.feedVersion ?? other.metadata.staticFeedVersion, feedVersion, `${file}: feed mismatch`)
  }
  // Validate complete, ordered day coverage and exact source bytes before
  // producing the identity index used by the realtime Worker.
  let end = 0
  const trips = new Map()
  for (const chunk of day.chunks) {
    assert.equal(chunk.windowStart, end, 'Gap or overlap in day chunks')
    assert(chunk.windowEnd > end && chunk.windowEnd <= 86400)
    assert(/^[a-z0-9-]+\/\d{2}-\d{2}\.json$/.test(chunk.path), 'Unsafe national chunk')
    const bytes = await readFile(join(directory, chunk.path))
    assert.equal(bytes.length, chunk.bytes)
    assert.equal(sha256(bytes), chunk.sha256)
    const data = JSON.parse(bytes)
    assert.equal(data.windowStart, chunk.windowStart)
    assert.equal(data.windowEnd, chunk.windowEnd)
    for (const train of data.trains) {
      const stops = train.stops.map(([i]) => day.stops[i]?.[4])
      assert(stops.length >= 2 && stops.every(id => typeof id === 'string' && id), 'Missing source stop identities')
      const previous = trips.get(train.id)
      if (previous) assert.deepEqual(previous, stops, 'Conflicting source trip')
      trips.set(train.id, stops)
    }
    end = chunk.windowEnd
  }
  assert.equal(end, 86400, 'Incomplete day')
  assert(trips.size > 1000, 'Insufficient national trip identities')
  const index = { schemaVersion: 1, serviceDate: date, feedVersion, trips: Object.fromEntries(trips), manifestSha256: sha256(await readFile(join(directory, 'swiss-rail-day-manifest.json'))) }
  const indexBytes = JSON.stringify(index) + '\n'
  await writeFile(join(directory, 'swiss-rail-realtime-index.json'), indexBytes)
  return { date, feedVersion, prefix: `calendar/${date}/`, indexSha256: sha256(indexBytes) }
}

export async function prepareDay(directory, expectedDate) {
  const entry = await prepareRailDay(directory, expectedDate)
  const regional = await readRegionalDirectory(directory, DAILY_REGIONS, expectedDate)
  assert.equal(Object.keys(regional.dates).length, DAILY_REGIONS.length)
  return entry
}

export async function assembleCalendar(directory, tomorrowDirectory, date, output = 'src/editions/timetable-calendar.json') {
  const today = await prepareDay(directory, date)
  const tomorrow = await prepareDay(tomorrowDirectory, nextDate(date))
  await rm(join(directory, 'calendar'), { recursive: true, force: true })
  for (const [source, entry] of [[directory, today], [tomorrowDirectory, tomorrow]]) {
    const destination = join(directory, entry.prefix)
    await mkdir(destination, { recursive: true })
    for (const name of await readdir(source)) if (refreshedFile(name)) await cp(join(source, name), join(destination, name), { recursive: true })
  }
  const calendar = { schemaVersion: 1, days: [today, tomorrow] }
  await writeFile(output, JSON.stringify(calendar, null, 2) + '\n')
  await writeFile(join(directory, 'timetable-calendar.json'), JSON.stringify(calendar) + '\n')
  return calendar
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(await assembleCalendar(process.argv[2], process.argv[3], process.argv[4]))
}
