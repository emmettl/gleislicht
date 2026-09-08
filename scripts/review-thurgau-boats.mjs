import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadThurgauBoats } from './thurgau-boat-geometry.mjs'
const raw = JSON.parse(gunzipSync(await readFile('data/thurgau-audit/timetable-cache.json.gz'))), boats = await loadThurgauBoats(raw)
const patterns = new Map(), routes = new Map(raw.routes.map(r => [r.id, r]))
for (const day of raw.snapshots) for (const train of day.trains.filter(t => routes.get(t.routeId).mode === 'ferry')) {
  const calls = train.stops.map(([i]) => day.stops[i]), key = JSON.stringify([train.routeId, train.directionId, calls.map(s => s[4])])
  if (!patterns.has(key)) {
    const segments = boats.matchPattern(train, day, routes.get(train.routeId))
    patterns.set(key, { key, routeId: train.routeId, line: train.route, directionId: train.directionId, agencyId: train.agencyId, calls, segments,
      admitted: !train.reservationRequired && segments.every(s => s.path), days: {} })
  }
  const p = patterns.get(key); p.days[day.metadata.serviceDate] = (p.days[day.metadata.serviceDate] ?? 0) + 1
}
const admitted = [...patterns.values()].filter(p => p.admitted)
const report = { reviewed: '2026-09-08', policySha256: boats.policySha256, sourceSha256: boats.policy.sourceSha256,
  sourceFeatureCount: boats.inventory.length, method: boats.source.model, scope: boats.policy.scope, shorelineRule: boats.policy.shorelineRule,
  uniquePatterns: patterns.size, admittedPatterns: admitted.length,
  maximumAdmittedDockSnapMetres: Math.max(...admitted.flatMap(p => p.segments.map(s => s.maximumSnapMetres))),
  admittedOutsideWaterIntervals: admitted.flatMap(p => p.segments.flatMap((s, segment) => s.water.outsideIntervals.map(interval => ({ pattern: p.key, segment, ...interval })))),
  patterns: [...patterns.values()] }
await writeFile('data/thurgau-boat-sources/path-review.json', JSON.stringify(report, null, 2) + '\n')
console.log({ uniquePatterns: patterns.size, admittedPatterns: admitted.length, maximumAdmittedDockSnapMetres: report.maximumAdmittedDockSnapMetres, dockDiscrepancies: report.admittedOutsideWaterIntervals.length })
