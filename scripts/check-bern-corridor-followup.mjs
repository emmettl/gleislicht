import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const BASELINE = '21ea85eed20ad79bac7e371a8564f89ce58b508a'
const ROUTES = ['91-65-j26-1', '91-71-j26-1', '93-246-D-j26-1']
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const baseline = path => execFileSync('git', ['show', `${BASELINE}:${path}`], { maxBuffer: 64 * 1024 * 1024 })
// Verify this historical alias-only release even after later supplements land.
const RELEASE = '0c129804feb831b8f8b72300e3bbc3137baf166a'
const current = path => execFileSync('git', ['show', `${RELEASE}:${path}`], { maxBuffer: 64 * 1024 * 1024 })
async function day(read, date) {
  const directory = `public/data/bern-region/${date}`
  const manifest = JSON.parse(await read(join(directory, 'bern-region-day-manifest.json'))), trains = new Map()
  for (const chunk of manifest.chunks) {
    const bytes = await read(join(directory, chunk.path)); assert.equal(sha(bytes), chunk.sha256)
    for (const train of JSON.parse(bytes).trains) trains.set(train.id, train)
  }
  return { manifest, trains }
}
function movementHash(train, snapshot) {
  const { stops, pathSegments, ...identity } = train
  return sha(JSON.stringify({ ...identity, stops: stops.map(([i, ...times]) => [snapshot.stops[i], ...times]), paths: pathSegments.map(i => snapshot.paths[i]) }))
}

export async function checkBernCorridorFollowup() {
  const dates = []
  for (const date of ['2026-09-04', '2026-09-06']) {
    const before = await day(baseline, date), after = await day(current, date)
    assert.deepEqual(after.manifest.metadata.geometry.limits, before.manifest.metadata.geometry.limits)
    for (const source of ['archive', 'source', 'geometryArchive']) assert.equal(after.manifest.metadata.sourceHashes[source], before.manifest.metadata.sourceHashes[source])
    for (const [id, train] of before.trains) {
      assert(after.trains.has(id), `Lost previously admitted journey ${id}`)
      assert.equal(movementHash(after.trains.get(id), after.manifest), movementHash(train, before.manifest), `Changed calls, timing, identity or geometry for ${id}`)
    }
    const added = [...after.trains.values()].filter(t => !before.trains.has(t.id))
    assert(added.every(t => ROUTES.includes(t.routeId) && t.frequency?.exactTimes !== 0), 'Unexpected route or representative headway addition')
    const report = JSON.parse(await current(`data/bern-audit/${date}.json`))
    const oldReport = JSON.parse(baseline(`data/bern-audit/${date}.json`))
    // Rematching an alias must not change the geometry decisions of unrelated routes.
    assert.deepEqual(report.directedPairs.filter(p => !ROUTES.includes(p.routeId)), oldReport.directedPairs.filter(p => !ROUTES.includes(p.routeId)))
    const routes = ROUTES.map(routeId => {
      const trains = added.filter(t => t.routeId === routeId), patterns = report.patterns.filter(p => p.routeId === routeId), pairs = report.directedPairs.filter(p => p.routeId === routeId)
      assert(patterns.every(p => p.trips === p.admittedTrips && p.matchedSegments === p.segmentCount))
      assert(pairs.every(p => p.matched))
      return { routeId, line: trains[0].route, addedScheduledJourneys: trains.length, directedPatterns: patterns.length, directedPairs: pairs.length,
        directionIds: [...new Set(patterns.map(p => p.directionId))].sort(), precedingDayJourneys: trains.filter(t => t.sourceServiceDate !== date).length,
        sourceLines: patterns[0].sourceLines, maximumSnapMetres: Math.max(...pairs.map(p => p.maximumSnapMetres ?? 0)) }
    })
    assert.deepEqual(routes.map(r => r.addedScheduledJourneys), date === '2026-09-04' ? [68, 56, 66] : [70, 50, 68])
    dates.push({ date, preservedJourneys: before.trains.size, addedScheduledJourneys: added.length, totalAdmittedJourneys: after.trains.size,
      previousSourceHashes: before.manifest.metadata.sourceHashes, sourceHashes: after.manifest.metadata.sourceHashes, routes,
      checks: { allPreviousMovementsAndPathsUnchanged: true, unrelatedPairDecisionsUnchanged: true, allTargetPatternsComplete: true, noThresholdChanges: true, noSourceCallsRemoved: true } })
  }
  return { schemaVersion: 1, baselineCommit: BASELINE, dates }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await checkBernCorridorFollowup()
  await writeFile('data/bern-audit/corridor-followup.json', JSON.stringify(report, null, 2) + '\n')
  console.log(report.dates.map(d => `${d.date}: ${d.preservedJourneys} unchanged; +${d.addedScheduledJourneys} scheduled journeys`).join('\n'))
}
