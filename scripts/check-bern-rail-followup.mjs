import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { loadBernRail, bernRailCandidates, applyBernRail, BERN_RAIL_ROUTES } from './bern-rail-geometry.mjs'
import { applyBernGeometry } from './bern-line-geometry.mjs'

const BASELINE = '326d8c3e8df5b27cbafe80aef6f7805186ff7b30'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const old = path => execFileSync('git', ['show', `${BASELINE}:${path}`], { maxBuffer: 64 * 1024 * 1024 })
const json = async path => JSON.parse(await readFile(path))
assert(process.argv[2], 'Provide the verified Bern timetable cache')
const raw = JSON.parse(gunzipSync(await readFile(process.argv[2])))
const source = JSON.parse(gunzipSync(await readFile('data/bern-sources/decoded.json.gz')))
const crosswalk = await json('data/bern-operator-crosswalk.json'), summary = await json('data/bern-audit/summary.json')
assert.deepEqual(raw.sourceHashes, { archive: summary.sourceHashes.archive, source: summary.sourceHashes.source })
const rail = await loadBernRail(), routes = new Map(raw.routes.map(r => [r.id, r]))
assert.equal(summary.sourceHashes.railPolicy, rail.metadata.policySha256)
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
const dates = []
for (const snapshot of raw.snapshots) {
  const date = snapshot.metadata.serviceDate, before = await day(old, date), after = await day(readFile, date)
  for (const [id, t] of before.trains) {
    assert(after.trains.has(id), `Lost previous journey ${id}`)
    assert.equal(canonical(t, before.manifest), canonical(after.trains.get(id), after.manifest), `Changed previous movement ${id}`)
  }
  for (const [key, value] of Object.entries(before.manifest.metadata.sourceHashes)) assert.equal(after.manifest.metadata.sourceHashes[key], value)
  assert.deepEqual(after.manifest.metadata.geometry.limits, before.manifest.metadata.geometry.limits)
  const added = [...after.trains.values()].filter(t => !before.trains.has(t.id))
  assert.equal(added.length, date === '2026-09-04' ? 93 : 79)
  assert(added.every(t => BERN_RAIL_ROUTES.includes(t.routeId) && t.frequency?.exactTimes !== 0))
  const originalTrains = snapshot.trains.filter(t => BERN_RAIL_ROUTES.includes(t.routeId)), originals = new Map(originalTrains.map(t => [t.id, t]))
  const reproduction = applyBernRail(snapshot, applyBernGeometry({ ...snapshot, trains: originalTrains }, routes, source, crosswalk), routes, rail)
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
  const candidates = bernRailCandidates(snapshot, routes, rail)
  const reviewed = BERN_RAIL_ROUTES.map(routeId => {
    const patterns = report.patterns.filter(p => p.routeId === routeId), pairs = report.directedPairs.filter(p => p.routeId === routeId)
    assert(patterns.every(p => p.trips === p.admittedTrips && p.segmentCount === p.matchedSegments))
    assert(pairs.every(p => p.matched))
    const directionIds = [...new Set(patterns.map(p => p.directionId))].sort()
    assert.deepEqual(directionIds, ['0', '1'])
    return { routeId, line: routes.get(routeId).name, addedScheduledJourneys: added.filter(t => t.routeId === routeId).length,
      totalJourneys: originalTrains.filter(t => t.routeId === routeId).length, directionIds, patterns: patterns.length,
      repairedPairs: pairs.filter(p => p.sourceKind === 'fot-rail-topology') }
  })
  assert.deepEqual(reviewed.map(r => r.addedScheduledJourneys), date === '2026-09-04' ? [50, 43] : [38, 41])
  dates.push({ date, previousJourneysPreserved: before.trains.size, addedScheduledJourneys: added.length, totalAdmittedJourneys: after.trains.size,
    routes: reviewed, candidateContexts: [...candidates].map(([pair, value]) => ({ pair: JSON.parse(pair),
      pathSha256: value.path ? sha(JSON.stringify(value.path)) : null, reason: value.reason,
      contexts: value.contexts.map(({ patternId, assessment: { path, ...assessment } }) => ({ patternId, ...assessment, pathSha256: path ? sha(JSON.stringify(path)) : null })) })),
    checks: { allPreviousMovementsAndPathsUnchanged: true, allAddedSourceCallsAndFieldsUnchanged: true,
      allNewJourneysReproducedFromCantonalAndFederalSources: true, unrelatedPairDecisionsUnchanged: true,
      oldSourceHashesAndLimitsUnchanged: true, bothRoutesCompleteInBothDirections: true } })
}
// This narrowly dated rail supplement must not silently change seasonal results.
for (const path of ['data/bern-audit/seasonal-summary.json', 'data/bern-audit/seasonal-patterns.json.gz']) assert.deepEqual(await readFile(path), old(path))
const report = { schemaVersion: 1, baselineCommit: BASELINE, source: rail.metadata, dates, seasonalResultsUnchanged: true,
  scope: 'September S36 Dotzigen–Busswil and S4 Zollikofen–Schönbühl only. Exact operating-point and source-segment identities; all complete input-pattern contexts must agree. Federal source date is not a certification of current running tracks or alignment.' }
await writeFile('data/bern-audit/rail-followup.json', JSON.stringify(report, null, 2) + '\n')
console.log(dates.map(d => `${d.date}: ${d.previousJourneysPreserved} unchanged; +${d.addedScheduledJourneys} scheduled; S36 and S4 complete in both directions`).join('\n'))
