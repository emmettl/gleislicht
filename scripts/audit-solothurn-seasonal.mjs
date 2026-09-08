import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { solothurnGraphs, applySolothurnGeometry } from './solothurn-network-geometry.mjs'
import { loadSolothurnSupplements } from './solothurn-supplement-geometry.mjs'
import { bernCoverage, compactBernFeed, validateBernSnapshot } from './build-bern-region.mjs'
import { SO_SEASONAL_DATES, hashFile } from './solothurn-timetable.mjs'
const path = 'data/solothurn-audit/seasonal-timetable-cache.json.gz'
const raw = JSON.parse(gunzipSync(await readFile(path)))
assert.deepEqual(raw.snapshots.map(s => s.metadata.serviceDate), SO_SEASONAL_DATES)
assert.equal(raw.sourceHashes.source, await hashFile('data/solothurn-sources/decoded.json.gz'))
const source = JSON.parse(gunzipSync(await readFile('data/solothurn-sources/decoded.json.gz')))
const graphs = solothurnGraphs(source.lines), routes = new Map(raw.routes.map(r => [r.id, r])), cache = new Map()
const supplements = await loadSolothurnSupplements(raw)
const days = [], allPatterns = [], routeDays = new Map(raw.routes.map(r => [r.id, []]))
for (const snapshot of raw.snapshots) {
  const result = applySolothurnGeometry(snapshot, routes, graphs, cache, supplements)
  const feed = compactBernFeed(snapshot, result)
  validateBernSnapshot(feed)
  const coverage = bernCoverage(result.trains, result.pairs, result.patterns)
  const date = snapshot.metadata.serviceDate
  for (const r of raw.routes) routeDays.get(r.id).push({ date, trips: result.trains.filter(t => t.routeId === r.id).length,
    admittedTrips: result.trains.filter(t => t.routeId === r.id && t.admission === 'admitted').length })
  allPatterns.push({ date, patterns: result.patterns.map(({ pathSegments, ...p }) => ({ ...p, matchedMask: pathSegments.map(i => i !== null) })) })
  days.push({ date, ...coverage, sourceServiceDates: snapshot.metadata.sourceServiceDates,
    validation: { completeSourceCalls: true, directedGeometry: true, finiteOrderedTimes: true, civilCalendarExceptions: true,
      dstRepeatedHourDisambiguated: date === '2026-10-25' ? false : null },
    note: date === '2026-10-25' ? 'DST fallback date: geometry and source stop ordering tested; repeated local-hour instants are not disambiguated. Not promoted as an elapsed-time day feed.' : null })
  console.log(date, feed.trains.length, '/', result.trains.length)
}
const baseline = JSON.parse(await readFile('data/solothurn-audit/routes.json'))
const inventory = raw.routes.map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, mode: r.mode,
  inactiveOnSeptemberFixtures: baseline.find(b => b.id === r.id).status === 'inactive-on-validation-dates', days: routeDays.get(r.id),
  status: !routeDays.get(r.id).some(d => d.trips) ? 'inactive-on-all-twelve-dates' : !routeDays.get(r.id).some(d => d.admittedTrips) ? 'active-but-excluded' : 'contributes-seasonal-patterns' }))
const summary = { schemaVersion: 1, sourceHashes: raw.sourceHashes, timetableCacheSha256: await hashFile(path), supplementSources: supplements.metadata,
  dateSelection: { winter: ['2026-01-16', '2026-01-18', '2026-12-11'], easter: ['2026-04-03', '2026-04-05'], summer: ['2026-07-17', '2026-07-19'], nationalDay: ['2026-08-01'], autumn: ['2026-09-04', '2026-09-06', '2026-10-23', '2026-10-25'] },
  scope: 'Twelve date sample from the pinned annual GTFS. Complete calls retained and geometry validated. Not every calendar day, seasonal alignment, diversion or operator-specific physical direction is certified.',
  newlyActiveSeptemberExcludedRoutes: inventory.filter(r => r.inactiveOnSeptemberFixtures && r.days.some(d => d.trips)).map(r => r.routeId),
  stillInactiveRoutes: inventory.filter(r => r.status === 'inactive-on-all-twelve-dates').map(r => r.routeId), days, routes: inventory }
await writeFile('data/solothurn-audit/seasonal-summary.json', JSON.stringify(summary, null, 2) + '\n')
await writeFile('data/solothurn-audit/seasonal-patterns.json.gz', gzipSync(JSON.stringify(allPatterns), { mtime: 0 }))
console.log('Newly active', summary.newlyActiveSeptemberExcludedRoutes.length, 'still inactive', summary.stillInactiveRoutes.length)
