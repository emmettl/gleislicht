import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { auditZugBoatWater } from './zug-boat-geometry.mjs'
import { reconcileThurgauGeometry } from './thurgau-regional-roads.mjs'
const sha = b => createHash('sha256').update(b).digest('hex')
export const THURGAU_FERRY_SOURCE = 'osm-romanshorn-ferry-inference'
const identity = (train, raw) => JSON.stringify([train.routeId, train.agencyId, train.route, train.directionId, train.stops.map(([i]) => raw.stops[i])])
const patternIdentity = p => JSON.stringify([p.routeId, p.agencyId, p.line, p.directionId, p.calls])

export function thurgauFerryGeometry(osm, polygons, policy) {
  assert(!osm.remark, 'Incomplete ferry source response')
  const elements = new Map()
  for (const e of osm.elements) {
    assert(e.timestamp <= policy.snapshot, 'Ferry source newer than reviewed date')
    const key = `${e.type}:${e.id}`
    if (elements.has(key)) assert.deepEqual(e, elements.get(key), 'Conflicting source duplicate')
    elements.set(key, e)
  }
  const way = elements.get(`way:${policy.wayId}`); assert(way, 'Missing reviewed ferry way')
  assert.equal(way.version, policy.wayVersion); assert.equal(way.timestamp, policy.wayTimestamp)
  const nodes = way.nodes.map(id => elements.get(`node:${id}`))
  assert(nodes.every(n => n && Number.isFinite(n.lon) && Number.isFinite(n.lat)), 'Missing ferry source node')
  assert.equal(sha(JSON.stringify([way, ...nodes])), policy.selectedElementsSha256, 'Changed selected ferry geometry')
  assert.equal(way.tags.route, 'ferry'); assert.equal(way.tags.foot, 'yes'); assert.equal(way.tags.motor_vehicle, 'yes')
  assert(!way.tags.oneway || way.tags.oneway === 'no', 'Unreviewed one-way ferry')
  assert(!way.tags.access || way.tags.access === 'yes', 'Unreviewed ferry access')
  const graph = lineGraph([{ id: String(way.id), geometry: { type: 'LineString', coordinates: nodes.map(n => [n.lon, n.lat]) } }])
  const paths = policy.patterns.map(p => {
    assert.equal(p.calls.length, 2, 'Unreviewed intermediate ferry call')
    const result = matchBaselSegment(graph, ...p.calls, policy.limits)
    if (!result.path) return { key: patternIdentity(p), ...result }
    const { path, ...evidence } = result, water = auditZugBoatWater(path, polygons, p.calls, policy.dockZoneMetres)
    if (water.landCrossing) return { key: patternIdentity(p), ...evidence, water, reason: 'ferry-outside-reviewed-water', rejectedGeometrySha256: sha(JSON.stringify(path)) }
    return { key: patternIdentity(p), ...result, water, geometrySha256: sha(JSON.stringify(path)), wayId: way.id,
      direction: p.calls[0][4] === 'ch:1:sloid:6346' ? 'forward' : 'backward' }
  })
  const selectedNodes = new Set(way.nodes)
  const inventory = [...elements.values()].map(e => ({ type: e.type, id: e.id, version: e.version, timestamp: e.timestamp, sha256: sha(JSON.stringify(e)),
    ...(e.tags ? { tags: e.tags } : {}), status: e.type === 'way' && e.id === way.id ? 'selected-ferry-way' : e.type === 'node' && selectedNodes.has(e.id) ? 'selected-ferry-vertex' : 'excluded-unreviewed-for-exact-ferry-scope' }))
  return { paths, inventory }
}

export async function loadThurgauFerry(timetable) {
  const dir = 'data/thurgau-ferry-sources', policyBytes = await readFile('data/thurgau-ferry-policy.json'), policy = JSON.parse(policyBytes)
  const sourceBytes = await readFile(`${dir}/sources.json`), source = JSON.parse(sourceBytes)
  assert.equal(sha(sourceBytes), policy.sourceSha256)
  for (const f of source.files) assert.equal(sha(await readFile(`${dir}/${f.file}`)), f.sha256, `Changed ferry source ${f.file}`)
  assert((await readFile(`${dir}/query.txt`, 'utf8')).includes(`[date:"${policy.snapshot}"]`))
  const timetableBytes = await readFile('data/thurgau-audit/timetable-cache.json.gz')
  assert.equal(sha(timetableBytes), policy.timetableSha256); assert.deepEqual(timetable, JSON.parse(gunzipSync(timetableBytes)))
  assert.deepEqual(policy.dates, timetable.snapshots.map(d => d.metadata.serviceDate))
  assert.deepEqual(policy.routes, timetable.routes.filter(r => policy.routes.some(p => p.routeId === r.id)).map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, type: r.type })))
  assert.equal(sha(await readFile('data/thurgau-boat-policy.json')), policy.previousBoatPolicySha256)
  const previousBytes = await readFile('data/thurgau-boat-sources/path-review.json'), previous = JSON.parse(previousBytes)
  assert.equal(sha(previousBytes), policy.previousBoatReviewSha256)
  const counts = new Map(policy.patterns.map(p => [patternIdentity(p), {}]))
  for (const day of timetable.snapshots) for (const t of day.trains.filter(t => policy.routes.some(r => r.routeId === t.routeId))) {
    const key = identity(t, day); assert(counts.has(key), 'Unreviewed ferry dock, operator or direction')
    const days = counts.get(key); days[day.metadata.serviceDate] = (days[day.metadata.serviceDate] ?? 0) + 1
  }
  for (const p of policy.patterns) {
    assert.deepEqual(counts.get(patternIdentity(p)), p.days)
    const before = previous.patterns.find(b => patternIdentity(b) === patternIdentity(p))
    assert(before && !before.admitted && before.segments.length === 1 && before.segments[0].reason === 'boat-outside-reviewed-water', 'Changed original ferry rejection')
  }
  const lakeBytes = await readFile(source.shoreline.source); assert.equal(sha(lakeBytes), policy.shorelineSha256)
  const lakes = JSON.parse(gunzipSync(lakeBytes)).results.filter(f => f.id === policy.shorelineFeatureId)
  assert.equal(lakes.length, 1); assert.equal(lakes[0].layerBodId, 'ch.bafu.vec25-seen'); assert.equal(lakes[0].geometry.type, 'MultiPolygon')
  const osm = JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`))), polygons = lakes[0].geometry.coordinates
  const geometry = thurgauFerryGeometry(osm, polygons, policy)
  assert.equal(geometry.inventory.length, source.elementCount)
  return { ...geometry, policy, source, policySha256: sha(policyBytes), polygons }
}

export function applyThurgauFerry(raw, result, ferry) {
  if (!ferry) return result
  const patterns = new Map(result.patterns.map(p => [p.id, p])), seen = new Set()
  const indexes = new Map(result.paths.map((p, i) => [JSON.stringify(p), i]))
  for (const train of result.trains) {
    if (train.reservationRequired || train.admission === 'admitted' || !ferry.policy.routes.some(r => r.routeId === train.routeId)) continue
    const key = identity(train, raw), match = ferry.paths.find(p => p.key === key)
    assert(match, 'Unreviewed ferry dock, operator or direction')
    const pattern = patterns.get(train.patternId)
    if (!seen.has(pattern.id)) {
      seen.add(pattern.id)
      assert.equal(pattern.boatSupplement?.status, 'rejected-incomplete-pattern', 'Original boat adapter must run before ferry supplement')
      const { path, key: _key, ...evidence } = match
      pattern.ferrySupplement = { ...evidence, status: path ? 'admitted' : 'rejected-incomplete-pattern' }
      if (path) {
        const signature = JSON.stringify(path)
        if (!indexes.has(signature)) { indexes.set(signature, result.paths.length); result.paths.push(path) }
        pattern.pathSegments = [indexes.get(signature)]; pattern.matchedSegments = pattern.segmentCount
        pattern.geometrySource = THURGAU_FERRY_SOURCE
      }
    }
    if (pattern.geometrySource === THURGAU_FERRY_SOURCE) {
      train.pathSegments = pattern.pathSegments; train.geometrySource = THURGAU_FERRY_SOURCE; train.admission = 'admitted'
    }
  }
  return reconcileThurgauGeometry(raw, result)
}
