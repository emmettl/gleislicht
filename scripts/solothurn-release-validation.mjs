import assert from 'node:assert/strict'
import { previousServiceDate } from './civil-day.mjs'
import { validateBernSnapshot } from './build-bern-region.mjs'

export const SOLOTHURN_REVIEWED_DATES = ['2026-09-04', '2026-09-06']
export function validateSolothurnRelease(day, morning, trains) {
  const m = day.metadata, release = m.solothurnRelease
  assert.equal(release?.version, 1, 'Solothurn: unsupported release')
  assert(SOLOTHURN_REVIEWED_DATES.includes(m.serviceDate), 'Solothurn: unreviewed date')
  assert.equal(m.dayModel, 'civil day with preceding service-day spillover')
  assert.deepEqual(m.sourceServiceDates, [previousServiceDate(m.serviceDate), m.serviceDate])
  for (const field of ['solothurnRelease', 'dayModel', 'sourceServiceDates', 'sourceHashes', 'geometry', 'scope', 'admission', 'model', 'timetable', 'sources', 'attribution']) assert.deepEqual(morning.metadata[field], m[field], `Solothurn: mixed ${field}`)
  for (const field of ['stops', 'paths', 'edges', 'edgePaths']) assert.deepEqual(morning[field], day[field], `Solothurn: mixed ${field}`)
  assert.equal(release.simplification.toleranceMetres, 5)
  assert(Number.isFinite(release.simplification.maximumDeviationMetres) && release.simplification.maximumDeviationMetres >= 0 && release.simplification.maximumDeviationMetres <= 5, 'Solothurn: excessive display deviation')
  assert.equal(release.simplification.displayVertices, day.paths.reduce((n, p) => n + p.length, 0))
  assert(release.simplification.originalVertices >= release.simplification.displayVertices)
  assert(/^[a-f0-9]{64}$/.test(release.archiveManifestSha256) && /^[a-f0-9]{64}$/.test(release.auditSha256), 'Solothurn: missing archive proof')
  assert(m.geometry.attribution.includes('Solothurn') && m.geometry.attribution.includes('OpenStreetMap'))
  assert(m.geometry.supplements?.contextSha256 && m.geometry.supplements?.roadCacheSha256, 'Solothurn: missing supplementary source proof')
  assert.equal(m.geometry.archiveSha256, m.sources.archiveSha256)
  assert.deepEqual(m.geometry.supplements, m.sources.supplements)
  const headway = trains.filter(t => t.frequency?.exactTimes === 0).length
  assert.deepEqual(release.movements, { total: trains.length, scheduled: trains.length - headway, representativeHeadway: headway })
  assert.equal(release.admittedSegments, trains.reduce((n, t) => n + t.pathSegments.length, 0))
  validateBernSnapshot({ ...day, trains })
  const byId = new Map(trains.map(t => [t.id, t]))
  for (const t of morning.trains) assert.deepEqual(t, byId.get(t.id), 'Solothurn: changed morning journey')
  for (const t of trains) {
    assert(t.sourceTripId && m.sourceServiceDates.includes(t.sourceServiceDate) && t.patternId, 'Solothurn: missing source identity')
    assert(t.start < 86400 && t.end >= 0)
    assert(t.callPermissions.every(([pickup, dropoff]) => [0, 1].includes(pickup) && [0, 1].includes(dropoff)), 'Solothurn: conditional call admitted')
  }
}
