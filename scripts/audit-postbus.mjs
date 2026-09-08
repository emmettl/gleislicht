import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export async function auditPostbus(path = 'public/data/postbus-national-day-manifest.json') {
  const bytes = await readFile(path)
  const manifest = JSON.parse(bytes)
  assert.deepEqual(manifest.metadata.localAgencyIds, ['801'])
  assert.deepEqual(manifest.metadata.modes, ['bus'])
  assert.equal(manifest.metadata.localRouteIds, undefined, 'National coverage must not restrict individual routes')
  assert.equal(manifest.metadata.windowStart, 0)
  assert.equal(manifest.metadata.windowEnd, 86400)
  assert.equal(manifest.chunks.length, 8)
  const topologyGzipBytes = gzipSync(bytes).length
  // Road paths add ~1.56 MiB compressed to the existing 542 KiB topology.
  // This is loaded only after choosing PostBus; retain a measured 3 MiB cap.
  assert(topologyGzipBytes < 3 * 1024 * 1024, 'PostBus topology exceeds its 3 MiB compressed road-geometry budget')
  assert.equal(manifest.metadata.geometry?.publisher, 'OpenStreetMap contributors')
  assert.equal(manifest.metadata.geometry?.license, 'ODbL-1.0')
  assert.match(manifest.metadata.geometry?.sourceSha256, /^[a-f0-9]{64}$/)
  assert(Array.isArray(manifest.paths) && manifest.paths.length > 10000, 'PostBus road paths are missing')
  assert.equal(manifest.edgePaths?.length, manifest.edges.length)
  let vertices = 0
  for (const path of manifest.paths) {
    assert(path.length >= 2)
    vertices += path.length
    for (const point of path) assert(point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)
  }
  assert(vertices < 500000, 'PostBus path vertex budget exceeded')
  for (const index of manifest.edgePaths) assert(index === null || (Number.isInteger(index) && index >= 0 && manifest.paths[index]))
  const trips = new Map()
  const routes = new Set()
  const chunks = []
  const directory = dirname(resolve(path))
  let expectedStart = 0
  for (const descriptor of manifest.chunks) {
    assert.equal(descriptor.windowStart, expectedStart, 'PostBus day has a gap')
    assert.equal(descriptor.windowEnd - descriptor.windowStart, 10800)
    expectedStart = descriptor.windowEnd
    assert.match(descriptor.path, /^postbus-national-day-chunks\/\d{2}-\d{2}\.json$/)
    const payload = await readFile(resolve(directory, descriptor.path))
    assert.equal(payload.length, descriptor.bytes)
    assert.equal(createHash('sha256').update(payload).digest('hex'), descriptor.sha256)
    const chunk = JSON.parse(payload)
    assert.equal(chunk.windowStart, descriptor.windowStart)
    assert.equal(chunk.windowEnd, descriptor.windowEnd)
    assert.equal(chunk.trains.length, descriptor.tripCount)
    const gzipBytes = gzipSync(payload).length
    assert(gzipBytes < 1024 * 1024, `${descriptor.id} exceeds its 1 MiB compressed budget`)
    for (const train of chunk.trains) {
      assert.equal(train.category, 'bus')
      assert.equal(typeof train.routeId, 'string')
      assert(train.routeId.length > 0)
      assert(train.start <= chunk.windowEnd && train.end >= chunk.windowStart)
      assert(train.stops.length >= 2)
      assert.equal(train.pathSegments?.length, train.stops.length - 1)
      for (const [index, arrival, departure] of train.stops) {
        assert(manifest.stops[index], `Missing stop ${index}`)
        assert(Number.isFinite(arrival) && departure >= arrival)
      }
      for (const [segment, index] of train.pathSegments.entries()) {
        if (index === null) continue
        assert(Number.isInteger(index) && index >= 0 && manifest.paths[index], 'Missing road path')
        const path = manifest.paths[index]
        assert(distanceMetres(path[0], manifest.stops[train.stops[segment][0]]) < 1, 'Road path begins at the wrong platform')
        assert(distanceMetres(path.at(-1), manifest.stops[train.stops[segment + 1][0]]) < 1, 'Road path ends at the wrong platform')
      }
      if (trips.has(train.id)) assert.deepEqual(trips.get(train.id), train, 'A boundary trip differs across chunks')
      trips.set(train.id, train)
      routes.add(train.routeId)
    }
    chunks.push({ id: descriptor.id, trips: descriptor.tripCount, bytes: payload.length, gzipBytes })
  }
  assert.equal(expectedStart, 86400)
  assert.equal(trips.size, manifest.tripCount)
  assert(routes.size > 500 && trips.size > 10000, 'Unexpectedly sparse national PostBus coverage')
  const totalSegments = [...trips.values()].reduce((sum, train) => sum + train.pathSegments.length, 0)
  const matchedSegments = [...trips.values()].reduce((sum, train) => sum + train.pathSegments.filter(index => index !== null).length, 0)
  assert.equal(manifest.metadata.geometry.totalSegments, totalSegments)
  assert.equal(manifest.metadata.geometry.matchedSegments, matchedSegments)
  assert(matchedSegments / totalSegments >= 0.95, 'PostBus road coverage fell below 95%; refresh the geometry cache')
  // Every trip is present in every intersecting chunk, including the overlap at boundaries.
  for (const chunk of chunks) {
    const descriptor = manifest.chunks.find(candidate => candidate.id === chunk.id)
    const expected = [...trips.values()].filter(train => train.start <= descriptor.windowEnd && train.end >= descriptor.windowStart).length
    assert.equal(chunk.trips, expected, `Missing boundary trips in ${chunk.id}`)
  }
  const events = new Map()
  for (const train of trips.values()) {
    events.set(train.start, (events.get(train.start) ?? 0) + 1)
    events.set(train.end + 1, (events.get(train.end + 1) ?? 0) - 1)
  }
  let active = 0
  let peak = { time: 0, buses: 0 }
  for (const [time, delta] of [...events].sort((a, b) => a[0] - b[0])) {
    active += delta
    if (time <= 86400 && active > peak.buses) peak = { time, buses: active }
  }
  return {
    serviceDate: manifest.metadata.serviceDate, feedVersion: manifest.metadata.feedVersion,
    trips: trips.size, routes: routes.size, stops: manifest.stops.length,
    namedStops: new Set(manifest.stops.map(stop => stop[2])).size,
    edges: manifest.edges.length, paths: manifest.paths.length, vertices,
    matchedSegments, totalSegments, roadCoverage: matchedSegments / totalSegments, topologyGzipBytes, peak, chunks,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await auditPostbus(process.argv[2]), null, 2))
}
