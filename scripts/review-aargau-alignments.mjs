import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { hashFile } from './inventory-aargau.mjs'
import { aargauRoadMatcher } from './aargau-road-geometry.mjs'
import { bernLv95 } from './bern-spatial.mjs'
import { distanceToSegment } from './bern-display-geometry.mjs'
import { AARGAU_BASELINE_DATES, readJson, readGzipJson } from './aargau-seasonal.mjs'

// Diagnostic only: even an exactly reversed path has zero separation. This
// must never be interpreted as proof of travel direction or used for admission.
export function symmetricVertexSeparation(a, b) {
  assert(a.length >= 2 && b.length >= 2)
  const oneWay = (left, right) => left.reduce((maximum, point) => Math.max(maximum,
    right.slice(1).reduce((minimum, end, i) => Math.min(minimum, distanceToSegment(point, right[i], end)), Infinity)), 0)
  return Math.max(oneWay(a, b), oneWay(b, a))
}

export async function reviewAargauAlignments() {
  const bundle = await readJson('data/aargau-road-cache.json')
  bundle.supplement = await readJson('data/aargau-rheinfelden-road-cache.json')
  const roads = aargauRoadMatcher(bundle)
  const days = [], sourceHashes = {}
  for (const file of ['data/aargau-road-cache.json', 'data/aargau-rheinfelden-road-cache.json', 'data/aargau-platform-policy.json']) sourceHashes[file] = await hashFile(file)
  for (const date of AARGAU_BASELINE_DATES) {
    const prefix = `fixtures/aargau/${date}`
    const audit = await readJson(`${prefix}/audit.json`), feed = await readJson(`${prefix}/aargau-region-day-manifest.json`)
    sourceHashes[`${prefix}/audit.json`] = await hashFile(`${prefix}/audit.json`)
    sourceHashes[`${prefix}/aargau-region-day-manifest.json`] = await hashFile(`${prefix}/aargau-region-day-manifest.json`)
    const stopIndices = new Map(feed.stops.map((s, i) => [s[4], i]))
    const comparisons = []
    for (const pattern of audit.patterns.filter(p => p.mode === 'bus')) {
      const cached = roads.matchPattern({ category: 'bus', agencyId: pattern.agencyId, routeId: pattern.routeId,
        directionId: pattern.gtfsDirectionId, stops: pattern.stopIds.map(id => [stopIndices.get(id), 0, 0]) }, feed.stops)
      for (const [i, segment] of pattern.segments.entries()) {
        if (segment.geometrySource !== 'agis' || segment.pathIndex === null) continue
        const from = feed.stops[stopIndices.get(segment.fromId)], to = feed.stops[stopIndices.get(segment.toId)]
        const comparator = cached?.[i]
        const separation = comparator?.path ? symmetricVertexSeparation(feed.paths[segment.pathIndex].map(bernLv95), comparator.path.map(bernLv95)) : null
        comparisons.push({ patternId: pattern.id, routeId: pattern.routeId, agencyId: pattern.agencyId, line: pattern.line,
          gtfsDirectionId: pattern.gtfsDirectionId, fromId: segment.fromId, toId: segment.toId, from: from[2], to: to[2], occurrences: pattern.occurrences,
          sourceFeatureId: pattern.source.featureId, sourceDirection: pattern.source.sourceDirection, coordinateOrder: pattern.source.coordinateOrder,
          maximumVertexSeparationMetres: separation, comparatorPatternId: comparator?.roadPatternId ?? null,
          review: separation === null ? 'no-accepted-full-pattern-comparator' : separation > 30 ? 'alignment-disagreement-over-30m' : 'within-30m-vertex-distance',
          comparatorFailure: separation === null ? comparator?.roadFailure ?? 'pattern-not-in-road-cache' : null })
      }
    }
    const categories = [...new Set(comparisons.map(c => c.review))].sort()
    days.push({ date, reviewedBusSegmentContexts: comparisons.length,
      counters: Object.fromEntries(categories.map(key => [key, { contexts: comparisons.filter(c => c.review === key).length,
        occurrences: comparisons.filter(c => c.review === key).reduce((n, c) => n + c.occurrences, 0) }])), comparisons })
  }
  return { schemaVersion: 1, sourceHashes, thresholdMetres: 30,
    method: 'Compare existing AGIS bus segment paths with accepted OSM paths for the exact full ordered route/platform/coordinate pattern. Symmetric source-vertex to polyline separation in approximate LV95 metres. The road cache was prepared for fallback patterns only, so absence of a comparator is not an alignment failure. This direction-insensitive diagnostic does not certify legal one-way operation, lane choice, running tracks or temporal diversion validity. No geometry or admission is changed.',
    publicationReady: false, days }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const review = await reviewAargauAlignments(), file = 'data/aargau-seasonal/alignment-review.json'
  for (const day of review.days) {
    const detail = { date: day.date, comparisons: day.comparisons }
    const bytes = gzipSync(JSON.stringify(detail), { level: 9 })
    day.comparisonsFile = `${day.date}-alignment-comparisons.json.gz`
    day.comparisonsSha256 = createHash('sha256').update(bytes).digest('hex')
    const path = `data/aargau-seasonal/${day.comparisonsFile}`
    if (process.argv.includes('--check')) {
      assert.equal(await hashFile(path), day.comparisonsSha256)
      assert.deepEqual(await readGzipJson(path), detail)
    } else await writeFile(path, bytes)
    delete day.comparisons
  }
  if (process.argv.includes('--check')) assert.deepEqual(await readJson(file), review)
  else await writeFile(file, JSON.stringify(review, null, 2) + '\n')
  console.log(JSON.stringify(review.days.map(({ date, counters }) => ({ date, counters })), null, 2))
}
