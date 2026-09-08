import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { loadBernRegionalRoads, BERN_REGIONAL_ROUTES } from './bern-regional-roads.mjs'
import { BERN_ROAD_LIMITS } from './bern-urban-geometry.mjs'
const BASELINE = 'd8644411b83396e9430e3148638951a2ac2d4ca3'
const sha = b => createHash('sha256').update(b).digest('hex')
const old = path => execFileSync('git', ['show', `${BASELINE}:${path}`], { maxBuffer: 64 * 1024 * 1024 })
const json = async path => JSON.parse(await readFile(path))
assert(process.argv[2], 'Provide the verified Bern timetable cache as the first argument')
const raw = JSON.parse(gunzipSync(await readFile(process.argv[2])))
const summary = await json('data/bern-audit/summary.json')
assert.deepEqual(raw.sourceHashes, { archive: summary.sourceHashes.archive, source: summary.sourceHashes.source })
const road = await loadBernRegionalRoads(raw), routes = await json('data/bern-audit/routes.json')
async function day(read, date) {
  const directory = `public/data/bern-region/${date}`, manifest = JSON.parse(await read(`${directory}/bern-region-day-manifest.json`)), trains = new Map()
  for (const chunk of manifest.chunks) {
    const bytes = await read(`${directory}/${chunk.path}`); assert.equal(sha(bytes), chunk.sha256)
    for (const t of JSON.parse(bytes).trains) trains.set(t.id, t)
  }
  return { manifest, trains }
}
const canonical = (t, s) => { const { stops, pathSegments, ...rest } = t; return sha(JSON.stringify({ ...rest, stops: stops.map(([i, ...times]) => [s.stops[i], ...times]), paths: pathSegments.map(i => s.paths[i]) })) }
const dates = []
for (const date of road.policy.dates) {
  const before = await day(old, date), after = await day(readFile, date)
  for (const [id, t] of before.trains) {
    assert(after.trains.has(id), `Lost previous journey ${id}`)
    assert.equal(canonical(t, before.manifest), canonical(after.trains.get(id), after.manifest), `Changed previous movement ${id}`)
  }
  for (const key of ['archive', 'source', 'geometryArchive', 'crosswalk', 'urbanCache', 'urbanPolicy', 'mountainPolicy']) assert.equal(after.manifest.metadata.sourceHashes[key], before.manifest.metadata.sourceHashes[key])
  assert.deepEqual(after.manifest.metadata.geometry.limits, before.manifest.metadata.geometry.limits)
  const report = await json(`data/bern-audit/${date}.json`), priorReport = JSON.parse(old(`data/bern-audit/${date}.json`))
  assert.deepEqual(report.directedPairs.filter(p => !BERN_REGIONAL_ROUTES.includes(p.routeId)), priorReport.directedPairs.filter(p => !BERN_REGIONAL_ROUTES.includes(p.routeId)))
  const added = [...after.trains.values()].filter(t => !before.trains.has(t.id)), snapshot = raw.snapshots.find(s => s.metadata.serviceDate === date)
  const originals = new Map(snapshot.trains.map(t => [t.id, t]))
  for (const t of added) {
    assert(BERN_REGIONAL_ROUTES.includes(t.routeId) && t.frequency?.exactTimes !== 0)
    const { stops, ...source } = originals.get(t.id)
    for (const [key, value] of Object.entries(source)) assert.deepEqual(t[key], value, `Changed source field ${key}`)
    assert.deepEqual(t.stops.map(([i, ...times]) => [after.manifest.stops[i], ...times]), stops.map(([i, ...times]) => [snapshot.stops[i], ...times]))
  }
  const pairs = new Map(report.directedPairs.map(p => [JSON.stringify([p.routeId, p.fromId, p.toId]), p])), verified = new Set()
  for (const t of after.trains.values()) for (let i = 1; i < t.stops.length; i++) {
    const from = after.manifest.stops[t.stops[i - 1][0]], to = after.manifest.stops[t.stops[i][0]], key = JSON.stringify([t.routeId, from[4], to[4]])
    if (pairs.get(key).sourceId !== road.policy.sourceId) continue
    assert.equal(pairs.get(key).maximumSnapMetres, undefined, 'Do not report the rejected cantonal gap as a road snap')
    assert.equal(pairs.get(key).roadSnapLimitMetres, 80)
    assert.deepEqual(after.manifest.paths[t.pathSegments[i - 1]], road.roads.get(key).path, `Road geometry differs from retained evidence: ${key}`)
    verified.add(key)
  }
  dates.push({ date, previousJourneysPreserved: before.trains.size, addedScheduledJourneys: added.length, totalAdmittedJourneys: after.trains.size,
    reproducedAdmittedRoadPairs: verified.size, routes: BERN_REGIONAL_ROUTES.map(routeId => {
      const route = routes.find(r => r.id === routeId), gaps = report.directedPairs.filter(p => p.routeId === routeId && !p.matched)
      return { routeId, agency: route.agency, agencyId: route.agencyId, line: route.name, ...route.days.find(d => d.date === date),
        addedScheduledJourneys: added.filter(t => t.routeId === routeId).length, remainingPairs: gaps }
    }), checks: { allPreviousCallsTimesIdentitiesAndPathsUnchanged: true, allAddedSourceFieldsAndCallsUnchanged: true,
      unrelatedPairDecisionsUnchanged: true, allAdmittedRoadPathsReproduced: true, sourceAndThresholdsUnchanged: true } })
}
const candidates = [...road.roads].map(([key, r]) => ({ key: JSON.parse(key), accepted: !!r.path, reason: r.reason,
  contexts: r.roadContextOccurrences, patternIds: r.roadPatternIds, pathSha256: r.path ? sha(JSON.stringify(r.path)) : undefined }))
const report = { schemaVersion: 1, baselineCommit: BASELINE, source: road.metadata, roadLimits: BERN_ROAD_LIMITS,
  fullPatterns: Object.values(road.cache.agencies).reduce((n, a) => n + Object.keys(a.identities).length, 0),
  agencies: Object.entries(road.cache.agencies).map(([id, a]) => ({ id, patterns: Object.keys(a.identities).length,
    maximumAcceptedSnapMetres: a.cache.report.maxSnapMetres, issues: a.cache.report.issues, evidence: a.evidence })),
  candidatePairReview: candidates, dates }
await writeFile('data/bern-audit/regional-road-followup.json', JSON.stringify(report, null, 2) + '\n')
console.log(dates.map(d => `${d.date}: ${d.previousJourneysPreserved} preserved; +${d.addedScheduledJourneys} scheduled; ${d.reproducedAdmittedRoadPairs} road pairs reproduced`).join('\n'))
