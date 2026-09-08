import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { validateAargauFeed } from './build-aargau-study.mjs'
import { geometryDigest, loadAargauAlignmentCorrections } from './aargau-alignment-corrections.mjs'

const read = async file => JSON.parse(await readFile(file, 'utf8'))
const date = '2026-09-04', directory = `fixtures/aargau-reviewed/${date}`, originalDirectory = `fixtures/aargau/${date}`
const policyFile = 'data/aargau-alignment-policy.json'
const corrections = await loadAargauAlignmentCorrections(policyFile, date)
const manifest = await read(`${directory}/aargau-region-day-manifest.json`), audit = await read(`${directory}/audit.json`)
const original = await read(`${originalDirectory}/aargau-region-day-manifest.json`)
const originalAudit = await read(`${originalDirectory}/audit.json`)
const raw = JSON.parse(gunzipSync(await readFile(`data/aargau/${date}-timetable.json.gz`)))
assert.equal(await hashFile(`data/aargau/${date}-timetable.json.gz`), corrections.policy.inputTimetableHashes[date])
assert.equal(manifest.metadata.geometry.alignmentCorrections.policySha256, await hashFile(policyFile))
assert.deepEqual(audit.metadata.alignmentCorrections, manifest.metadata.geometry.alignmentCorrections)
assert.deepEqual(manifest.metadata.attribution, original.metadata.attribution)
assert.deepEqual(manifest.stops, original.stops)
assert.equal(audit.readiness.publicationReady, false)
async function movements(feed, root) {
  const chunks = [], trains = new Map()
  for (const descriptor of feed.chunks) {
    assert.equal(await hashFile(`${root}/${descriptor.path}`), descriptor.sha256)
    const payload = await read(`${root}/${descriptor.path}`)
    chunks.push({ descriptor, payload })
    for (const t of payload.trains) { if (trains.has(t.id)) assert.deepEqual(trains.get(t.id), t); trains.set(t.id, t) }
  }
  return { chunks, trains }
}
const current = await movements(manifest, directory), previous = await movements(original, originalDirectory)
validateAargauFeed({ ...manifest, trains: [...current.trains.values()] }, raw, manifest, current.chunks)
assert.deepEqual(new Set(current.trains.keys()), new Set(previous.trains.keys()))
const oldPatterns = new Map(originalAudit.patterns.map(p => [p.id, p]))
const newPatterns = new Map(audit.patterns.map(p => [p.id, p]))
assert.deepEqual(new Set(newPatterns.keys()), new Set(oldPatterns.keys()))
const rawTrains = new Map(raw.trains.map(t => [t.id, t]))
let preserved = 0, changed = 0, agis = 0, osm = 0, fot = 0
const correctionsSeen = []
for (const train of current.trains.values()) {
  const old = previous.trains.get(train.id)
  const { pathSegments: _newPaths, ...identity } = train
  const { pathSegments: _oldPaths, ...oldIdentity } = old
  assert.deepEqual(identity, oldIdentity)
  const p = newPatterns.get(train.geometryPatternId), prior = oldPatterns.get(train.geometryPatternId)
  for (const [i, s] of p.segments.entries()) {
    const before = original.paths[old.pathSegments[i]], after = manifest.paths[train.pathSegments[i]]
    assert.deepEqual(after, manifest.paths[s.pathIndex])
    if (s.alignmentCorrectionId) {
      const t = rawTrains.get(train.id), stops = train.stops.map(([index]) => manifest.stops[index])
      const expected = corrections.overrideSegment(t, stops, i, { ...prior.segments[i], path: before })
      assert.equal(expected.alignmentCorrectionId, s.alignmentCorrectionId)
      assert.deepEqual(after, expected.path)
      assert.deepEqual(s.supersededGeometry, expected.supersededGeometry)
      assert.notEqual(geometryDigest(before), geometryDigest(after))
      correctionsSeen.push({ id: s.alignmentCorrectionId, trainId: train.id, patternId: p.id, segmentIndex: i, fromId: s.fromId, toId: s.toId,
        originalPathSha256: geometryDigest(before), replacementPathSha256: geometryDigest(after), originalMetres: prior.segments[i].pathMetres, replacementMetres: s.pathMetres })
      changed++
    } else { assert.deepEqual(after, before, `Unreviewed changed path: ${train.id}:${i}`); preserved++ }
    if (s.geometrySource === 'agis') agis++
    else if (s.geometrySource === 'osm') osm++
    else if (s.geometrySource === 'fot') fot++
    else assert.fail('Missing geometry source')
  }
}
const countsByRule = Object.fromEntries(corrections.policy.rules.map(r => [r.id, correctionsSeen.filter(c => c.id === r.id).length]))
assert.deepEqual(countsByRule, corrections.policy.expectedOccurrencesByRule)
const priorPolicy = await read(corrections.policy.previousReview.policyFile), priorRegression = await read(corrections.policy.previousReview.regressionFile)
assert.equal(await hashFile(corrections.policy.previousReview.policyFile), priorRegression.policySha256)
for (const r of priorPolicy.rules) assert.deepEqual(corrections.policy.rules.find(now => now.id === r.id), r)
for (const c of priorRegression.corrections) assert.deepEqual(correctionsSeen.find(now => now.id === c.id && now.trainId === c.trainId && now.segmentIndex === c.segmentIndex), c)
assert.equal(changed + preserved, audit.totals.total)
assert.equal(audit.totals.matched, audit.totals.total)
assert.equal(agis, audit.totals.officialMatched); assert.equal(osm, audit.totals.roadMatched); assert.equal(fot, audit.totals.railMatched)
const morning = await read(`${directory}/aargau-region-morning.json`)
assert.deepEqual(morning.metadata.geometry, manifest.metadata.geometry)
for (const t of morning.trains) assert.deepEqual(t, current.trains.get(t.id))
assert.deepEqual(new Set(morning.trains.map(t => t.id)), new Set([...current.trains.values()].filter(t => t.start <= 31500 && t.end >= 24300).map(t => t.id)))
const report = { schemaVersion: 1, date, originalManifestSha256: await hashFile(`${originalDirectory}/aargau-region-day-manifest.json`),
  candidateManifestSha256: await hashFile(`${directory}/aargau-region-day-manifest.json`), policySha256: await hashFile(policyFile),
  originalAuditSha256: await hashFile(`${originalDirectory}/audit.json`), candidateAuditSha256: await hashFile(`${directory}/audit.json`),
  previousCandidateManifestSha256: priorRegression.candidateManifestSha256, previousCorrectionsPreserved: true, countsByRule,
  journeys: current.trains.size, preservedOccurrences: preserved, correctedOccurrences: changed, corrections: correctionsSeen,
  completeSourceJourneysPreserved: true, allOtherGeometryPreserved: true, passed: true, publicationReady: false }
const reportPath = 'data/aargau-seasonal/alignment-correction-regression.json'
if (process.argv.includes('--write')) await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
else assert.deepEqual(await read(reportPath), report)
console.log(`Verified ${report.journeys} unchanged journeys, ${preserved} preserved segments and ${changed} exact reviewed corrections`)
