import assert from 'node:assert/strict'
import { join } from 'node:path'
import { hashFile } from './inventory-aargau.mjs'
import { AARGAU_SEASONAL_DATES, readJson, readGzipJson, loadSeasonalContext, auditSeasonalDate, seasonalRouteInventory } from './aargau-seasonal.mjs'

const input = process.argv[2] ?? 'data/aargau-seasonal/input'
const output = process.argv[3] ?? 'data/aargau-seasonal'
const context = await loadSeasonalContext(input)
const summary = await readJson(join(output, 'summary.json'))
assert.equal(summary.publicationReady, false)
assert.equal(summary.archiveSha256, context.inventory.metadata.archiveSha256)
assert.deepEqual(summary.sourceHashes, context.sourceHashes)
assert.equal(summary.inventorySha256, await hashFile(join(input, 'inventory.json')))
assert.equal(summary.sourceVerificationSha256, await hashFile(join(input, 'source-verification.json')))
assert.deepEqual(summary.days.map(d => d.date), AARGAU_SEASONAL_DATES)
for (const day of summary.days) {
  const actual = await auditSeasonalDate(context, input, day.date)
  assert.equal(day.patternsSha256, await hashFile(join(output, day.patternsFile)))
  const patterns = await readGzipJson(join(output, day.patternsFile))
  assert.deepEqual(patterns, { date: day.date, patterns: actual.patterns, pairs: actual.pairs })
  const { patterns: _patterns, pairs: _pairs, ...expected } = actual
  const { patternsFile: _file, patternsSha256: _sha, ...recorded } = day
  assert.deepEqual(recorded, expected)
  console.log(`Verified ${day.date}: ${day.directedPatterns} complete directed patterns, ${day.trips} journeys`)
}
assert.deepEqual(summary.routes, seasonalRouteInventory(context, summary.days))
assert.deepEqual(summary.newlyActiveRoutes, summary.routes.filter(r => r.inactiveOnSeptemberFixtures && r.days.some(d => d.trips)).map(r => r.routeId))
assert.deepEqual(summary.stillInactiveRoutes, summary.routes.filter(r => r.status === 'inactive-on-sampled-dates').map(r => r.routeId))
console.log('Aargau seasonal source hashes, complete calls, every pattern/path decision, date guards and route totals verified')
