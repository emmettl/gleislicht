import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadThurgauWittenbach } from './thurgau-wittenbach.mjs'
import { applyThurgauGeometry } from './thurgau-line-geometry.mjs'
const z = async p => JSON.parse(gunzipSync(await readFile(p))), j = async p => JSON.parse(await readFile(p))
const timetable = await z('data/thurgau-audit/timetable-cache.json.gz'), roads = await z('data/thurgau-regional-roads/cache.json.gz')
const source = await z('data/thurgau-sources/decoded.json.gz'), crosswalk = await j('data/thurgau-line-crosswalk.json'), routes = new Map(timetable.routes.map(r => [r.id, r]))
const supplement = await loadThurgauWittenbach(timetable, roads), patterns = []
for (const day of timetable.snapshots) {
  const raw = { ...day, trains: day.trains.filter(t => supplement.policy.patterns.some(p => p.routeId === t.routeId)) }
  const result = applyThurgauGeometry(raw, routes, source, crosswalk, undefined, roads, undefined, undefined, supplement)
  for (const p of result.patterns.filter(p => p.wittenbachSupplement)) patterns.push({ serviceDate: day.metadata.serviceDate, patternId: p.id,
    roadPatternId: p.roadPatternId, routeId: p.routeId, trips: p.admittedTrips, directionId: p.directionId,
    stops: p.stopIds.map(id => raw.stops.find(s => s[4] === id)), paths: p.pathSegments.map(i => result.paths[i]) })
}
const osm = await z('data/thurgau-wittenbach-sources/osm.json.gz'), entries = new Map(osm.elements.map(e => [`${e.type}:${e.id}`, e]))
const inventory = [...entries.values()].filter(e => e.type !== 'node').map(e => ({ type: e.type, id: e.id, version: e.version, timestamp: e.timestamp, tags: e.tags,
  status: e.type === 'way' && supplement.policy.wayIds.includes(e.id) ? 'reviewed-turnaround-way' : supplement.policy.features.some(p => p.type === e.type && p.id === e.id) ? 'route-context-only-not-full-turnaround-proof' : 'outside-scoped-turnaround' }))
await writeFile('data/thurgau-wittenbach-sources/inventory.json', JSON.stringify(inventory, null, 2) + '\n')
await writeFile('data/thurgau-wittenbach-sources/path-review.json', JSON.stringify({ reviewed: '2026-09-08', policySha256: supplement.policySha256, sourceSha256: supplement.policy.sourceSha256,
  turn: supplement.turn, from: supplement.policy.from, to: supplement.policy.to, patterns }, null, 2) + '\n')
console.log({ patterns: patterns.length, journeys: patterns.reduce((n, p) => n + p.trips, 0), sourceWaysAndRelations: inventory.length })
