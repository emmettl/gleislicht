import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { directedPatternKey } from './luzern-line-geometry.mjs'
import { auditZugBoatWater } from './zug-boat-geometry.mjs'
import { distanceMetres } from './water-paths.mjs'

const point = s => [Number(s.stop_lon), Number(s.stop_lat)]

// A reviewed relation supplies ordered node identities, never junctions inferred
// from line crossings. The platform-specific alias is checked separately below.
export function luzernFerryRelation(relation, elements, binding, stops) {
  assert.equal(relation.tags.type, 'route'); assert.equal(relation.tags.route, 'ferry')
  assert.equal(relation.tags.operator, binding.operator); assert.equal(relation.tags.ref, binding.line)
  const members = relation.members.filter(m => m.role === 'stop')
  assert.deepEqual(members.map(m => [m.type, m.ref]), binding.docks.map(d => ['node', d.nodeId]), 'Changed ordered ferry calls')
  for (const d of binding.docks) {
    const n = elements.get(`node/${d.nodeId}`), s = stops.get(d.stopId)
    assert(n?.tags?.amenity === 'ferry_terminal' && s, 'Missing ferry dock')
    assert.equal(s.didok, d.uic)
    if (d.platform) {
      assert.equal(n.tags.name, d.osmName); assert.equal(n.tags.local_ref, d.platform)
      assert.equal(s.platform_code, d.platform); assert.equal(s.stop_name, 'Luzern Bahnhofquai')
      assert.equal(d.uic, '8508492'); assert.equal(n.tags.uic_ref, undefined)
    } else assert.equal(n.tags.uic_ref, d.uic, 'Wrong ferry dock UIC')
    assert(distanceMetres(point(s), [n.lon, n.lat]) <= d.maximumIdentityMetres, 'Ferry identity attachment exceeds review')
  }
  const nodeIds = [], directedWays = []
  let cursor = binding.docks[0].nodeId
  for (const m of relation.members.filter(m => m.type === 'way')) {
    const w = elements.get(`way/${m.ref}`)
    assert(w?.tags?.route === 'ferry' && w.nodes.length >= 2)
    assert(['', 'forward', 'backward'].includes(m.role))
    const reverse = w.nodes[0] !== cursor
    assert.equal(reverse ? w.nodes.at(-1) : w.nodes[0], cursor, 'Disconnected ferry relation')
    assert(m.role !== (reverse ? 'forward' : 'backward'), 'Contradictory ferry way direction')
    const ids = reverse ? [...w.nodes].reverse() : w.nodes
    nodeIds.push(...(nodeIds.length ? ids.slice(1) : ids)); cursor = ids.at(-1)
    directedWays.push({ wayId: w.id, reverse })
  }
  assert.equal(cursor, binding.docks.at(-1).nodeId)
  let offset = -1
  for (const d of binding.docks) { offset = nodeIds.indexOf(d.nodeId, offset + 1); assert(offset >= 0, 'Ferry stops out of order') }
  return { id: relation.id, tags: relation.tags, timestamp: relation.timestamp, version: relation.version, nodeIds, directedWays }
}

export async function loadLuzernOsmBoats(config, inputs, lakes, officialPairs, raw) {
  const bytes = await readFile(config.policyPath); assert.equal(sha256(bytes), config.sha256)
  const policy = JSON.parse(bytes), files = new Map()
  for (const f of policy.files) {
    const b = await readFile(join(policy.sourceDirectory, f.file)); assert.equal(sha256(b), f.sha256)
    const contents = f.file.endsWith('.gz') ? gunzipSync(b) : b
    assert.equal(sha256(contents), f.rawSha256); files.set(f.file, contents)
  }
  assert(files.get('query.txt').toString().includes(`[date:"${policy.snapshot}"]`))
  const scope = JSON.parse(files.get('scope.json.gz'))
  assert.deepEqual(scope.routes, inputs.inventory)
  assert.deepEqual(scope.stops, inputs.stops)
  if (raw) {
    const ids = new Set(scope.routes.map(r => r.routeId))
    assert.deepEqual(scope.days, raw.snapshots.map(d => ({ date: d.date, trains: d.trains.filter(t => ids.has(t.routeId)) })), 'Changed full boat timetable')
  }
  const osm = JSON.parse(files.get('ferries.json.gz')); assert(!osm.remark, 'Incomplete Overpass response')
  const elements = new Map(osm.elements.map(e => [`${e.type}/${e.id}`, e])); assert.equal(elements.size, osm.elements.length)
  for (const e of osm.elements) {
    assert(e.timestamp <= policy.snapshot && e.version > 0)
    if (e.type === 'node') assert(Number.isFinite(e.lon) && Number.isFinite(e.lat))
    if (e.type === 'way') for (const id of e.nodes) assert(elements.has(`node/${id}`))
    if (e.type === 'relation') for (const m of e.members) assert(elements.has(`${m.type}/${m.ref}`))
  }
  const stops = new Map(inputs.stops.map(s => [s.stop_id, s])), b = policy.binding
  const route = scope.routes.find(r => r.routeId === b.routeId)
  assert(route && route.agencyId === b.agencyId && route.line === b.line && route.mode === 'boat' && route.routeType === 1000)
  const relation = luzernFerryRelation(elements.get(`relation/${b.relationId}`), elements, b, stops)
  const contexts = inputs.snapshots.flatMap(d => d.trains).filter(t => t.routeId === b.routeId && t.calls.some((c, i) => c.id === b.fromId && t.calls[i + 1]?.id === b.toId))
  assert(contexts.length > 0)
  for (const t of contexts) {
    assert.equal(sha256(directedPatternKey(t)).slice(0, 20), b.patternId, 'Unreviewed complete ferry pattern')
    assert.deepEqual(t.calls.map(c => c.id), b.docks.map(d => d.stopId))
  }
  const way = elements.get(`way/${b.wayId}`), dockIndex = b.docks.findIndex(d => d.stopId === b.fromId)
  assert.equal(b.docks[dockIndex + 1]?.stopId, b.toId)
  assert.equal(way.nodes[0], b.docks[dockIndex].nodeId); assert.equal(way.nodes.at(-1), b.docks[dockIndex + 1].nodeId)
  assert(relation.directedWays.some(w => w.wayId === b.wayId && !w.reverse))
  const docks = [point(stops.get(b.fromId)), point(stops.get(b.toId))]
  const vertices = way.nodes.map(id => elements.get(`node/${id}`)).map(n => [n.lon, n.lat])
  const attachmentMetres = [distanceMetres(docks[0], vertices[0]), distanceMetres(docks[1], vertices.at(-1))]
  assert(Math.max(...attachmentMetres) <= policy.maximumDockMetres)
  const path = [docks[0], ...vertices, docks[1]], geometrySha256 = sha256(JSON.stringify(path))
  assert.equal(geometrySha256, b.geometrySha256)
  const pathMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
  assert(pathMetres <= Math.max(1200, 3 * distanceMetres(...docks)))
  const water = auditZugBoatWater(path, lakes.get('lucerne').polygons, docks, 150)
  assert(!water.landCrossing, 'OSM ferry path crosses land')
  const intervals = []
  for (const day of scope.days) for (const t of day.trains.filter(t => t.routeId === b.routeId && t.calls.some((c, i) => c.id === b.fromId && t.calls[i + 1]?.id === b.toId))) {
    assert.equal(sha256(directedPatternKey(t)).slice(0, 20), b.patternId)
    const i = t.calls.findIndex(c => c.id === b.fromId), seconds = t.calls[i + 1].arrival - t.calls[i].departure
    const meanKmh = pathMetres * 3.6 / seconds
    assert(seconds > 0 && meanKmh <= policy.maximumMeanKmh)
    intervals.push({ date: day.date, tripId: t.id, sourceTripId: t.sourceTripId, sourceServiceDate: t.sourceServiceDate, seconds, meanKmh })
  }
  assert(intervals.length > 0)
  const key = JSON.stringify([b.routeId, b.fromId, b.toId]), previous = officialPairs.get(key)
  assert(!previous.path && previous.reason === 'boat-land-crossing')
  assert.deepEqual(previous.boatPatternIds, [b.patternId])
  const pair = { path, pathMetres, geometrySource: 'osm-boat-pattern-inference', maximumSnapMetres: Math.max(...attachmentMetres), attachmentMetres,
    sourceWayIds: [b.wayId], sourceRelationId: b.relationId, boatPatternIds: [b.patternId], lake: 'lucerne', shorelineFeatureIds: [93], water, primaryAssessment: previous }
  const inventory = osm.elements.filter(e => e.type !== 'node' || e.tags?.amenity === 'ferry_terminal').map(e => ({ type: e.type, id: e.id, version: e.version, timestamp: e.timestamp, tags: e.tags,
    status: e.type === 'way' && e.id === b.wayId ? 'admitted-reviewed-directed-pair' : e.type === 'relation' && e.id === b.relationId ? 'complete-pattern-identity-evidence' : e.type === 'node' && b.docks.some(d => d.nodeId === e.id) ? 'reviewed-dock-identity' : 'retained-only-no-geometry-admission' }))
  return { pairs: new Map([[key, pair]]), audit: { policy, inventory, relation, intervals, geometrySha256, pathMetres, attachmentMetres, water } }
}
