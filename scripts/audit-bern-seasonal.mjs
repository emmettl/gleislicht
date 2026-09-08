import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { readBernTimetables } from './bern-timetable.mjs'
import { applyBernGeometry } from './bern-line-geometry.mjs'
import { loadBernMountains, applyBernMountains } from './bern-mountain-geometry.mjs'
import { bernCoverage, compactBernFeed, validateBernSnapshot } from './build-bern-region.mjs'

export const BERN_SEASONAL_DATES = ['2026-01-16', '2026-01-18', '2026-04-03', '2026-04-05', '2026-08-01', '2026-12-04', '2026-12-06']
const sha = b => createHash('sha256').update(b).digest('hex')
const sourceBytes = await readFile('data/bern-sources/decoded.json.gz'), source = JSON.parse(gunzipSync(sourceBytes))
const baseline = JSON.parse(await readFile('data/bern-audit/summary.json'))
const crosswalkBytes = await readFile('data/bern-operator-crosswalk.json'), crosswalk = JSON.parse(crosswalkBytes)
const arg = name => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined
const archive = arg('archive'), cachePath = arg('cache')
assert(archive || cachePath, 'Use --archive GTFS_ZIP or --cache VERIFIED_TIMETABLE_CACHE')
let raw
if (cachePath) raw = JSON.parse(gunzipSync(await readFile(cachePath)))
else {
  assert.equal(sha(await readFile(archive)), baseline.sourceHashes.archive)
  raw = await readBernTimetables(archive, BERN_SEASONAL_DATES, source)
  raw.sourceHashes = { archive: baseline.sourceHashes.archive, source: sha(sourceBytes) }
}
assert.deepEqual(raw.sourceHashes, { archive: baseline.sourceHashes.archive, source: sha(sourceBytes) })
assert.deepEqual(raw.snapshots.map(s => s.metadata.serviceDate), BERN_SEASONAL_DATES)
const mountain = await loadBernMountains(), routes = new Map(raw.routes.map(r => [r.id, r]))
const inventory = JSON.parse(await readFile('data/bern-audit/routes.json'))
assert.deepEqual(raw.routes.map(r => r.id).sort(), inventory.map(r => r.id).sort())
const septemberPatterns = new Set((await Promise.all(baseline.days.map(async d => JSON.parse(await readFile(`data/bern-audit/${d.serviceDate}.json`))))).flatMap(d => d.patterns.map(p => p.id)))
const days = [], patterns = [], routeDays = new Map(raw.routes.map(r => [r.id, []]))
for (const snapshot of raw.snapshots) {
  // Never reuse September road contexts or construction geometry on another date.
  const result = applyBernMountains(snapshot, applyBernGeometry(snapshot, routes, source, crosswalk), routes, mountain)
  const feed = compactBernFeed(snapshot, result); validateBernSnapshot(feed)
  const date = snapshot.metadata.serviceDate, coverage = bernCoverage(result.trains, result.pairs, result.patterns)
  const newPatterns = result.patterns.filter(p => !septemberPatterns.has(p.id))
  for (const r of raw.routes) routeDays.get(r.id).push({ date, trips: result.trains.filter(t => t.routeId === r.id).length,
    admittedTrips: result.trains.filter(t => t.routeId === r.id && t.admission === 'admitted').length })
  patterns.push({ date, patterns: result.patterns.map(({ pathSegments, ...p }) => ({ ...p, matchedMask: pathSegments.map(i => i !== null) })) })
  days.push({ date, sourceServiceDates: snapshot.metadata.sourceServiceDates, ...coverage,
    patternsAbsentFromSeptember: newPatterns.length, admittedPatternsAbsentFromSeptember: newPatterns.filter(p => p.admittedTrips).length,
    validation: { fullSourceCalls: true, sourceCallPermissions: true, finiteOrderedTimes: true, directedPathEndpoints: true,
      calendarExceptionsAndPreviousDayCarryIn: true, septemberSupplementsApplied: false }, publishedAsAppFeed: false })
  console.log(date, coverage.admittedTrips, '/', coverage.trips, 'new patterns', newPatterns.length)
}
const routeReport = inventory.map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, mode: r.mode,
  inactiveInSeptember: r.status === 'inactive-on-validation-dates', days: routeDays.get(r.id) }))
const patternBytes = gzipSync(JSON.stringify(patterns))
await writeFile('data/bern-audit/seasonal-patterns.json.gz', patternBytes)
const report = { schemaVersion: 1, sourceHashes: { ...raw.sourceHashes, crosswalk: sha(crosswalkBytes), mountainPolicy: mountain.metadata.policySha256 },
  dateSelection: { winterWeekdaySunday: ['2026-01-16', '2026-01-18'], easter: ['2026-04-03', '2026-04-05'], nationalDay: ['2026-08-01'], earlyDecemberWeekdaySunday: ['2026-12-04', '2026-12-06'] },
  scope: 'Seven additional civil-day samples in the pinned 2025-12-14 through 2026-12-12 timetable. Geometry and original call patterns tested; historical source geometry is not proof of every seasonal alignment or construction state. Separate audit, no seasonal application feed published.',
  patternEvidenceSha256: sha(patternBytes), septemberDates: ['2026-09-04', '2026-09-06'],
  newlyActiveRoutes: routeReport.filter(r => r.inactiveInSeptember && r.days.some(d => d.trips)).map(r => r.routeId),
  stillInactiveRoutes: routeReport.filter(r => r.inactiveInSeptember && r.days.every(d => !d.trips)).map(r => r.routeId), days, routes: routeReport }
await writeFile('data/bern-audit/seasonal-summary.json', JSON.stringify(report, null, 2) + '\n')
console.log('Newly active routes', report.newlyActiveRoutes.length, 'still inactive', report.stillInactiveRoutes.length)
