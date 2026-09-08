import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { loadThurgauFerry } from './thurgau-ferry.mjs'
import { loadThurgauBoats } from './thurgau-boat-geometry.mjs'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
const sha = b => createHash('sha256').update(b).digest('hex')
const timetable = JSON.parse(gunzipSync(await readFile('data/thurgau-audit/timetable-cache.json.gz')))
const ferry = await loadThurgauFerry(timetable), boats = await loadThurgauBoats(timetable)
const graph = lineGraph(boats.features)
const patterns = ferry.policy.patterns.map((p, i) => {
  const old = boats.matchPattern({ routeId: p.routeId, agencyId: p.agencyId, route: p.line, directionId: p.directionId, stops: [[0], [1]] }, { stops: p.calls }, timetable.routes.find(r => r.id === p.routeId))[0]
  const original = matchBaselSegment(graph, ...p.calls, boats.policy.limits)
  assert.equal(sha(JSON.stringify(original.path)), old.rejectedGeometrySha256)
  return { ...p, ...ferry.paths[i], previousFailure: old, previousRejectedPath: original.path }
})
const report = { reviewed: '2026-09-08', policySha256: ferry.policySha256, sourceSha256: ferry.policy.sourceSha256, method: ferry.source.model,
  inventory: { acquiredElements: ferry.inventory.length, selectedWay: ferry.policy.wayId, selectedVertices: ferry.inventory.filter(e => e.status === 'selected-ferry-vertex').length,
    exclusions: ferry.inventory.filter(e => e.status === 'excluded-unreviewed-for-exact-ferry-scope').length },
  scope: ferry.policy.scope, shorelineRule: ferry.policy.shorelineRule,
  days: ferry.policy.dates.map(date => ({ date, addedJourneys: patterns.filter(p => p.path).reduce((n, p) => n + (p.days[date] ?? 0), 0), patterns: patterns.filter(p => p.path && p.days[date]).length })),
  patterns }
await writeFile('data/thurgau-ferry-sources/path-review.json', JSON.stringify(report, null, 2) + '\n')
console.log(report.days)
