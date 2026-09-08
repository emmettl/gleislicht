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
  for (const [name, sourceId, documentCount] of [
    ['ir66', 'bern-ir66-reviewed-fot-rail-20210706', 2],
    ['ir16', 'bern-ir16-reviewed-fot-rail-20210706', 2],
    ['tpfTerminal', 'bern-tpf-fribourg-reviewed-fot-rail-20210706', 1],
    ['morges', 'bern-morges-reviewed-fot-rail-20210706', 3],
    ['interlaken', 'bern-interlaken-reviewed-fot-rail-20210706', 0],
    ['ic61', 'bern-ic61-reviewed-fot-rail-20210706', 1],
    ['ic61Platforms', 'bern-ic61-platforms-reviewed-fot-rail-20210706', 2],
  ]) {
    if (!m.sourceHashes[`${name}Policy`]) continue
    const r = m.geometry[`${name}Supplement`]
    assert.equal(r?.policySha256, m.sourceHashes[`${name}Policy`], `Bern: missing ${name} evidence hash`)
    assert.equal(r.sourceId, sourceId)
    assert(r.source.attribution.includes('Federal Office of Transport'), `Bern: missing ${name} source attribution`)
    assert.equal(r.source.sha256, m.geometry.railSupplement.source.sha256)
    assert(r.documents.length === documentCount && r.documents.every(d => d.attribution && d.url && /^[a-f0-9]{64}$/.test(d.sha256)), `Bern: missing ${name} document attribution`)
    assert.deepEqual(r.fullEvidence, { path: 'bern-region/sources.json', field: `${name}Supplement` })
    if (name === 'morges') {
      assert.equal(r.sbbPlatformDataset?.publisher, 'SBB Infrastructure')
      assert.equal(r.sbbPlatformDataset?.rights, 'NonCommercialAllowed-CommercialAllowed-ReferenceRequired')
      assert.equal(r.sbbPlatformDataset?.dataProcessed, '2026-09-01T22:03:57+00:00')
      assert.equal(r.sbbPlatformDataset?.termsUrl, 'https://data.sbb.ch/page/licence')
    }
  }
  for (const [name, hash, credit] of [['urban', 'urbanPolicy', 'OpenStreetMap'], ['regionalRoad', 'regionalRoadPolicy', 'OpenStreetMap'], ['mountain', 'mountainPolicy', 'Federal Office of Transport']]) {
    const r = m.geometry[`${name}Supplement`]
    const source = r?.source ?? r?.policy?.roadSource
    assert.equal(r?.policySha256, m.sourceHashes[hash], `Bern: missing ${name} policy hash`)
    assert(source.attribution.includes(credit), `Bern: missing ${name} credit`)
    assert(source.termsUrl || source.licenseUrl, `Bern: missing ${name} terms`)
    // Previously published full-policy metadata remains readable, with credit checked too.
    if (!r.policy) assert.deepEqual(r.fullEvidence, { path: 'bern-region/sources.json', field: `${name}Supplement` })
  }
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
