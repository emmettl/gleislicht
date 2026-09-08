import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { bernLv95 } from './bern-spatial.mjs'
import { distanceToSegment } from './bern-display-geometry.mjs'
import { loadSolothurnRoads } from './solothurn-road-geometry.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const context = JSON.parse(gunzipSync(await readFile('data/solothurn-pattern-contexts.json.gz')))
const roads = await loadSolothurnRoads(context, { verifyEvidence: true })
// Symmetric source-vertex distance is a disagreement diagnostic, not an
// itinerary or one-way certificate. Reversing a path can preserve this distance.
const deviation = (a, b) => Math.max(...a.map(p => Math.min(...b.slice(1).map((q, i) => distanceToSegment(p, b[i], q)))))
const days = []
for (const date of ['2026-09-04', '2026-09-06']) {
  const report = JSON.parse(await readFile(`data/solothurn-audit/${date}.json`))
  const feed = JSON.parse(await readFile(`public/data/solothurn-region/${date}/solothurn-region-day-manifest.json`))
  const paths = new Map()
  for (const descriptor of feed.chunks) {
    const chunk = JSON.parse(await readFile(`public/data/solothurn-region/${date}/${descriptor.path}`))
    for (const train of chunk.trains) for (const [i, path] of train.pathSegments.entries()) {
      const key = JSON.stringify([train.routeId, feed.stops[train.stops[i][0]][4], feed.stops[train.stops[i + 1][0]][4]])
      paths.set(key, feed.paths[path])
    }
  }
  const comparisons = report.directedPairs.filter(p => p.geometrySource === 'solothurn-network' && p.mode === 'bus' && p.admittedOccurrences).map(p => {
    const key = JSON.stringify([p.routeId, p.fromId, p.toId]), road = roads.pairs.get(key)
    if (!road?.path) return { ...p, review: 'no-consensus-comparator', comparatorFailure: road?.reason ?? 'no-road-context' }
    const a = paths.get(key).map(bernLv95), b = road.path.map(bernLv95)
    const maximumVertexSeparationMetres = Math.max(deviation(a, b), deviation(b, a))
    return { ...p, maximumVertexSeparationMetres, review: maximumVertexSeparationMetres > 30 ? 'alignment-disagreement-over-30m' : 'within-30m-vertex-distance' }
  })
  const exclusions = report.patterns.filter(p => !p.admittedTrips).map(p => ({ ...p,
    unresolvedPairs: report.directedPairs.filter(pair => pair.routeId === p.routeId && !pair.matched && p.stopIds.some((id, i) => id === pair.fromId && p.stopIds[i + 1] === pair.toId)) }))
  days.push({ date, totalExcludedTrips: report.coverage.trips - report.coverage.admittedTrips,
    busComparisons: Object.fromEntries([...new Set(comparisons.map(p => p.review))].map(review => [review, { directedPairs: comparisons.filter(p => p.review === review).length, admittedOccurrences: comparisons.filter(p => p.review === review).reduce((n, p) => n + p.admittedOccurrences, 0) }])),
    comparisons, exclusions })
}
const review = { schemaVersion: 1, contextSha256: await hashFile('data/solothurn-pattern-contexts.json.gz'), roadCacheSha256: roads.sha256,
  method: 'Compare retained cantonal bus paths to direction-aware full-pattern OSM road consensus. Symmetric vertex-to-polyline separation in approximate LV95 metres; 30 m is a review threshold, not a new admission limit. Comparisons are direction-insensitive and cannot prove one-way compliance. No admission or geometry changes from this diagnostic.',
  directionAndItinerary: { cantonalNetwork: 'Bidirectional geometry without route, operator or gauge fields; actual legal directions and running tracks unverified.',
    osmRoads: 'pfaedle bus profile enforces supported OSM access, direction and turn restrictions; every full stop-pattern context must agree. OSM tags and inferred itineraries are not operator confirmation.',
    fotRail: 'Explicit 1435 mm routes only, declared operating-point topology, bounded platform attachments and full-pattern stop-order exclusions. Running track and present-day alignment validity unverified.',
    boatTram: 'Official line and operator association checked. Platform projections and bidirectional paths do not certify the exact physical direction or diversions.' }, days }
await writeFile('data/solothurn-audit/alignment-review.json', JSON.stringify(review, null, 2) + '\n')
console.log(JSON.stringify(days.map(({ date, totalExcludedTrips, busComparisons }) => ({ date, totalExcludedTrips, busComparisons }))))
