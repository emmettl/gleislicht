import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { applyBernGeometry, bernSectionFeature, BERN_LIMITS } from './bern-line-geometry.mjs'

const BASELINE = 'e9d207d35ba5ae502d6a78fc85730763c8d8fccd'
const ROUTES = ['93-246-B-j26-1', '93-246-C-j26-1']
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const old = path => execFileSync('git', ['show', `${BASELINE}:${path}`], { maxBuffer: 64 * 1024 * 1024 })
// Historical Schilthorn-only release; later rail supplements have their own proof.
const RELEASE = '326d8c3e8df5b27cbafe80aef6f7805186ff7b30'
const released = path => execFileSync('git', ['show', `${RELEASE}:${path}`], { maxBuffer: 64 * 1024 * 1024 })
const json = async path => JSON.parse(released(path))
assert(process.argv[2], 'Provide the verified Bern timetable cache')
const raw = JSON.parse(gunzipSync(await readFile(process.argv[2])))
const sourceBytes = await readFile('data/bern-sources/decoded.json.gz'), source = JSON.parse(gunzipSync(sourceBytes))
const policyBytes = await readFile('data/bern-operator-crosswalk.json'), policy = JSON.parse(policyBytes)
const summary = await json('data/bern-audit/summary.json')
assert.deepEqual(raw.sourceHashes, { archive: summary.sourceHashes.archive, source: sha(sourceBytes) })
assert.equal(summary.sourceHashes.crosswalk, sha(policyBytes))
const routes = new Map(raw.routes.map(r => [r.id, r]))
const feature = source.lines.find(f => f.properties.liniencode === '2460_2')
const bindings = ROUTES.map(id => {
  const r = routes.get(id), selected = bernSectionFeature(r, feature, policy)
  const binding = policy.featureOverrides['2460_2'].routeSections.find(s => s.routeId === id)
  assert.equal(sha(JSON.stringify(selected.geometry.coordinates)), binding.partSha256)
  return { ...binding, sourceLine: '2460_2', originalLv95Coordinates: selected.geometry.coordinates }
})
const document = policy.supportingDocuments.find(d => d.file === 'corridor-2460-2026.pdf')
assert.equal(sha(await readFile(`data/bern-sources/${document.file}`)), document.sha256)
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
  const date = snapshot.metadata.serviceDate, before = await day(old, date), after = await day(released, date)
  for (const [id, t] of before.trains) {
    assert(after.trains.has(id), `Lost previous journey ${id}`)
    assert.equal(canonical(t, before.manifest), canonical(after.trains.get(id), after.manifest), `Changed previous movement ${id}`)
  }
  for (const [key, value] of Object.entries(before.manifest.metadata.sourceHashes)) if (key !== 'crosswalk') assert.equal(after.manifest.metadata.sourceHashes[key], value)
  assert.deepEqual(after.manifest.metadata.geometry.limits, before.manifest.metadata.geometry.limits)
  const added = [...after.trains.values()].filter(t => !before.trains.has(t.id))
  assert.equal(added.length, 78)
  assert(added.every(t => ROUTES.includes(t.routeId) && t.frequency?.exactTimes !== 0))
  const originalTrains = snapshot.trains.filter(t => ROUTES.includes(t.routeId)), originals = new Map(originalTrains.map(t => [t.id, t]))
  const reproduced = applyBernGeometry({ ...snapshot, trains: originalTrains }, routes, source, policy)
  assert(reproduced.trains.every(t => t.admission === 'admitted'))
  const reproducedTrains = new Map(reproduced.trains.map(t => [t.id, t]))
  for (const t of added) {
    const { stops, ...original } = originals.get(t.id)
    for (const [key, value] of Object.entries(original)) assert.deepEqual(t[key], value, `Changed source field ${key}`)
    assert.deepEqual(t.stops.map(([i, ...times]) => [after.manifest.stops[i], ...times]), stops.map(([i, ...times]) => [snapshot.stops[i], ...times]))
    assert.deepEqual(t.pathSegments.map(i => after.manifest.paths[i]), reproducedTrains.get(t.id).pathSegments.map(i => reproduced.paths[i]))
  }
  const report = await json(`data/bern-audit/${date}.json`), prior = JSON.parse(old(`data/bern-audit/${date}.json`))
  assert.deepEqual(report.directedPairs.filter(p => !ROUTES.includes(p.routeId)), prior.directedPairs.filter(p => !ROUTES.includes(p.routeId)))
  const reviewed = ROUTES.map(routeId => {
    const patterns = report.patterns.filter(p => p.routeId === routeId), pairs = report.directedPairs.filter(p => p.routeId === routeId)
    assert.equal(patterns.length, 2); assert.equal(pairs.length, 2)
    assert(patterns.every(p => p.trips === p.admittedTrips && p.segmentCount === p.matchedSegments))
    assert(pairs.every(p => p.matched && p.maximumSnapMetres <= 80))
    const directionIds = [...new Set(patterns.map(p => p.directionId))].sort()
    assert.deepEqual(directionIds, ['0', '1'])
    return { routeId, line: routes.get(routeId).name, scheduledJourneys: added.filter(t => t.routeId === routeId).length,
      directionIds, patterns: patterns.length, pairs, maximumSnapMetres: Math.max(...pairs.map(p => p.maximumSnapMetres)) }
  })
  assert.deepEqual(reviewed.map(r => r.scheduledJourneys), [39, 39])
  const deferredRail = ['91-36-D-j26-1', '91-4-C-j26-1'].map(routeId => {
    const gaps = report.directedPairs.filter(p => p.routeId === routeId && !p.matched)
    assert(gaps.length && gaps.every(p => p.reason === 'disconnected-line'))
    return { routeId, line: routes.get(routeId).name, gaps, decision: 'Retain exclusion: nearby source parts do not share an exact topology vertex; no new connecting geometry reviewed.' }
  })
  dates.push({ date, previousJourneysPreserved: before.trains.size, addedScheduledJourneys: added.length, totalAdmittedJourneys: after.trains.size,
    routes: reviewed, deferredRail, checks: { allPreviousMovementsAndPathsUnchanged: true, allAddedSourceCallsAndFieldsUnchanged: true,
      allNewPathsReproducedFromExactSourceParts: true, unrelatedPairDecisionsUnchanged: true, sourceAndLimitsUnchangedExceptExplicitCrosswalk: true } })
}
const birgEndpoints = [bindings[0].originalLv95Coordinates.at(-1), bindings[1].originalLv95Coordinates[0]]
const seasonal = await json('data/bern-audit/seasonal-summary.json')
const previousSeasonal = JSON.parse(old('data/bern-audit/seasonal-summary.json'))
const seasonalPatterns = JSON.parse(gunzipSync(released('data/bern-audit/seasonal-patterns.json.gz')))
const previousPatterns = JSON.parse(gunzipSync(old('data/bern-audit/seasonal-patterns.json.gz')))
const seasonalChecks = seasonal.days.map((day, i) => {
  const previous = previousSeasonal.days[i]
  assert.equal(day.date, previous.date); assert.equal(day.trips, previous.trips)
  const currentPatterns = seasonalPatterns[i].patterns, oldPatterns = previousPatterns[i].patterns
  assert.deepEqual(currentPatterns.filter(p => !ROUTES.includes(p.routeId)), oldPatterns.filter(p => !ROUTES.includes(p.routeId)))
  const target = currentPatterns.filter(p => ROUTES.includes(p.routeId))
  assert.equal(target.length, 4)
  assert(target.every(p => p.trips === p.admittedTrips && p.matchedMask.every(Boolean)))
  const added = day.admittedTrips - previous.admittedTrips
  assert.equal(added, day.date === '2026-08-01' ? 78 : 72)
  assert.equal(day.admittedRepresentativeHeadwayTrips, previous.admittedRepresentativeHeadwayTrips)
  return { date: day.date, addedScheduledJourneys: added, unrelatedPatternsUnchanged: true, allSectionPatternsComplete: true }
})
const report = { schemaVersion: 1, baselineCommit: BASELINE, sourceHashes: summary.sourceHashes, supportingDocument: document,
  bindings, limits: BERN_LIMITS.cableway, birgEndpointsLv95: birgEndpoints,
  birgSourceEndpointSeparationMetres: Math.hypot(...birgEndpoints[0].map((v, i) => v - birgEndpoints[1][i])),
  interpretation: 'Exact route, agency, mode and section identity selects one original cable axis. Birg has distinct source endpoints; no topology bridge is added. Original GTFS stop coordinates attach within the unchanged 80 m limit. This remains inferred source geometry, not an observed cabin trajectory.', dates, seasonalChecks }
await writeFile('data/bern-audit/schilthorn-followup.json', JSON.stringify(report, null, 2) + '\n')
console.log(dates.map(d => `${d.date}: ${d.previousJourneysPreserved} unchanged; +${d.addedScheduledJourneys} scheduled; both sections and directions reproduced`).join('\n'))
