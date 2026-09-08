import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { bernPatternId } from './bern-line-geometry.mjs'
import { solothurnGraphs, applySolothurnGeometry } from './solothurn-network-geometry.mjs'
import { loadSolothurnSupplements } from './solothurn-supplement-geometry.mjs'
import { SO_SEASONAL_DATES, hashFile } from './solothurn-timetable.mjs'
const json = async path => JSON.parse(await readFile(path))
const zipped = async path => JSON.parse(gunzipSync(await readFile(path)))
const summary = await json('data/solothurn-audit/seasonal-summary.json')
const patterns = await zipped('data/solothurn-audit/seasonal-patterns.json.gz')
const context = await zipped('data/solothurn-pattern-contexts.json.gz')
assert.deepEqual(summary.sourceHashes, context.sourceHashes)
assert.deepEqual(summary.days.map(d => d.date), SO_SEASONAL_DATES)
assert.deepEqual(patterns.map(d => d.date), SO_SEASONAL_DATES)
const source = await zipped('data/solothurn-sources/decoded.json.gz')
assert.equal(await hashFile('data/solothurn-sources/decoded.json.gz'), context.sourceHashes.source)
const supplements = await loadSolothurnSupplements(context, { verifyEvidence: true })
assert.deepEqual(supplements.metadata, summary.supplementSources)
const graph = solothurnGraphs(source.lines), routes = new Map(context.routes.map(r => [r.id, r])), cache = new Map(), verified = new Map()
for (const day of context.snapshots) {
  const result = applySolothurnGeometry(day, routes, graph, cache, supplements)
  for (const pattern of result.patterns) {
    assert(!verified.has(pattern.id))
    verified.set(pattern.id, pattern)
  }
  for (const t of day.trains) assert(verified.has(bernPatternId(t, day.stops)))
}
const used = new Set()
for (const [i, day] of patterns.entries()) {
  const total = summary.days[i]
  assert.equal(day.patterns.length, total.patterns)
  assert.equal(day.patterns.reduce((n, p) => n + p.trips, 0), total.trips)
  assert.equal(day.patterns.reduce((n, p) => n + p.admittedTrips, 0), total.admittedTrips)
  assert.equal(day.patterns.filter(p => p.admittedTrips).length, total.admittedPatterns)
  for (const p of day.patterns) {
    const expected = verified.get(p.id); assert(expected)
    used.add(p.id)
    assert.deepEqual(p.stopIds, expected.stopIds)
    assert.deepEqual(p.matchedMask, expected.pathSegments.map(x => x !== null))
    assert.deepEqual(p.geometrySources, expected.geometrySources)
    assert.equal(Object.values(p.decisions).reduce((n, v) => n + v, 0), p.trips)
    assert.equal(p.decisions.admitted ?? 0, p.admittedTrips)
    if (p.admittedTrips) assert(p.matchedMask.every(Boolean))
  }
  for (const route of summary.routes) {
    const rr = day.patterns.filter(p => p.routeId === route.routeId)
    assert.equal(route.days[i].trips, rr.reduce((n, p) => n + p.trips, 0))
    assert.equal(route.days[i].admittedTrips, rr.reduce((n, p) => n + p.admittedTrips, 0))
  }
}
assert.deepEqual([...used].sort(), [...verified.keys()].sort())
assert.deepEqual(summary.stillInactiveRoutes, summary.routes.filter(r => r.days.every(d => !d.trips)).map(r => r.routeId))
assert.deepEqual(summary.newlyActiveSeptemberExcludedRoutes, summary.routes.filter(r => r.inactiveOnSeptemberFixtures && r.days.some(d => d.trips)).map(r => r.routeId))
assert.equal(summary.days.find(d => d.date === '2026-10-25').validation.dstRepeatedHourDisambiguated, false)
console.log(`Verified ${verified.size} complete seasonal contexts and all twelve date/route/pattern admission totals`)
