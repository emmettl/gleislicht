import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { readJson, readGzipJson, loadSeasonalContext } from './aargau-seasonal.mjs'
import { applyAargauGeometry } from './build-aargau-study.mjs'
const root = 'data/aargau-witnesses'
const inventory = await readJson(`${root}/inventory.json`), source = await readGzipJson(`${root}/source-patterns.json.gz`)
assert.equal(await hashFile(`${root}/source-patterns.json.gz`), inventory.sourcePatternsSha256)
const verification = await readJson(`${root}/source-verification.json`)
assert(verification.passed)
assert.equal(verification.inventorySha256, await hashFile(`${root}/inventory.json`))
assert.equal(verification.sourcePatternsSha256, inventory.sourcePatternsSha256)
const context = await loadSeasonalContext('data/aargau-seasonal/input')
assert.equal(context.inventory.metadata.archiveSha256, inventory.archiveSha256)
const raw = { metadata: { archiveSha256: inventory.archiveSha256, feed: inventory.feed, serviceDate: null, dayModel: 'Archived trip templates, each counted once; not a civil-day feed' }, stops: source.stops,
  trains: source.trains.map(t => ({ ...t, id: t.sourceTripId })) }
// Probe compatibility only. No date-scoped gap/platform/alignment/Simplon exceptions are supplied.
const geometry = applyAargauGeometry(raw, context.index, context.inventory.cantonStopIds, context.roads, context.rails)
const oldPatterns = new Set()
for (const day of (await readJson('data/aargau-seasonal/summary.json')).days) for (const p of (await readGzipJson(`data/aargau-seasonal/${day.patternsFile}`)).patterns) oldPatterns.add(p.id)
for (const p of geometry.patterns) {
  assert(!oldPatterns.has(p.id), 'Witness target appeared in the twelve-date sample')
  for (const s of p.segments) assert(!s.gapMappingId && !s.platformFixId && !s.alignmentCorrectionId && !s.simplonRuleId && !s.seasonalGapRuleId)
}
const routes = inventory.routes.map(r => {
  const p = geometry.patterns.filter(p => p.routeId === r.routeId), counts = geometry.routes.find(g => g.routeId === r.routeId)
  assert.equal(counts.trips, r.archivedCantonTrips)
  return { routeId: r.routeId, agencyId: r.agencyId, operator: r.operator, line: r.line, mode: r.mode, witnessDate: r.witnessDate,
    archivedTripTemplates: counts.trips, directedPatterns: p.length, fullyCompatiblePatterns: p.filter(p => p.completeGeometry).length,
    segmentOccurrences: counts.total, compatibleOccurrences: counts.matched, missingOccurrences: counts.total-counts.matched,
    officialOccurrences: counts.officialMatched, roadOccurrences: counts.roadMatched, railOccurrences: counts.railMatched }
})
const unresolved = []
for (const p of geometry.patterns) for (const [i, s] of p.segments.entries()) if (s.pathIndex === null) unresolved.push({ patternId: p.id, routeId: p.routeId, agencyId: p.agencyId, line: p.line, mode: p.mode, segmentIndex: i, fromId: s.fromId, toId: s.toId, archivedTripTemplates: p.occurrences,
  agisRejection: s.reason ?? null, roadFailure: s.roadFailure ?? null, railFailure: s.railFailure ?? null })
const detail = { schemaVersion: 1, stops: raw.stops, paths: geometry.snapshot.paths, patterns: geometry.patterns, pairs: geometry.pairs }
const compressed = gzipSync(JSON.stringify(detail), { level: 9 })
const detailsFile = `${root}/geometry-patterns.json.gz`
if (process.argv.includes('--check')) assert.deepEqual(await readGzipJson(detailsFile), detail)
else await writeFile(detailsFile, compressed)
const summary = { schemaVersion: 1, inventorySha256: await hashFile(`${root}/inventory.json`), sourceVerificationSha256: await hashFile(`${root}/source-verification.json`), sourceHashes: context.sourceHashes,
  geometryPatternsFile: 'geometry-patterns.json.gz', geometryPatternsSha256: await hashFile(detailsFile),
  scope: 'Compatibility probe for all archived canton-calling trip templates of the 45 witness routes. Each trip template is counted once, not once per active date. Existing AGIS normal lines, exact cached bus patterns and already-reviewed FOT route identities only. No seasonal or September date-scoped exceptions, new route identities, road caches or alignment corrections are admitted. This is not a regional day feed or evidence of actual operation.',
  attribution: ['Timetable: opentransportdata.swiss', 'Daten des Kantons Aargau', '© swisstopo', '© OpenStreetMap contributors; ODbL-1.0', context.rails.source.attribution],
  targetRoutes: routes.length, directedPatterns: geometry.patterns.length, fullyCompatiblePatterns: geometry.patterns.filter(p => p.completeGeometry).length,
  archivedTripTemplates: routes.reduce((n,r) => n+r.archivedTripTemplates,0), segmentOccurrences: routes.reduce((n,r) => n+r.segmentOccurrences,0), compatibleOccurrences: routes.reduce((n,r) => n+r.compatibleOccurrences,0), missingOccurrences: routes.reduce((n,r) => n+r.missingOccurrences,0),
  routes, unresolved, dateScopedExceptionsApplied: false, publicationReady: false }
assert.equal(summary.segmentOccurrences, summary.compatibleOccurrences+summary.missingOccurrences)
assert.equal(unresolved.reduce((n,s) => n+s.archivedTripTemplates,0), summary.missingOccurrences)
if (process.argv.includes('--check')) assert.deepEqual(await readJson(`${root}/geometry-summary.json`), summary)
else await writeFile(`${root}/geometry-summary.json`, JSON.stringify(summary, null, 2)+'\n')
console.log({ routes: summary.targetRoutes, patterns: summary.directedPatterns, completePatterns: summary.fullyCompatiblePatterns, compatibleOccurrences: summary.compatibleOccurrences, totalOccurrences: summary.segmentOccurrences, missingOccurrences: summary.missingOccurrences })
