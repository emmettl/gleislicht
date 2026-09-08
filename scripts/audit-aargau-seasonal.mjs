import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { AARGAU_SEASONAL_DATES, loadSeasonalContext, auditSeasonalDate, seasonalRouteInventory } from './aargau-seasonal.mjs'

const input = process.argv[2] ?? 'data/aargau-seasonal/input'
const output = process.argv[3] ?? 'data/aargau-seasonal'
const context = await loadSeasonalContext(input)
await mkdir(output, { recursive: true })
const days = []
for (const date of AARGAU_SEASONAL_DATES) {
  const day = await auditSeasonalDate(context, input, date)
  const file = `${date}-patterns.json.gz`
  await writeFile(join(output, file), gzipSync(JSON.stringify({ date, patterns: day.patterns, pairs: day.pairs }), { level: 9 }))
  const { patterns: _patterns, pairs: _pairs, ...summary } = day
  days.push({ ...summary, patternsFile: file, patternsSha256: await hashFile(join(output, file)) })
  console.log(`${date}: ${day.trips} journeys; ${day.matched}/${day.total} compatible segments; ${day.newPatterns} new patterns`)
}
const routes = seasonalRouteInventory(context, days)
const summary = {
  schemaVersion: 1, archiveSha256: context.inventory.metadata.archiveSha256, sourceHashes: context.sourceHashes,
  inventorySha256: await hashFile(join(input, 'inventory.json')), sourceVerificationSha256: await hashFile(join(input, 'source-verification.json')),
  dateSelection: { winter: ['2026-01-16', '2026-01-18', '2026-12-11'], easter: ['2026-04-03', '2026-04-05'], summer: ['2026-07-17', '2026-07-19'], nationalDay: ['2026-08-01'], autumn: ['2026-09-04', '2026-09-06', '2026-10-23', '2026-10-25'] },
  scope: 'Twelve-date compatibility sample from pinned annual GTFS. Full calls and civil-day carry-in are independently verified. Geometry is replayed with existing route/platform/coordinate guards. Compatibility is not seasonal temporal validity, directional road/track certification or publication approval. No production policy or feed is changed.',
  newlyActiveRoutes: routes.filter(r => r.inactiveOnSeptemberFixtures && r.days.some(d => d.trips)).map(r => r.routeId),
  stillInactiveRoutes: routes.filter(r => r.status === 'inactive-on-sampled-dates').map(r => r.routeId),
  publicationReady: false, days, routes,
}
await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(`Newly active routes: ${summary.newlyActiveRoutes.length}; still inactive: ${summary.stillInactiveRoutes.length}`)
