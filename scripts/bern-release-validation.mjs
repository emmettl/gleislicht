import assert from 'node:assert/strict'
import { previousServiceDate } from './civil-day.mjs'
import { validateBernSnapshot } from './build-bern-region.mjs'

export const BERN_REVIEWED_DATES = ['2026-09-04', '2026-09-06']
export function validateBernRelease(day, morning, trains) {
  const m = day.metadata, release = m.bernRelease
  assert.equal(release?.version, 1, 'Bern: unsupported release')
  assert(BERN_REVIEWED_DATES.includes(m.serviceDate), 'Bern: unreviewed date')
  assert.equal(m.dayModel, 'civil day with preceding service-day spillover')
  assert.deepEqual(m.sourceServiceDates, [previousServiceDate(m.serviceDate), m.serviceDate])
  for (const field of ['bernRelease', 'dayModel', 'sourceServiceDates', 'sourceHashes', 'geometry', 'scope', 'admission', 'model', 'timetable']) assert.deepEqual(morning.metadata[field], m[field], `Bern: mixed ${field}`)
  for (const field of ['stops', 'paths', 'edges', 'edgePaths']) assert.deepEqual(morning[field], day[field], `Bern: mixed ${field}`)
  assert.equal(release.simplification.toleranceMetres, 5)
  assert(Number.isFinite(release.simplification.maximumDeviationMetres) && release.simplification.maximumDeviationMetres >= 0 && release.simplification.maximumDeviationMetres <= 5, 'Bern: excessive display deviation')
  assert.equal(release.simplification.displayVertices, day.paths.reduce((n, p) => n + p.length, 0))
  assert(release.simplification.originalVertices >= release.simplification.displayVertices)
  assert(/^[a-f0-9]{64}$/.test(release.archiveManifestSha256) && /^[a-f0-9]{64}$/.test(release.auditSha256), 'Bern: missing archive proof')
  assert(m.geometry.attribution.includes('Amt für öffentlichen Verkehr'))
  assert.equal(m.geometry.archiveSha256, m.sourceHashes.geometryArchive)
  const headway = trains.filter(t => t.frequency?.exactTimes === 0).length
  assert.deepEqual(release.movements, { total: trains.length, scheduled: trains.length - headway, representativeHeadway: headway })
  assert.equal(release.admittedSegments, trains.reduce((n, t) => n + t.pathSegments.length, 0))
  validateBernSnapshot({ ...day, trains })
  const byId = new Map(trains.map(t => [t.id, t]))
  for (const t of morning.trains) assert.deepEqual(t, byId.get(t.id), 'Bern: changed morning journey')
  for (const t of trains) {
    assert(t.sourceTripId && m.sourceServiceDates.includes(t.sourceServiceDate) && t.patternId, 'Bern: missing source identity')
    assert(t.start < 86400 && t.end >= 0)
    assert(t.callPermissions.every(([pickup, dropoff]) => [0, 1].includes(pickup) && [0, 1].includes(dropoff)), 'Bern: conditional call admitted')
  }
}
