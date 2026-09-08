import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { bernRailCandidates, applyBernRail } from './bern-rail-geometry.mjs'
import { loadBernInterlaken, BERN_INTERLAKEN_ROUTES as BERN_RAIL_ROUTES } from './bern-interlaken-geometry.mjs'
import { applyBernGeometry } from './bern-line-geometry.mjs'
import { loadBernCrosscantonRail } from './bern-crosscanton-rail.mjs'

const RELEASE = '8394320199c958d560072b18afb1b7b3737aa2c9'
const BASELINE = '8d384695a24a37550ccf11583eb5d0eba7fead89'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const old = path => execFileSync('git', ['show', `${BASELINE}:${path}`], { maxBuffer: 64 * 1024 * 1024 })
const released = path => execFileSync('git', ['show', `${RELEASE}:${path}`], { maxBuffer: 64 * 1024 * 1024 })
const json = async path => JSON.parse(released(path))
assert(process.argv[2], 'Provide the verified Bern timetable cache')
const raw = JSON.parse(gunzipSync(await readFile(process.argv[2])))
const source = JSON.parse(gunzipSync(await readFile('data/bern-sources/decoded.json.gz')))
const crosswalk = await json('data/bern-operator-crosswalk.json'), summary = await json('data/bern-audit/summary.json')
assert.deepEqual(raw.sourceHashes, { archive: summary.sourceHashes.archive, source: summary.sourceHashes.source })
const rail = await loadBernInterlaken(), routes = new Map(raw.routes.map(r => [r.id, r]))
assert.equal(summary.sourceHashes.interlakenPolicy, rail.metadata.policySha256)
async function day(read, date) {
  const directory = `public/data/bern-region/${date}`, manifest = JSON.parse(await read(`${directory}/bern-region-day-manifest.json`)), trains = new Map()
  for (const chunk of manifest.chunks) {
    const bytes = await read(`${directory}/${chunk.path}`); assert.equal(sha(bytes), chunk.sha256)
    for (const t of JSON.parse(bytes).trains) trains.set(t.id, t)
  }
  return { manifest, trains }
}
const canonical = (t, s) => {
  const { stops, pathSegments, ...rest } = t
  return sha(JSON.stringify({ ...rest, stops: stops.map(([i, ...times]) => [s.stops[i], ...times]), paths: pathSegments.map(i => s.paths[i]) }))
}
const crosscantonRail = await loadBernCrosscantonRail()
const dates = []
for (const snapshot of raw.snapshots) {
  const date = snapshot.metadata.serviceDate, before = await day(old, date), after = await day(released, date)
  for (const [id, t] of before.trains) {
    assert(after.trains.has(id), `Lost previous journey ${id}`)
    assert.equal(canonical(t, before.manifest), canonical(after.trains.get(id), after.manifest), `Changed previous movement ${id}`)
  }
  for (const [key, value] of Object.entries(before.manifest.metadata.sourceHashes)) assert.equal(after.manifest.metadata.sourceHashes[key], value)
  assert.deepEqual(after.manifest.metadata.geometry.limits, before.manifest.metadata.geometry.limits)
  const added = [...after.trains.values()].filter(t => !before.trains.has(t.id))
  assert.equal(added.length, 2)
  assert(added.every(t => BERN_RAIL_ROUTES.includes(t.routeId) && t.frequency?.exactTimes !== 0))
  const originalTrains = snapshot.trains.filter(t => BERN_RAIL_ROUTES.includes(t.routeId)), originals = new Map(originalTrains.map(t => [t.id, t]))
  const reproduction = applyBernRail(snapshot, applyBernRail(snapshot, applyBernGeometry({ ...snapshot, trains: originalTrains }, routes, source, crosswalk), routes, crosscantonRail), routes, rail)
  assert(reproduction.trains.every(t => t.admission === 'admitted'))
  const reproduced = new Map(reproduction.trains.map(t => [t.id, t]))
  for (const t of added) {
    const { stops, ...original } = originals.get(t.id)
    for (const [key, value] of Object.entries(original)) assert.deepEqual(t[key], value, `Changed source field ${key}`)
    assert.deepEqual(t.stops.map(([i, ...times]) => [after.manifest.stops[i], ...times]), stops.map(([i, ...times]) => [snapshot.stops[i], ...times]))
    assert.deepEqual(t.pathSegments.map(i => after.manifest.paths[i]), reproduced.get(t.id).pathSegments.map(i => reproduction.paths[i]))
  }
  const report = await json(`data/bern-audit/${date}.json`), prior = JSON.parse(old(`data/bern-audit/${date}.json`))
  assert.deepEqual(report.directedPairs.filter(p => !BERN_RAIL_ROUTES.includes(p.routeId)), prior.directedPairs.filter(p => !BERN_RAIL_ROUTES.includes(p.routeId)))
  const afterPairs = new Map(report.directedPairs.map(p => [JSON.stringify([p.routeId, p.fromId, p.toId]), p]))
  for (const pair of prior.directedPairs.filter(p => p.matched)) {
    const { admittedOccurrences: _before, ...was } = pair
    const { admittedOccurrences: _after, ...now } = afterPairs.get(JSON.stringify([pair.routeId, pair.fromId, pair.toId]))
    assert.deepEqual(now, was, 'Changed a previously matched directed pair')
  }
  const candidates = bernRailCandidates(snapshot, routes, rail)
  assert.equal(candidates.size, 2)
  assert.equal(originalTrains.filter(t => t.stops.some(([i]) => snapshot.stops[i][2] === 'Interlaken Ost')).length, 2)
  for (const pair of report.directedPairs.filter(p => p.sourceId === rail.policy.sourceId)) {
    const candidate = candidates.get(JSON.stringify([pair.routeId, pair.fromId, pair.toId]))
    assert(candidate?.path)
    assert.deepEqual(pair.railPatternIds, candidate.railPatternIds, 'Lost full-pattern context evidence')
    assert.deepEqual(pair.directedSourceSegments, candidate.directedSourceSegments)
  }
  const reviewed = BERN_RAIL_ROUTES.map(routeId => {
    const patterns = report.patterns.filter(p => p.routeId === routeId), pairs = report.directedPairs.filter(p => p.routeId === routeId)
    for (const pattern of patterns) assert.deepEqual(pattern.sourceLines, ['320_RE'])
    assert(patterns.every(p => p.trips === p.admittedTrips && p.segmentCount === p.matchedSegments))
    assert(pairs.every(p => p.matched))
    const directionIds = [...new Set(patterns.map(p => p.directionId))].sort()
    assert.deepEqual(directionIds, ['0', '1'])
    return { routeId, line: routes.get(routeId).name, addedScheduledJourneys: added.filter(t => t.routeId === routeId).length,
      totalJourneys: originalTrains.filter(t => t.routeId === routeId).length, admittedJourneys: [...after.trains.values()].filter(t => t.routeId === routeId).length, directionIds, patterns: patterns.length, admittedPatterns: patterns.filter(p => p.admittedTrips).length, remainingPairs: pairs.filter(p => !p.matched),
      repairedPairs: pairs.filter(p => p.sourceKind === 'fot-rail-topology') }
  })
  assert.deepEqual(reviewed.map(r => r.addedScheduledJourneys), [2])
  dates.push({ date, previousJourneysPreserved: before.trains.size, addedScheduledJourneys: added.length, totalAdmittedJourneys: after.trains.size,
    routes: reviewed, candidateContexts: [...candidates].map(([pair, value]) => ({ pair: JSON.parse(pair),
      pathSha256: value.path ? sha(JSON.stringify(value.path)) : null, reason: value.reason,
      contexts: value.contexts.map(({ patternId, assessment: { path, ...assessment } }) => ({ patternId, ...assessment, pathSha256: path ? sha(JSON.stringify(path)) : null })) })),
    checks: { allPreviousMovementsAndPathsUnchanged: true, allAddedSourceCallsAndFieldsUnchanged: true,
      allNewJourneysReproducedFromCantonalAndFederalSources: true, unrelatedPairDecisionsUnchanged: true,
      allPreviouslyMatchedPairAssessmentsUnchanged: true, oldSourceHashesAndLimitsUnchanged: true, allRe8JourneysComplete: true } })
}
// This narrowly dated rail supplement must not silently change seasonal results.
for (const path of ['data/bern-audit/seasonal-summary.json', 'data/bern-audit/seasonal-patterns.json.gz']) assert.deepEqual(await readFile(path), old(path))
const report = { schemaVersion: 1, baselineCommit: BASELINE, source: rail.metadata, dates, seasonalResultsUnchanged: true,
  scope: 'Exact BLS RE8 route 91-8-L-j26-1, agency 33, existing OEVTP 320_RE. Three directed West–Ost platform bindings, four dated full patterns and 12 original stop records. Original platforms 5 and 8 explicitly map to FOT Interlaken Ost [Gleis 5-8] 8519309. Only original standard-gauge BLS curve ch14uvag00087489 is eligible. Generic station, metre-gauge groups and Bönigen depot continuation excluded. All previous paths, calls, fields, limits and other route exclusions unchanged; no new admission of conditional calls. FOT catalogue 2021-07-06, asset updated 2025-01-18, checksum rechecked 2026-09-08; current alignment and individual running tracks unconfirmed. No new source acquisition; platform identity comes from the pinned FOT node name.' }
await writeFile('data/bern-audit/interlaken-followup.json', JSON.stringify(report, null, 2) + '\n')
console.log(dates.map(d => `${d.date}: ${d.previousJourneysPreserved} unchanged; +${d.addedScheduledJourneys} scheduled; RE8 complete in both dated directions; all other route exclusions unchanged`).join('\n'))
