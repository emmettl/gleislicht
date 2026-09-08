import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { chunkNetworkSnapshot } from '@motionstudies/data/network-chunks'
import { hashFile } from './inventory-aargau.mjs'
import { lineIndex } from './aargau-line-geometry.mjs'
import { applyAargauGeometry, validateAargauFeed } from './build-aargau-study.mjs'
import { aargauRoadMatcher } from './aargau-road-geometry.mjs'
import { loadAargauRail } from './aargau-rail-geometry.mjs'
import { aargauGapMatcher } from './aargau-gap-geometry.mjs'
import { loadAargauPlatforms } from './aargau-platform-geometry.mjs'

export const AARGAU_SEASONAL_DATES = ['2026-01-16', '2026-01-18', '2026-04-03', '2026-04-05', '2026-07-17', '2026-07-19', '2026-08-01', '2026-09-04', '2026-09-06', '2026-10-23', '2026-10-25', '2026-12-11']
export const AARGAU_BASELINE_DATES = ['2026-09-04', '2026-09-06']
export const readJson = async path => JSON.parse(await readFile(path, 'utf8'))
export const readGzipJson = async path => JSON.parse(gunzipSync(await readFile(path)))

// This is an offline compatibility probe. It deliberately does not call the
// publication builder or extend its input-hash/date-scoped admission policies.
export async function loadSeasonalContext(directory) {
  const inventory = await readJson(join(directory, 'inventory.json'))
  const verification = await readJson(join(directory, 'source-verification.json'))
  assert.deepEqual(inventory.metadata.dates, AARGAU_SEASONAL_DATES)
  assert(verification.passed)
  assert.equal(verification.inventorySha256, await hashFile(join(directory, 'inventory.json')))
  assert.equal(verification.archiveSha256, inventory.metadata.archiveSha256)
  const baseline = await readJson('data/aargau/inventory.json')
  assert.equal(inventory.metadata.archiveSha256, baseline.metadata.archiveSha256)
  assert.deepEqual(inventory.metadata.sourceRows, baseline.metadata.sourceRows)
  assert.deepEqual(inventory.cantonStopIds, baseline.cantonStopIds)
  const catalogue = await readJson('data/aargau-sources/sources.json')
  assert.equal(inventory.metadata.sourceCatalogueSha256, await hashFile('data/aargau-sources/sources.json'))
  for (const [file, record] of Object.entries(catalogue.files)) assert.equal(await hashFile(join('data/aargau-sources', file)), record.sha256)
  const crosswalk = await readJson('data/aargau-line-crosswalk.json')
  for (const row of [...crosswalk.mappings, ...crosswalk.gapMappings]) if (row.evidenceFile) assert.equal(await hashFile(row.evidenceFile), row.evidenceSha256)
  const collection = await readGzipJson('data/aargau-sources/lines.json.gz')
  const bundle = await readJson('data/aargau-road-cache.json')
  bundle.supplement = await readJson('data/aargau-rheinfelden-road-cache.json')
  const rails = await loadAargauRail('data/aargau-rail-sources', 'data/aargau-rail-policy.json')
  for (const date of AARGAU_BASELINE_DATES) {
    const hash = await hashFile(`data/aargau/${date}-timetable.json.gz`)
    assert.equal(rails.policy.inputTimetableHashes[date], hash)
    for (const cache of [...Object.values(bundle.agencyCaches), ...Object.values(bundle.supplement.agencyCaches)]) assert.equal(cache.metadata.inputTimetableHashes[date], hash)
  }
  const baselinePatterns = new Set()
  for (const date of AARGAU_BASELINE_DATES) for (const p of (await readJson(`fixtures/aargau/${date}/audit.json`)).patterns) baselinePatterns.add(p.id)
  const files = ['data/aargau/inventory.json', 'data/aargau-sources/sources.json', 'data/aargau-line-crosswalk.json', 'data/aargau-road-cache.json', 'data/aargau-rheinfelden-road-cache.json', 'data/aargau-rail-policy.json', 'data/aargau-rail-sources/source.json', 'data/aargau-platform-policy.json']
  const sourceHashes = Object.fromEntries(await Promise.all(files.map(async file => [file, await hashFile(file)])))
  for (const date of AARGAU_BASELINE_DATES) for (const name of ['audit.json', 'aargau-region-day-manifest.json']) {
    const file = `fixtures/aargau/${date}/${name}`; sourceHashes[file] = await hashFile(file)
  }
  return { inventory, verification, baseline, baselinePatterns, catalogue, collection, crosswalk, index: lineIndex(collection, crosswalk.mappings), roads: aargauRoadMatcher(bundle), rails, sourceHashes }
}

export function summarizeSeasonalGeometry(result, date, baselinePatterns) {
  const totals = result.groups.reduce((sum, g) => {
    for (const key of ['trips', 'total', 'matched', 'officialMatched', 'roadMatched', 'railMatched', 'cantonAdjacentTotal', 'cantonAdjacentMatched']) sum[key] = (sum[key] ?? 0) + g[key]
    return sum
  }, {})
  const patterns = result.patterns.map(p => ({ ...p, newSinceSeptember: !baselinePatterns.has(p.id) }))
  return {
    date, ...totals, coverage: totals.total ? totals.matched / totals.total : null,
    directedPatterns: patterns.length, fullyMatchedPatterns: patterns.filter(p => p.completeGeometry).length,
    newPatterns: patterns.filter(p => p.newSinceSeptember).length,
    directedPairs: result.pairs.length, fullyMatchedPairs: result.pairs.filter(p => p.matched === p.occurrences).length,
    unresolvedPatterns: patterns.filter(p => !p.completeGeometry).length,
    missingOccurrences: totals.total - totals.matched,
    patterns, pairs: result.pairs, routes: result.routes, groups: result.groups,
  }
}

export async function auditSeasonalDate(context, directory, date) {
  assert(AARGAU_SEASONAL_DATES.includes(date))
  const rawFile = join(directory, `${date}-timetable.json.gz`)
  assert.equal(await hashFile(rawFile), context.verification.fixtures[`${date}-timetable.json.gz`])
  const raw = await readGzipJson(rawFile)
  assert.equal(raw.metadata.serviceDate, date)
  assert.equal(raw.metadata.archiveSha256, context.inventory.metadata.archiveSha256)
  const verified = context.verification.days.find(d => d.date === date)
  assert.equal(raw.trains.length, verified.journeys)
  assert.equal(raw.trains.reduce((n, t) => n + t.calls.length, 0), verified.calls)
  const baselineDate = AARGAU_BASELINE_DATES.includes(date)
  if (baselineDate) {
    const old = await readGzipJson(`data/aargau/${date}-timetable.json.gz`)
    assert.deepEqual(raw.stops, old.stops)
    assert.deepEqual(raw.trains, old.trains)
  }
  const platforms = baselineDate ? await loadAargauPlatforms(date) : undefined
  const gaps = aargauGapMatcher(context.collection, context.crosswalk.gapMappings, date)
  const result = applyAargauGeometry(raw, context.index, context.inventory.cantonStopIds, context.roads, context.rails, gaps, platforms)
  const { manifest, chunks } = chunkNetworkSnapshot(result.snapshot, 7200, 'audit-only')
  const checks = validateAargauFeed(result.snapshot, raw, manifest, chunks)
  if (baselineDate) {
    const old = await readJson(`fixtures/aargau/${date}/audit.json`)
    assert.deepEqual(result.patterns, old.patterns)
    assert.deepEqual(result.snapshot.paths, (await readJson(`fixtures/aargau/${date}/aargau-region-day-manifest.json`)).paths)
  } else {
    for (const p of result.patterns) for (const s of p.segments) assert(!s.platformFixId && !s.gapMappingId, 'Date-scoped exception leaked into another season')
  }
  const day = summarizeSeasonalGeometry(result, date, context.baselinePatterns)
  return { ...day, timetableFixtureSha256: await hashFile(rawFile), sourceVerification: verified,
    validation: { ...checks, independentArchiveVerification: true, dateScopedExceptionsPreserved: true, septemberGeometryUnchanged: baselineDate,
      elapsedCivilTimeValidated: date === '2026-10-25' ? false : null },
    scope: baselineDate ? 'Exact replay of reviewed September fixture.' : 'Geometry compatibility against pinned sources; road patterns and rail route policy are reused for diagnosis only. Temporal alignment validity and release admission are not established.',
    timeNote: date === '2026-10-25' ? 'DST fallback: source wall-clock call ordering is checked; the repeated local hour is not disambiguated. Not an elapsed-time day feed.' : null }
}

export function seasonalRouteInventory(context, days) {
  const baseline = new Map(context.baseline.routes.map(r => [r.routeId, r]))
  return context.inventory.routes.filter(r => r.cantonSourceTrips).map(r => {
    const observed = days.map(day => {
      const row = day.routes.find(x => x.routeId === r.routeId)
      assert.equal(row?.trips ?? 0, r.days.find(d => d.date === day.date).trips)
      return { date: day.date, trips: row?.trips ?? 0, matched: row?.matched ?? 0, total: row?.total ?? 0 }
    })
    return { routeId: r.routeId, agencyId: r.agencyId, operator: r.operator, line: r.line, mode: r.mode,
      inactiveOnSeptemberFixtures: baseline.get(r.routeId).days.every(d => !d.trips), days: observed,
      status: observed.every(d => !d.trips) ? 'inactive-on-sampled-dates' : observed.some(d => d.total > d.matched) ? 'active-with-geometry-gaps' : 'compatible-on-active-sampled-dates' }
  })
}
