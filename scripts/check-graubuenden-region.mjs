import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { readJson, saveJson, coverage } from './build-graubuenden-region.mjs'
import { loadGraubuendenGeometry } from './graubuenden-geometry.mjs'
import { validateLuzernSnapshot } from './build-luzern-region.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { importRoadShapes } from './enrich-postbus-roads.mjs'

const root = 'public/data/graubuenden-region', audit = 'data/graubuenden-audit'
const raw = await readJson(join(audit, 'timetable.json.gz')), policy = await readJson('data/graubuenden-policy.json')
const inventory = await readJson(join(audit, 'routes.json')), summary = await readJson(join(audit, 'summary.json')), index = await readJson(join(root, 'index.json'))
assert.equal(summary.sourceHashes.timetable, sha256(await readFile(join(audit, 'timetable.json.gz'))))
assert.equal(summary.sourceHashes.timetable, policy.timetableSha256)
assert.equal(raw.sourceHashes.archive, policy.feedSha256)
assert.equal(raw.sourceHashes.boundary, sha256(await readFile('data/graubuenden-sources/boundary.json')))
assert.equal(summary.sourceHashes.policy, sha256(await readFile('data/graubuenden-policy.json')))
assert.deepEqual(inventory.map(({ days, status, ...r }) => r), raw.inventory, 'Every annual candidate must remain in inventory')
assert.equal(summary.annualAgencies, new Set(inventory.map(r => r.agencyId)).size)
assert.equal(raw.scope.annualScopedTripRecords, inventory.reduce((n, r) => n + r.annualTripRecords, 0))
const geometry = await loadGraubuendenGeometry(policy, raw), routes = new Map(raw.inventory.map(r => [r.routeId, r])), memo = new Map()
// Reconstruct OSM paths from original hashed matcher outputs, not cache labels.
const source = await readJson('data/graubuenden-roads/sources.json'), temp = await mkdtemp(join(tmpdir(), 'graubuenden-check-'))
try {
  for (const [name, hash] of Object.entries(source.files)) {
    const b = gunzipSync(await readFile(`data/graubuenden-roads/${name}.gz`)); assert.equal(sha256(b), hash); await writeFile(join(temp, name), b)
  }
  assert.deepEqual(await importRoadShapes(temp, source.source), geometry.roads, 'OSM evidence does not reproduce')
} finally { await rm(temp, { recursive: true, force: true }) }
const results = []
for (const day of raw.snapshots) {
  const report = await readJson(join(audit, `${day.date}.json`)), entry = index.dates.find(d => d.date === day.date), manifestBytes = await readFile(join(root, entry.manifest)), morningBytes = await readFile(join(root, entry.morning))
  assert.equal(sha256(manifestBytes), entry.manifestSha256); assert.equal(sha256(morningBytes), entry.morningSha256)
  const manifest = JSON.parse(manifestBytes), morning = JSON.parse(morningBytes), actual = new Map(), expected = new Map(), pp = new Map(report.patterns.map(p => [p.id, p])), occurrences = new Map(), headways = new Map(), carryIns = new Map()
  assert.deepEqual(manifest.metadata.sourceHashes, summary.sourceHashes); assert.deepEqual(morning.metadata.sourceHashes, summary.sourceHashes)
  assert.equal(manifest.metadata.serviceDate, day.date); assert.equal(morning.metadata.serviceDate, day.date)
  for (const t of day.trains) {
    const key = directedPatternKey(t), id = sha256(key).slice(0, 20), p = pp.get(id), route = routes.get(t.routeId)
    assert(p, 'Unaccounted source pattern'); assert.deepEqual(p.stopIds, t.calls.map(c => c.id)); assert.deepEqual(p.callRules, t.calls.map(c => [c.pickupType, c.dropOffType]))
    assert.equal(p.routeId, t.routeId); assert.equal(p.directionId, t.directionId)
    occurrences.set(id, (occurrences.get(id) ?? 0) + 1)
    headways.set(id, (headways.get(id) ?? 0) + Number(t.frequency?.exactTimes === 0)); carryIns.set(id, (carryIns.get(id) ?? 0) + Number(t.sourceServiceDate !== day.date))
    if (!memo.has(key)) memo.set(key, geometry.matchPattern(t, route))
    const pairs = memo.get(key), reasons = [...new Set(pairs.filter(p => !p.path).map(p => p.reason))]
    if (t.calls.some(c => ['2', '3'].includes(c.pickupType) || ['2', '3'].includes(c.dropOffType))) reasons.push('prior-arrangement-call')
    assert.deepEqual(p.reasons, reasons); assert.equal(p.admitted, !reasons.length)
    assert.equal(p.pairs.length, pairs.length)
    pairs.forEach(({ path, ...evidence }, i) => {
      assert.deepEqual(p.pairs[i], { fromId: t.calls[i].id, toId: t.calls[i + 1].id, matched: Boolean(path), geometrySha256: path ? sha256(JSON.stringify(path)) : null, ...evidence }, 'Changed directed geometry provenance')
    })
    if (p.admitted) expected.set(t.id, t)
  }
  assert.equal(occurrences.size, pp.size)
  for (const p of pp.values()) { assert.equal(p.trips, occurrences.get(p.id)); assert.equal(p.headwayTrips, headways.get(p.id)); assert.equal(p.carryInTrips, carryIns.get(p.id)) }
  assert.deepEqual(coverage(report.patterns), Object.fromEntries(Object.keys(coverage(report.patterns)).map(k => [k, k === 'patterns' ? report.patterns.length : report[k]])))
  assert.equal(report.trips, day.trains.length)
  const summaryDay = summary.days.find(d => d.date === day.date)
  for (const [key, value] of Object.entries(coverage(report.patterns))) assert.deepEqual(summaryDay[key === 'patterns' ? 'patternCount' : key], value)
  for (const [field, groups] of [['mode', report.byMode], ['agencyId', report.byAgency]]) for (const group of groups) {
    for (const [key, value] of Object.entries(coverage(report.patterns.filter(p => p[field] === group.id)))) assert.deepEqual(group[key], value)
  }
  assert.deepEqual(summaryDay.byMode, report.byMode); assert.deepEqual(summaryDay.byAgency, report.byAgency)
  for (const route of inventory) assert.deepEqual(route.days.find(d => d.date === day.date), { date: day.date, ...coverage(report.patterns.filter(p => p.routeId === route.routeId)) })
  function check(t, snapshot) {
    const source = expected.get(t.id); assert(source, 'Excluded or invented trip entered feed')
    assert.deepEqual(t.stops.map(([i, arrival, departure], j) => ({ id: snapshot.stops[i][4], arrival, departure, sequence: t.sourceCallSequences[j], pickupType: t.callRules[j][0], dropOffType: t.callRules[j][1] })), source.calls, 'Changed or cropped calls')
    for (const key of ['sourceTripId', 'sourceServiceDate', 'sourceServiceDayOffset', 'frequency', 'directionId', 'routeId', 'headsign', 'shortName']) assert.deepEqual(t[key], source[key], `Changed ${key}`)
    const pattern = pp.get(t.patternId); assert(pattern?.admitted)
    assert.equal(t.geometrySource, pattern.mode === 'bus' ? 'osm' : pattern.pairs.some(p => p.geometrySource === 'fot-reviewed-stop-anchor') ? 'fot-reviewed-stop-anchor' : 'fot')
    t.pathSegments.forEach((i, j) => assert.equal(sha256(JSON.stringify(snapshot.paths[i])), pattern.pairs[j].geometrySha256))
  }
  assert.equal(manifest.chunks.length, 12)
  for (const [i, descriptor] of manifest.chunks.entries()) {
    assert.equal(descriptor.windowStart, i * 7200); assert.equal(descriptor.windowEnd, (i + 1) * 7200)
    const bytes = await readFile(join(root, day.date, descriptor.path)); assert.equal(bytes.length, descriptor.bytes); assert.equal(sha256(bytes), descriptor.sha256)
    const chunk = JSON.parse(bytes); assert.equal(chunk.trains.length, descriptor.tripCount)
    const expectedIds = [...expected.values()].filter(t => t.calls[0].departure <= descriptor.windowEnd && t.calls.at(-1).arrival >= descriptor.windowStart).map(t => t.id).sort()
    assert.deepEqual(chunk.trains.map(t => t.id).sort(), expectedIds, 'Wrong chunk membership')
    for (const t of chunk.trains) { check(t, manifest); if (actual.has(t.id)) assert.deepEqual(actual.get(t.id), t); actual.set(t.id, t) }
  }
  assert.equal(actual.size, expected.size); assert.equal(manifest.tripCount, expected.size)
  validateLuzernSnapshot({ ...manifest, trains: [...actual.values()] }); validateLuzernSnapshot(morning)
  const expectedMorning = [...expected.values()].filter(t => t.calls[0].departure <= 31500 && t.calls.at(-1).arrival >= 24300).map(t => t.id).sort()
  assert.deepEqual(morning.trains.map(t => t.id).sort(), expectedMorning)
  for (const t of morning.trains) check(t, morning)
  results.push({ date: day.date, candidates: expected.size + report.excludedTrips, admitted: expected.size, patterns: pp.size, chunks: manifest.chunks.length, originalCallsAndTimes: true, reproducedGeometry: true })
}
await saveJson(join(audit, 'validation.json'), { passed: true, sourceHashes: summary.sourceHashes, days: results, completeCantonMotionCoverage: false, physicalDirectionsCertified: false })
console.log(JSON.stringify(results))
