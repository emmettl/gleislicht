import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { gzipSync } from 'node:zlib'
import { parseCsvLine } from '@motionstudies/data/gtfs'
import { DEFAULT_MANIFEST, readPostbusDay, roadPatternId } from './prepare-postbus-road-feed.mjs'

export const DEFAULT_ROAD_CACHE = 'data/postbus-road-cache.json'
export const ROAD_LIMITS = { snapMetres: 120, maxDetourRatio: 6, detourAllowanceMetres: 1500, simplifyMetres: 5 }

async function* rows(path) {
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  let headers
  for await (const line of lines) {
    if (!line) continue
    const values = parseCsvLine(line)
    if (!headers) { headers = values; continue }
    yield Object.fromEntries(headers.map((key, index) => [key, values[index] ?? '']))
  }
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

export function distanceMetres(a, b) {
  const scale = Math.cos((a[1] + b[1]) * Math.PI / 360)
  return Math.hypot((a[0] - b[0]) * scale, a[1] - b[1]) * 111320
}

export function simplifyRoad(points, tolerance = ROAD_LIMITS.simplifyMetres) {
  if (points.length <= 2) return points
  const kept = new Set([0, points.length - 1])
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()
    const a = points[first], b = points[last]
    const xScale = Math.cos((a[1] + b[1]) * Math.PI / 360)
    const dx = (b[0] - a[0]) * xScale, dy = b[1] - a[1]
    const denominator = dx * dx + dy * dy
    let furthest = tolerance, split = -1
    for (let i = first + 1; i < last; i++) {
      const px = (points[i][0] - a[0]) * xScale, py = points[i][1] - a[1]
      const progress = denominator ? Math.min(1, Math.max(0, (px * dx + py * dy) / denominator)) : 0
      const distance = Math.hypot(px - progress * dx, py - progress * dy) * 111320
      if (distance > furthest) { furthest = distance; split = i }
    }
    if (split >= 0) { kept.add(split); stack.push([first, split], [split, last]) }
  }
  return [...kept].sort((a, b) => a - b).map(index => points[index])
}

// Slice by GTFS's monotone shape distance, never nearest-point search: this
// preserves loops, repeated stops and the correct direction through hairpins.
export function sliceShape(shape, from, to) {
  if (!shape?.length || !Number.isFinite(from) || !Number.isFinite(to) || to <= from ||
      from < shape[0][2] - 0.1 || to > shape.at(-1)[2] + 0.1) return null
  function pointAt(target) {
    let low = 0, high = shape.length - 1
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (shape[mid][2] < target) low = mid + 1
      else high = mid
    }
    const a = shape[Math.max(0, low - 1)], b = shape[low]
    const p = b[2] === a[2] ? 0 : Math.max(0, Math.min(1, (target - a[2]) / (b[2] - a[2])))
    return [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p]
  }
  return [pointAt(from), ...shape.filter(point => point[2] > from && point[2] < to).map(point => point.slice(0, 2)), pointAt(to)]
}

export function assessRoad(points, from, to, limits = ROAD_LIMITS) {
  if (!points || points.length < 2 || points.some(point => point.length !== 2 || !point.every(Number.isFinite))) return { reason: 'missing-shape' }
  const snap = Math.max(distanceMetres(points[0], from), distanceMetres(points.at(-1), to))
  if (snap > limits.snapMetres) return { reason: 'stop-too-far', snap }
  const length = points.slice(1).reduce((sum, point, i) => sum + distanceMetres(points[i], point), 0)
  const direct = distanceMetres(from, to)
  if (length > Math.max(limits.detourAllowanceMetres, direct * limits.maxDetourRatio)) return { reason: 'excessive-detour', length, direct, snap }
  if (length < direct * 0.5 && direct > 150) return { reason: 'short-path', length, direct, snap }
  // Endpoints use the timetable platforms, with a short connector to the road.
  const path = simplifyRoad([from.slice(0, 2), ...points, to.slice(0, 2)], limits.simplifyMetres)
    .map(point => point.map(value => Number(value.toFixed(6))))
    .filter((point, index, all) => !index || point[0] !== all[index - 1][0] || point[1] !== all[index - 1][1])
  return path.length < 2 ? { reason: 'coincident-stops' } : { path, length, direct, snap }
}

export function fallbackHops(log) {
  const fallbacks = new Set()
  for (const line of log.split('\n')) {
    if (!line.includes('No viable hop found')) continue
    const match = line.match(/No viable hop found between stops .* \(([^()]*)\) and .* \(([^()]*)\) for trip ([a-f0-9]{24}) /)
    assert(match, `Unrecognised pfaedle fallback warning: ${line}`)
    assert(!line.includes('similar trips'), 'Matcher grouped failures; rerun with --no-trie')
    fallbacks.add(`${match[3]}:${match[1]}:${match[2]}`)
  }
  return fallbacks
}

export async function importRoadShapes(directory, source) {
  const read = name => readFile(resolve(directory, name))
  const run = JSON.parse(await read('routing-run.json'))
  assert(run.completed && run.noTrie && run.warnings, 'Use match-postbus-roads.mjs to retain a complete fallback audit')
  for (const [name, key] of [['patterns.json', 'patternsSha256'], ['matching.log', 'logSha256'], ['shapes.txt', 'shapesSha256'], ['trips.txt', 'tripsSha256'], ['stop_times.txt', 'stopTimesSha256']]) {
    assert.equal(hash(await read(name)), run[key], `Changed matcher output: ${name}`)
  }
  const input = JSON.parse(await read('patterns.json'))
  const failed = fallbackHops((await read('matching.log')).toString())
  const tripShapes = new Map()
  for await (const row of rows(resolve(directory, 'trips.txt'))) tripShapes.set(row.trip_id, { routeId: row.route_id, shape: row.shape_id })
  const stopTimes = new Map()
  for await (const row of rows(resolve(directory, 'stop_times.txt'))) {
    const list = stopTimes.get(row.trip_id) ?? []
    list.push({ stop: row.stop_id, sequence: Number(row.stop_sequence), distance: row.shape_dist_traveled === '' ? NaN : Number(row.shape_dist_traveled) })
    stopTimes.set(row.trip_id, list)
  }
  for (const list of stopTimes.values()) list.sort((a, b) => a.sequence - b.sequence)
  const shapes = new Map()
  for await (const row of rows(resolve(directory, 'shapes.txt'))) {
    const list = shapes.get(row.shape_id) ?? []
    list.push([Number(row.shape_pt_lon), Number(row.shape_pt_lat), Number(row.shape_dist_traveled), Number(row.shape_pt_sequence)])
    shapes.set(row.shape_id, list)
  }
  for (const list of shapes.values()) {
    list.sort((a, b) => a[3] - b[3])
    assert(list.every((point, i) => point.every(Number.isFinite) && (!i || point[2] >= list[i - 1][2])), 'Invalid shape distances')
  }
  const paths = [], indexes = new Map(), patterns = {}, issues = [], routes = new Map()
  let matched = 0, total = 0, maxSnap = 0
  for (const pattern of input.patterns) {
    const trip = tripShapes.get(pattern.id)
    const times = stopTimes.get(pattern.id)
    assert(!trip || trip.routeId === pattern.routeId, 'Matcher changed route identity')
    if (times) assert.deepEqual(times.map(row => row.stop), pattern.stops.map(([index]) => input.stops[index][4]), 'Matcher changed the ordered platform sequence')
    const segments = []
    const route = routes.get(pattern.routeId) ?? { routeId: pattern.routeId, route: pattern.route, matched: 0, total: 0, patterns: 0 }
    route.patterns++
    for (let i = 1; i < pattern.stops.length; i++) {
      const from = input.stops[pattern.stops[i - 1][0]], to = input.stops[pattern.stops[i][0]]
      const result = failed.has(`${pattern.id}:${from[4]}:${to[4]}`)
        ? { reason: 'matcher-fallback' }
        : assessRoad(sliceShape(shapes.get(trip?.shape), times?.[i - 1]?.distance, times?.[i]?.distance), from, to)
      total += pattern.tripCount
      route.total += pattern.tripCount
      if (result.path) {
        const signature = JSON.stringify(result.path)
        let index = indexes.get(signature)
        if (index === undefined) { index = paths.length; indexes.set(signature, index); paths.push(result.path) }
        segments.push(index)
        matched += pattern.tripCount
        route.matched += pattern.tripCount
        maxSnap = Math.max(maxSnap, result.snap)
      } else {
        segments.push(null)
        issues.push({ pattern: pattern.id, routeId: pattern.routeId, route: pattern.route, segment: i - 1,
          from: from[2], to: to[2], fromId: from[4], toId: to[4], trips: pattern.tripCount, ...result })
      }
    }
    patterns[pattern.id] = segments
    routes.set(pattern.routeId, route)
  }
  return { schemaVersion: 1, metadata: {
    publisher: 'OpenStreetMap contributors', sourceUrl: 'https://www.openstreetmap.org/copyright',
    feedVersion: run.osmSha256.slice(0, 12), sourceSha256: run.osmSha256,
    license: 'ODbL-1.0', model: 'pfaedle bus map matching; inferred paths, not operator-verified routes',
    source, matcher: run, timetableFeedVersion: input.metadata.feedVersion,
    serviceDate: input.metadata.serviceDate, limits: ROAD_LIMITS, pilotRoutes: input.pilotRoutes,
  }, paths, patterns, report: { matchedSegments: matched, totalSegments: total,
    coverage: total ? matched / total : 0, routes: [...routes.values()], maxSnapMetres: maxSnap,
    rejectedPatternSegments: issues.length, issues } }
}

export function applyRoadCache(manifest, trains, cache) {
  assert.equal(cache.schemaVersion, 1)
  const paths = [], remap = new Map(), edgeCounts = new Map()
  let matched = 0, total = 0, missingPatterns = 0
  const enriched = trains.map(train => {
    const { pathSegments: _oldPaths, ...original } = train
    const segments = cache.patterns[roadPatternId(train, manifest.stops)]
    if (!segments) missingPatterns++
    if (segments) assert.equal(segments.length, train.stops.length - 1)
    const pathSegments = train.stops.slice(1).map((stop, i) => {
      total++
      const source = segments?.[i]
      if (source === null || source === undefined) return null
      assert(Number.isInteger(source) && source >= 0 && cache.paths[source]?.length >= 2, 'Invalid cached path reference')
      let index = remap.get(source)
      if (index === undefined) { index = paths.length; remap.set(source, index); paths.push(cache.paths[source]) }
      matched++
      const from = train.stops[i][0], to = stop[0]
      const key = [Math.min(from, to), Math.max(from, to)].join(':')
      const counts = edgeCounts.get(key) ?? new Map()
      counts.set(index, (counts.get(index) ?? 0) + 1)
      edgeCounts.set(key, counts)
      return index
    })
    return { ...original, pathSegments }
  })
  const edgePaths = manifest.edges.map(([a, b]) => {
    const counts = edgeCounts.get([Math.min(a, b), Math.max(a, b)].join(':'))
    return counts ? [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0] : null
  })
  return { paths, edgePaths, trains: enriched, matched, total, missingPatterns }
}

export async function enrichPostbusRoads(snapshotPath, cache, minimumCoverage = 0.95) {
  const { manifest, chunks, trains } = await readPostbusDay(snapshotPath)
  const geometry = applyRoadCache(manifest, trains, cache)
  const coverage = geometry.total ? geometry.matched / geometry.total : 0
  assert(coverage >= minimumCoverage, `Only ${(coverage * 100).toFixed(2)}% road coverage; need ${(minimumCoverage * 100).toFixed(1)}%. No artifacts written.`)
  const updated = new Map(geometry.trains.map(train => [train.id, train]))
  const writes = chunks.map(chunk => {
    const bytes = Buffer.from(JSON.stringify({ ...chunk.payload, trains: chunk.payload.trains.map(train => updated.get(train.id)) }))
    return { path: chunk.path, bytes, descriptor: { ...chunk.descriptor, bytes: bytes.length, sha256: hash(bytes) } }
  })
  const { report: _report, matcher, ...provenance } = cache.metadata
  const result = { ...manifest, paths: geometry.paths, edgePaths: geometry.edgePaths,
    metadata: { ...manifest.metadata,
      model: 'scheduled interpolation along inferred PostBus road paths',
      note: 'OSM road paths inferred with pfaedle. Unmatched segments retain stop-to-stop interpolation; no live GPS positions.',
      geometry: { ...provenance, matcherVersion: matcher.matcherVersion,
        matchedSegments: geometry.matched, totalSegments: geometry.total, missingPatternTrips: geometry.missingPatterns },
    }, chunks: writes.map(write => write.descriptor) }
  writes.push({ path: resolve(snapshotPath), bytes: Buffer.from(JSON.stringify(result)) })
  // Validate and stage everything before replacing any existing artifact;
  // update the manifest last, with hashes of the exact movement bytes.
  for (const write of writes) await writeFile(`${write.path}.tmp`, write.bytes)
  for (const write of writes) await rename(`${write.path}.tmp`, write.path)
  return { coverage, paths: geometry.paths.length, vertices: geometry.paths.reduce((sum, path) => sum + path.length, 0),
    topologyGzipBytes: gzipSync(writes.at(-1).bytes).length,
    maxChunkGzipBytes: Math.max(...writes.slice(0, -1).map(write => gzipSync(write.bytes).length)), missingPatternTrips: geometry.missingPatterns }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argument = (name, fallback) => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : fallback
  if (process.argv.includes('--help')) {
    console.log('Import matched geometry: --import MATCHED_FEED --source SOURCE_DESCRIPTION [--cache FILE]. Apply a cache: --apply [--cache FILE] [--snapshot MANIFEST] [--min-coverage 0.95]')
  } else {
    const cachePath = argument('cache', DEFAULT_ROAD_CACHE)
    if (argument('import')) {
      const source = argument('source')
      if (!source) throw new Error('--source is required for provenance')
      const cache = await importRoadShapes(argument('import'), source)
      await mkdir(dirname(resolve(cachePath)), { recursive: true })
      await writeFile(cachePath, JSON.stringify(cache))
      console.log({ ...cache.report, routes: cache.report.routes.length, issues: cache.report.issues.length, paths: cache.paths.length })
    }
    if (process.argv.includes('--apply')) console.log(await enrichPostbusRoads(argument('snapshot', DEFAULT_MANIFEST),
      JSON.parse(await readFile(cachePath, 'utf8')), Number(argument('min-coverage', 0.95))))
  }
}
