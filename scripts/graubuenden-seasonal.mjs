import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { readJson, saveJson } from './build-graubuenden-region.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const GR_SEASONAL_DATES = ['2026-01-16', '2026-01-18', '2026-04-03', '2026-04-05', '2026-07-17', '2026-07-19', '2026-08-01', '2026-09-04', '2026-09-06', '2026-10-23', '2026-10-25', '2026-12-11']
export function seasonalStatus(train, baselinePatterns) {
  if (train.calls.some(c => ['2', '3'].includes(c.pickupType) || ['2', '3'].includes(c.dropOffType))) return 'prior-arrangement-call'
  const baseline = baselinePatterns.get(sha256(directedPatternKey(train)).slice(0, 20))
  return !baseline ? 'unreviewed-seasonal-pattern' : baseline.admitted ? 'matches-reviewed-September-pattern' : 'known-September-geometry-exclusion'
}
export function seasonalCounts(patterns) {
  return { journeys: patterns.reduce((n, p) => n + p.trips, 0), patternCount: patterns.length,
    headwayJourneys: patterns.reduce((n, p) => n + p.headwayTrips, 0), carryIns: patterns.reduce((n, p) => n + p.carryInTrips, 0),
    byStatus: Object.fromEntries(['matches-reviewed-September-pattern', 'known-September-geometry-exclusion', 'unreviewed-seasonal-pattern', 'prior-arrangement-call'].map(s => [s, patterns.filter(p => p.status === s).reduce((n, p) => n + p.trips, 0)])) }
}
export async function auditGraubuendenSeasonal() {
  const raw = await readJson('data/graubuenden-audit/seasonal-timetable.json.gz'), baseline = await readJson('data/graubuenden-audit/timetable.json.gz')
  assert.deepEqual(raw.dates, GR_SEASONAL_DATES); assert.deepEqual(raw.sourceHashes, baseline.sourceHashes); assert.deepEqual(raw.scope, baseline.scope)
  const identity = ({ activeSourceTripRecords: _active, ...r }) => r
  assert.deepEqual(raw.inventory.map(identity), baseline.inventory.map(identity), 'Seasonal census changed annual membership')
  assert.deepEqual(raw.cantonStops, baseline.cantonStops)
  for (const day of baseline.snapshots) assert.deepEqual(raw.snapshots.find(d => d.date === day.date), day, 'September source journeys changed')
  const baselinePatterns = new Map(), baselineFiles = {}
  for (const date of baseline.dates) {
    const file = `data/graubuenden-audit/${date}.json`, bytes = await readFile(file), report = JSON.parse(bytes); baselineFiles[file] = sha256(bytes)
    for (const p of report.patterns) {
      if (baselinePatterns.has(p.id)) assert.equal(baselinePatterns.get(p.id).admitted, p.admitted)
      baselinePatterns.set(p.id, p)
    }
  }
  const routeIndex = new Map(raw.inventory.map(r => [r.routeId, r])), reports = []
  for (const day of raw.snapshots) {
    const patterns = new Map()
    for (const t of day.trains) {
      const id = sha256(directedPatternKey(t)).slice(0, 20), route = routeIndex.get(t.routeId)
      if (!patterns.has(id)) patterns.set(id, { id, routeId: route.routeId, agencyId: route.agencyId, mode: route.mode, line: route.line,
        directionId: t.directionId, stopIds: t.calls.map(c => c.id), callRules: t.calls.map(c => [c.pickupType, c.dropOffType]),
        status: seasonalStatus(t, baselinePatterns), trips: 0, headwayTrips: 0, carryInTrips: 0 })
      const p = patterns.get(id); p.trips++; p.headwayTrips += Number(t.frequency?.exactTimes === 0); p.carryInTrips += Number(t.sourceServiceDate !== day.date)
    }
    const pp = [...patterns.values()]
    reports.push({ date: day.date, ...seasonalCounts(pp), releasedDate: baseline.dates.includes(day.date),
      dstRepeatedHourDisambiguated: day.date === '2026-10-25' ? false : null,
      byMode: [...new Set(raw.inventory.map(r => r.mode))].sort().map(mode => ({ mode, ...seasonalCounts(pp.filter(p => p.mode === mode)) })), patterns: pp })
  }
  const inventory = raw.inventory.map(r => ({ routeId: r.routeId, agencyId: r.agencyId, agency: r.agency, line: r.line, mode: r.mode,
    inactiveOnSeptemberFixtures: !baseline.snapshots.some(d => d.trains.some(t => t.routeId === r.routeId)),
    days: reports.map(d => ({ date: d.date, ...seasonalCounts(d.patterns.filter(p => p.routeId === r.routeId)) })) }))
  const s = { schemaVersion: 1, timetableSha256: sha256(await readFile('data/graubuenden-audit/seasonal-timetable.json.gz')), sourceHashes: raw.sourceHashes, baselineFiles,
    scope: 'Twelve-date timetable inventory and exact full-pattern comparison with the released September study. A matching pattern is a reuse candidate, not seasonal geometry admission. No winter road access, operator direction, diversion or elapsed-time DST model is certified.',
    dateSelection: { winter: ['2026-01-16', '2026-01-18', '2026-12-11'], easter: ['2026-04-03', '2026-04-05'], summer: ['2026-07-17', '2026-07-19'], nationalDay: ['2026-08-01'], autumn: ['2026-09-04', '2026-09-06', '2026-10-23', '2026-10-25'] },
    annualRoutes: inventory.length, annualAgencies: new Set(inventory.map(r => r.agencyId)).size,
    newlyActiveRoutes: inventory.filter(r => r.inactiveOnSeptemberFixtures && r.days.some(d => d.journeys)).map(r => r.routeId),
    stillInactiveRoutes: inventory.filter(r => r.days.every(d => !d.journeys)).map(r => r.routeId),
    days: reports.map(({ patterns: _patterns, ...d }) => d), routes: inventory }
  await saveJson('data/graubuenden-audit/seasonal-summary.json', s)
  await writeFile('data/graubuenden-audit/seasonal-patterns.json.gz', gzipSync(JSON.stringify(reports)))
  return s
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 const s = await auditGraubuendenSeasonal(); console.log(JSON.stringify({ newlyActive: s.newlyActiveRoutes.length, stillInactive: s.stillInactiveRoutes.length, dates: s.days.map(({date,journeys,patternCount,byStatus}) => ({date,journeys,patternCount,byStatus})) }))
}
