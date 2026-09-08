import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

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
  assert(topologyGzipBytes < 1024 * 1024, 'PostBus topology exceeds its 1 MiB compressed budget')
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
      for (const [index, arrival, departure] of train.stops) {
        assert(manifest.stops[index], `Missing stop ${index}`)
        assert(Number.isFinite(arrival) && departure >= arrival)
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
    edges: manifest.edges.length, topologyGzipBytes, peak, chunks,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await auditPostbus(process.argv[2]), null, 2))
}
