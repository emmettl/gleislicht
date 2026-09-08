import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { importRoadShapes, distanceMetres } from './enrich-postbus-roads.mjs'
import { BASEL_AGENCIES } from './basel-line-geometry.mjs'

export async function importBaselRoadCaches(directories, source) {
  const agencyCaches = {}
  for (const agencyId of ['823', '37']) {
    const directory = directories[agencyId]
    const input = JSON.parse(await readFile(join(directory, 'patterns.json'), 'utf8'))
    assert.equal(input.metadata.baselRoadAgencyId, agencyId, 'Wrong Basel road-feed agency')
    const cache = await importRoadShapes(directory, source)
    cache.metadata.agencyId = agencyId
    cache.metadata.serviceDates = input.metadata.serviceDates
    cache.metadata.inputManifestHashes = input.metadata.inputManifestHashes
    agencyCaches[agencyId] = cache
  }
  return { schemaVersion: 1, agencyCaches }
}

// Match the entire route/platform pattern before consulting its segment. A
// successful A→B match in one pattern must never fill another pattern's gap.
export function applyBaselRoadFallback(snapshot, official, routes, bundle) {
  assert.equal(bundle.schemaVersion, 1)
  assert.deepEqual(Object.keys(bundle.agencyCaches).sort(), ['37', '823'])
  const rejected = new Map(), paths = [...official.paths], pathRemap = new Map(), pairs = new Map(), edges = new Map()
  const groups = new Map(official.groups.map(group => [group.id, { ...group, matched: 0, roadMatched: 0 }]))
  const routeCounts = new Map(official.routes.map(route => [route.routeId, { ...route, matched: 0, roadMatched: 0 }]))
  const keyOf = segment => `${segment.routeId}:${segment.fromId}:${segment.toId}`
  for (const segment of official.segments) pairs.set(keyOf(segment), { ...segment, matchedOccurrences: 0, roadOccurrences: 0, representativePathIndex: null, pathVariants: new Set() })
  const issues = new Map(), sourceSummaries = []
  for (const [agencyId, cache] of Object.entries(bundle.agencyCaches)) {
    assert.equal(cache.schemaVersion, 1)
    assert.equal(cache.metadata.agencyId, agencyId)
    assert.equal(cache.metadata.license, 'ODbL-1.0', 'Missing OSM attribution')
    assert(cache.metadata.matcher.completed && cache.metadata.matcher.noTrie && cache.metadata.matcher.warnings, 'Incomplete road matcher provenance')
    for (const issue of cache.report.issues) rejected.set(`${agencyId}:${issue.pattern}:${issue.segment}`, issue)
    sourceSummaries.push({ ...cache.metadata, paths: cache.paths.length, maximumAcceptedSnapMetres: cache.report.maxSnapMetres })
  }
  let added = 0, missingPatternTrips = 0
  const trains = official.trains.map(train => {
    const route = routes.get(train.routeId), group = groups.get(`${BASEL_AGENCIES[route.agencyId]}-${train.category}`), count = routeCounts.get(train.routeId)
    const cache = train.category === 'bus' ? bundle.agencyCaches[route.agencyId] : undefined
    const pattern = cache ? roadPatternId(train, snapshot.stops) : undefined
    const cached = cache?.patterns[pattern]
    if (cache && !cached) missingPatternTrips++
    if (cached) assert.equal(cached.length, train.stops.length - 1, 'Changed road pattern length')
    const pathSegments = train.pathSegments.map((existing, i) => {
      const from = snapshot.stops[train.stops[i][0]], to = snapshot.stops[train.stops[i + 1][0]]
      const pair = pairs.get(`${train.routeId}:${from[4]}:${to[4]}`)
      let index = existing
      if (index === null && cache) {
        const sourceIndex = cached?.[i], failure = rejected.get(`${route.agencyId}:${pattern}:${i}`)
        assert(!failure || sourceIndex === null || sourceIndex === undefined, 'Rejected road hop has a cached path')
        if (sourceIndex !== null && sourceIndex !== undefined) {
          assert(Number.isInteger(sourceIndex) && sourceIndex >= 0 && cache.paths[sourceIndex]?.length >= 2, 'Invalid Basel road path')
          const path = cache.paths[sourceIndex]
          assert(path.every(point => point.length === 2 && point.every(Number.isFinite)), 'Invalid Basel road coordinates')
          assert(distanceMetres(path[0], from) < 1 && distanceMetres(path.at(-1), to) < 1, 'Cached road endpoints differ from the exact pattern')
          const key = `${route.agencyId}:${sourceIndex}`
          if (!pathRemap.has(key)) { pathRemap.set(key, paths.length); paths.push(path) }
          index = pathRemap.get(key); added++; pair.roadOccurrences++; group.roadMatched++; count.roadMatched++
        } else {
          const key = `${route.agencyId}:${pattern}:${i}`
          const issue = issues.get(key) ?? { agencyId: route.agencyId, pattern, routeId: train.routeId, line: train.route, segment: i,
            from: from[2], to: to[2], fromId: from[4], toId: to[4], reason: failure?.reason ?? (cached ? 'unmatched-road' : 'missing-road-pattern'),
            ...(failure?.snap !== undefined ? { snapMetres: failure.snap } : {}), occurrences: 0 }
          issue.occurrences++; issues.set(key, issue)
        }
      }
      if (index !== null) {
        group.matched++; count.matched++; pair.matchedOccurrences++; pair.pathVariants.add(index); pair.representativePathIndex ??= index
        const key = [train.stops[i][0], train.stops[i + 1][0]].sort((a, b) => a - b).join(':')
        const weights = edges.get(key) ?? new Map()
        weights.set(index, (weights.get(index) ?? 0) + 1); edges.set(key, weights)
      }
      return index
    })
    return { ...train, pathSegments }
  })
  return { paths, trains, groups: [...groups.values()].map(group => ({ ...group, coverage: group.matched / group.total })),
    routes: [...routeCounts.values()].map(route => ({ ...route, coverage: route.matched / route.total })),
    edgePaths: snapshot.edges.map(pair => {
      const weights = edges.get([...pair].sort((a, b) => a - b).join(':'))
      return weights ? [...weights].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0] : null
    }),
    segments: [...pairs.values()].map(({ pathVariants, representativePathIndex, ...pair }) => ({ ...pair,
      // This report field is only representative. Trains retain their exact
      // per-pattern paths; a unique pair counts as matched only if all its
      // scheduled occurrences matched, including repeated pairs in loops.
      pathIndex: pair.matchedOccurrences === pair.occurrences ? representativePathIndex : null,
      pathVariantCount: pathVariants.size,
    })),
    roadFallback: { addedMovements: added, addedPaths: paths.length - official.paths.length, missingPatternTrips, sources: sourceSummaries, issues: [...issues.values()] },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { bvb: { type: 'string' }, blt: { type: 'string' }, source: { type: 'string' }, output: { type: 'string' } } })
  assert(values.bvb && values.blt && values.source && values.output, 'Requires --bvb MATCHED_DIRECTORY --blt MATCHED_DIRECTORY --source DESCRIPTION --output CACHE')
  const bundle = await importBaselRoadCaches({ '823': values.bvb, '37': values.blt }, values.source)
  await writeFile(values.output, JSON.stringify(bundle))
  console.log(Object.entries(bundle.agencyCaches).map(([agencyId, cache]) => ({ agencyId, patterns: Object.keys(cache.patterns).length, coverage: cache.report.coverage })))
}
