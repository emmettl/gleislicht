import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const NYON_REVIEWED_DATES = ['2026-09-08', '2026-09-13']
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const read = path => readFileSync(new URL(`../data/nyon-region/${path}`, import.meta.url))

// Bind releases to reviewed topology and complete source journeys, not just
// self-reported coverage. New dates require a new retained audit and fixture.
export function validateNyonRelease(day, morning, trains) {
  const date = day.metadata.serviceDate
  assert(NYON_REVIEWED_DATES.includes(date), 'Nyon: unreviewed date')
  const auditBytes = read('audit.json'), audit = JSON.parse(auditBytes).days.find(d => d.date === date)
  const archiveBytes = read(`${date}/nyon-region-day-manifest.json`), archive = JSON.parse(archiveBytes)
  const archivedMorning = JSON.parse(read(`${date}/nyon-region-morning.json`))
  assert.deepEqual(day.metadata.nyonRelease, { version: 1, archiveManifestSha256: digest(archiveBytes), auditSha256: digest(auditBytes) }, 'Nyon: changed release proof')
  for (const field of ['nyonRelease', 'serviceDate', 'feedVersion', 'agencyIds', 'dayModel', 'sourceServiceDates', 'sourceHashes', 'geometry', 'railGeometry', 'studyScope']) {
    assert.deepEqual(morning.metadata[field], day.metadata[field], `Nyon: mixed ${field}`)
    if (field !== 'nyonRelease') assert.deepEqual(day.metadata[field], archive.metadata[field], `Nyon: changed reviewed ${field}`)
  }
  for (const field of ['stops', 'paths', 'edges', 'edgePaths']) {
    assert.deepEqual(day[field], archive[field], `Nyon: changed reviewed ${field}`)
    assert.deepEqual(morning[field], archive[field], `Nyon: mixed ${field}`)
  }
  assert.equal(trains.length, audit.completeSourceJourneysChecked, 'Nyon: incomplete journeys')
  assert(audit.groups.length === 3 && audit.groups.every(g => g.coverage === 1 && g.directedPairs === g.acceptedDirectedPairs))
  const source = new Map()
  for (const descriptor of archive.chunks) {
    const bytes = read(`${date}/${descriptor.path}`)
    assert.equal(digest(bytes), descriptor.sha256, 'Nyon: damaged reviewed chunk')
    for (const train of JSON.parse(bytes).trains) source.set(train.id, train)
  }
  for (const train of trains) {
    assert.deepEqual(train, source.get(train.id), 'Nyon: changed reviewed journey')
    assert(train.pathSegments.length === train.stops.length - 1 && train.pathSegments.every(i => i !== null), 'Nyon: missing directed geometry')
  }
  assert.deepEqual(morning.trains, archivedMorning.trains, 'Nyon: changed morning journeys')
}
