import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { loadBernUrban } from './bern-urban-geometry.mjs'
import { loadBernMountains, matchBernMountain } from './bern-mountain-geometry.mjs'
import { bernGraph, BERN_LIMITS } from './bern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
// Keep this completed urban/mountain batch independently reproducible.
const RELEASE = 'd8644411b83396e9430e3148638951a2ac2d4ca3'
const released = path => execFileSync('git', ['show', `${RELEASE}:${path}`], { maxBuffer: 64 * 1024 * 1024 })
const BASELINE = '0c129804feb831b8f8b72300e3bbc3137baf166a'
const sha = b => createHash('sha256').update(b).digest('hex')
const previous = path => execFileSync('git', ['show', `${BASELINE}:${path}`], { maxBuffer: 64 * 1024 * 1024 })
async function day(read, date) {
  const dir = `public/data/bern-region/${date}`, manifest = JSON.parse(await read(`${dir}/bern-region-day-manifest.json`)), trains = new Map()
  for (const c of manifest.chunks) {
    const bytes = await read(`${dir}/${c.path}`); assert.equal(sha(bytes), c.sha256)
    for (const t of JSON.parse(bytes).trains) trains.set(t.id, t)
  }
  return { manifest, trains }
}
const canonical = (t, s) => { const { stops, pathSegments, ...rest } = t; return sha(JSON.stringify({ ...rest, stops: stops.map(([i, ...times]) => [s.stops[i], ...times]), paths: pathSegments.map(i => s.paths[i]) })) }
const urban = await loadBernUrban(), mountain = await loadBernMountains()
const routes = JSON.parse(released('data/bern-audit/routes.json')), byRoute = new Map(routes.map(r => [r.id, r]))
const targetRoutes = [...urban.policy.roadRouteIds, '91-6-A-j26-1', ...mountain.policy.admittedRouteIds]
const source = JSON.parse(gunzipSync(await readFile('data/bern-sources/decoded.json.gz')))
const graph = bernGraph(source.lines.filter(f => f.properties.liniencode === '30_003'))
const days = []
for (const date of urban.policy.dates) {
  const before = await day(previous, date), after = await day(released, date)
  for (const [id, t] of before.trains) {
    assert(after.trains.has(id), `Lost previously admitted journey ${id}`)
    assert.equal(canonical(t, before.manifest), canonical(after.trains.get(id), after.manifest), `Changed previous movement ${id}`)
  }
  for (const key of ['archive', 'source', 'geometryArchive', 'crosswalk']) assert.equal(after.manifest.metadata.sourceHashes[key], before.manifest.metadata.sourceHashes[key])
  assert.deepEqual(after.manifest.metadata.geometry.limits, before.manifest.metadata.geometry.limits)
  const report = JSON.parse(released(`data/bern-audit/${date}.json`)), old = JSON.parse(previous(`data/bern-audit/${date}.json`))
  assert.deepEqual(report.directedPairs.filter(p => !targetRoutes.includes(p.routeId)), old.directedPairs.filter(p => !targetRoutes.includes(p.routeId)))
  const pairs = new Map(report.directedPairs.map(p => [JSON.stringify([p.routeId, p.fromId, p.toId]), p]))
  const checked = new Set()
  for (const t of after.trains.values()) for (let i = 1; i < t.stops.length; i++) {
    const from = after.manifest.stops[t.stops[i - 1][0]], to = after.manifest.stops[t.stops[i][0]], key = JSON.stringify([t.routeId, from[4], to[4]]), pair = pairs.get(key)
    if (!pair.sourceKind) continue
    let expected
    if (pair.sourceKind === 'osm-road-inference') expected = urban.roads.get(key).path
    else if (pair.sourceKind === 'fot-cableway-axis') expected = matchBernMountain(from, to, byRoute.get(t.routeId), date, mountain).path
    else expected = matchBaselSegment(graph, from, to, BERN_LIMITS.tram).path
    assert.deepEqual(after.manifest.paths[t.pathSegments[i - 1]], expected, `Supplement does not reproduce from evidence: ${key}`)
    checked.add(key)
  }
  const added = [...after.trains.values()].filter(t => !before.trains.has(t.id))
  assert(added.every(t => targetRoutes.includes(t.routeId)))
  assert(![...after.trains.values()].some(t => ['92-7A-j26-1', '92-8A-j26-1', '93-244-4-j26-1', '93-GGM-j26-1', '93-235-2-j26-1'].includes(t.routeId)))
  days.push({ date, previousJourneysPreserved: before.trains.size, addedJourneys: added.length, totalAdmittedJourneys: after.trains.size,
    reproducedSupplementPairs: checked.size, routes: targetRoutes.map(routeId => ({ routeId, line: byRoute.get(routeId).name,
      addedScheduledJourneys: added.filter(t => t.routeId === routeId && t.frequency?.exactTimes !== 0).length,
      addedHeadwayJourneys: added.filter(t => t.routeId === routeId && t.frequency?.exactTimes === 0).length,
      ...byRoute.get(routeId).days.find(d => d.date === date) })),
    checks: { allPreviousCallsTimesIdentitiesAndPathsUnchanged: true, unrelatedPairDecisionsUnchanged: true,
      allAdmittedSupplementPathsReproduced: true, sourceAndThresholdsUnchanged: true, knownConflictingRoutesStillExcluded: true } })
}
const mountainReview = []
assert(process.argv[2], 'Provide the verified Bern timetable cache as the first argument')
const raw = JSON.parse(gunzipSync(await readFile(process.argv[2])))
assert.deepEqual(raw.snapshots.map(s => s.metadata.serviceDate), urban.policy.dates)
assert.equal(raw.sourceHashes.archive, JSON.parse(await readFile('data/bern-audit/summary.json')).sourceHashes.archive)
for (const snapshot of raw.snapshots) {
  const pairs = new Map()
  for (const t of snapshot.trains) if (mountain.policy.bindings.some(b => b.routeId === t.routeId)) for (let i = 1; i < t.stops.length; i++) {
    const from = snapshot.stops[t.stops[i - 1][0]], to = snapshot.stops[t.stops[i][0]], key = JSON.stringify([t.routeId, from[4], to[4]])
    if (pairs.has(key)) continue
    const { path, ...match } = matchBernMountain(from, to, byRoute.get(t.routeId), snapshot.metadata.serviceDate, mountain)
    pairs.set(key, { routeId: t.routeId, from: from[2], fromId: from[4], to: to[2], toId: to[4], ...match,
      passesGeometry: !!path, admittedSupplement: !!path && mountain.policy.admittedRouteIds.includes(t.routeId) })
  }
  mountainReview.push({ date: snapshot.metadata.serviceDate, directedPairs: [...pairs.values()] })
}
const report = { schemaVersion: 1, baselineCommit: BASELINE, urbanSources: urban.metadata, mountainSources: mountain.metadata, dates: days, mountainReview }
await writeFile('data/bern-audit/supplement-followup.json', JSON.stringify(report, null, 2) + '\n')
console.log(days.map(d => `${d.date}: ${d.previousJourneysPreserved} preserved, +${d.addedJourneys}, ${d.reproducedSupplementPairs} reproduced supplement pairs`).join('\n'))
