import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadThurgauShipping } from './thurgau-shipping.mjs'
const timetable = JSON.parse(gunzipSync(await readFile('data/thurgau-audit/timetable-cache.json.gz'))), shipping = await loadThurgauShipping(timetable)
const report = { reviewed: '2026-09-08', policySha256: shipping.policySha256, sourceSha256: shipping.policy.sourceSha256, method: shipping.source.model,
  scope: shipping.policy.scope, shorelineRule: shipping.policy.shorelineRule, sourceIdentityLimit: shipping.source.sourceIdentityLimit,
  inventory: { shippingRecords: shipping.inventory.shipping.length, waterRecords: shipping.inventory.water.length, selectedWays: shipping.policy.pairs.length, selectedShippingNodes: shipping.inventory.selectedShippingNodeCount },
  days: shipping.policy.dates.map(date => ({ date, addedJourneys: shipping.patterns.filter(p => p.admitted).reduce((n, p) => n + (p.days[date] ?? 0), 0), admittedPatterns: shipping.patterns.filter(p => p.admitted && p.days[date]).length,
    unresolvedJourneys: shipping.patterns.filter(p => !p.admitted).reduce((n, p) => n + (p.days[date] ?? 0), 0) })),
  replacementSegments: [...new Map(shipping.patterns.filter(p => p.admitted).flatMap(p => p.segments.filter(s => s.wayId).map(s => [JSON.stringify(s.path), s]))).values()],
  patterns: shipping.patterns, riverPolygon: shipping.riverPolygon }
await writeFile('data/thurgau-shipping-sources/path-review.json', JSON.stringify(report, null, 2) + '\n')
console.log(report.days)
