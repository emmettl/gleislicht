import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const RIVIERA_REVIEWED_DATES = ['2026-09-08', '2026-09-13']
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const read = path => readFileSync(new URL(`../data/riviera-region/${path}`, import.meta.url))

// Bind releases to reviewed topology and complete source journeys, not just
// self-reported coverage. New dates require a new retained audit and fixture.
export function validateRivieraRelease(day, morning, trains) {
  const date = day.metadata.serviceDate
  assert(RIVIERA_REVIEWED_DATES.includes(date), 'Riviera: unreviewed date')
  const auditBytes = read('audit.json'), audit = JSON.parse(auditBytes).days.find(d => d.date === date)
  const archiveBytes = read(`${date}/riviera-region-day-manifest.json`), archive = JSON.parse(archiveBytes)
  const archivedMorning = JSON.parse(read(`${date}/riviera-region-morning.json`))
  assert.deepEqual(day.metadata.rivieraRelease, { version: 1, archiveManifestSha256: digest(archiveBytes), auditSha256: digest(auditBytes) }, 'Riviera: changed release proof')
  for (const field of ['rivieraRelease', 'serviceDate', 'feedVersion', 'agencyIds', 'dayModel', 'sourceServiceDates', 'sourceHashes', 'geometry', 'railGeometry', 'funicularGeometry', 'geometryGate', 'studyScope']) {
    assert.deepEqual(morning.metadata[field], day.metadata[field], `Riviera: mixed ${field}`)
    if (field !== 'rivieraRelease') assert.deepEqual(day.metadata[field], archive.metadata[field], `Riviera: changed reviewed ${field}`)
  }
  for (const field of ['stops', 'paths', 'edges', 'edgePaths']) {
    assert.deepEqual(day[field], archive[field], `Riviera: changed reviewed ${field}`)
    assert.deepEqual(morning[field], archive[field], `Riviera: mixed ${field}`)
  }
  assert.equal(trains.length, audit.completeSourceJourneysChecked, 'Riviera: incomplete journeys')
  assert(audit.gate.passed && audit.groups.every(g => g.coverage === 1 && g.directedPairs === g.acceptedDirectedPairs))
  const source = new Map()
  for (const descriptor of archive.chunks) {
    const bytes = read(`${date}/${descriptor.path}`)
    assert.equal(digest(bytes), descriptor.sha256, 'Riviera: damaged reviewed chunk')
    for (const train of JSON.parse(bytes).trains) source.set(train.id, train)
  }
  for (const train of trains) {
    assert.deepEqual(train, source.get(train.id), 'Riviera: changed reviewed journey')
    assert(train.pathSegments.length === train.stops.length - 1 && train.pathSegments.every(i => i !== null), 'Riviera: missing directed geometry')
  }
  assert.deepEqual(morning.trains, archivedMorning.trains, 'Riviera: changed morning journeys')
}
