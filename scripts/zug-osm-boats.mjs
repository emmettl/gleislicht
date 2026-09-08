import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { auditZugBoatWater } from './zug-boat-geometry.mjs'
import { distanceMetres } from './water-paths.mjs'
import { parseShippingMembers } from './audit-luzern-shipping.mjs'
import { cablewayCoordinate } from './luzern-cableway-geometry.mjs'

const point = s => [Number(s.stop_lon), Number(s.stop_lat)]
const pairKey = (r, a, b) => JSON.stringify([r, a, b])
const bounds = points => points.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity])
const overlaps = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]

// Relation order and actual node identity are binding. Crossings of drawn ferry
// lines never create junctions, and a reversed relation is a different pattern.
export function zugFerryRelation(relation, elements) {
  const stopMembers = relation.members.filter(m => m.role === 'stop')
  assert(stopMembers.length >= 2 && stopMembers.every(m => m.type === 'node'), 'Invalid ferry relation stops')
  const stopNodes = stopMembers.map(m => elements.get(`node/${m.ref}`))
  assert(stopNodes.every(n => n?.tags?.amenity === 'ferry_terminal' && n.tags.uic_ref), 'Missing ferry dock identity')
  const wayMembers = relation.members.filter(m => m.type === 'way'), nodeIds = [], directedWays = []
  let cursor = stopNodes[0].id
  for (const member of wayMembers) {
    const way = elements.get(`way/${member.ref}`)
    assert(way?.tags?.route === 'ferry' && way.nodes.length >= 2, 'Missing ferry way')
    assert(['', 'forward', 'backward'].includes(member.role), 'Unreviewed ferry member role')
    const reverse = way.nodes[0] !== cursor
    assert((reverse ? way.nodes.at(-1) : way.nodes[0]) === cursor, 'Disconnected ordered ferry relation')
    assert(member.role !== (reverse ? 'forward' : 'backward'), 'Contradictory ferry member direction')
    const nodes = reverse ? [...way.nodes].reverse() : way.nodes
    nodeIds.push(...(nodeIds.length ? nodes.slice(1) : nodes)); cursor = nodes.at(-1)
    directedWays.push({ wayId: way.id, reverse })
  }
  assert.equal(cursor, stopNodes.at(-1).id, 'Wrong ferry relation destination')
  let offset = -1
  for (const stop of stopNodes) { offset = nodeIds.indexOf(stop.id, offset + 1); assert(offset >= 0, 'Ferry calls not in source-way order') }
  return { id: relation.id, tags: relation.tags, version: relation.version, timestamp: relation.timestamp,
    stopNodeIds: stopNodes.map(n => n.id), stopUics: stopNodes.map(n => n.tags.uic_ref), directedWays, nodeIds }
}

export async function loadZugOsmBoats(policy, boatPolicy, raw, timetableHash) {
  const bytes = await readFile(join(policy.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), policy.sourceSha256, 'Changed OSM boat catalogue')
  const source = JSON.parse(bytes), files = new Map()
  assert.equal(source.timetableSha256, timetableHash, 'Changed OSM boat timetable')
  assert.equal(source.boatSourceSha256, boatPolicy.sourceSha256, 'Changed OSM boat shoreline binding')
  for (const file of source.files) {
    const content = await readFile(join(policy.sourceDirectory, file.file))
    assert.equal(sha256(content), file.sha256, `Changed OSM boat evidence ${file.file}`); files.set(file.file, content)
  }
  assert(files.get('query.txt').toString().includes(`[date:"${source.snapshot}"]`), 'Missing historical ferry query')
  const scope = JSON.parse(files.get('scope.json')), routeIds = new Set(scope.routes.map(r => r.routeId))
  assert.deepEqual(scope.routes, raw.inventory.filter(r => r.mode === 'boat'), 'Changed complete boat route scope')
  assert.deepEqual(scope.days, raw.snapshots.map(d => ({ date: d.date, trains: d.trains.filter(t => routeIds.has(t.routeId)) })), 'Changed full boat calls or times')
  const stopIds = new Set(scope.days.flatMap(d => d.trains.flatMap(t => t.calls.map(c => c.id))))
  assert.deepEqual(scope.stops, raw.stops.filter(s => stopIds.has(s.stop_id)), 'Changed boat dock coordinates')
  const stops = new Map(scope.stops.map(s => [s.stop_id, s]))
  const osm = JSON.parse(gunzipSync(files.get('ferries.json.gz')))
  assert(!osm.remark, 'Incomplete Overpass ferry response')
  const elements = new Map(osm.elements.map(e => [`${e.type}/${e.id}`, e]))
  assert.equal(elements.size, osm.elements.length, 'Duplicate ferry element')
  for (const e of osm.elements) {
    assert(e.timestamp <= source.snapshot && e.version > 0, 'Ferry element newer than historical snapshot')
    if (e.type === 'node') assert(Number.isFinite(e.lon) && Number.isFinite(e.lat))
    if (e.type === 'way') for (const id of e.nodes) assert(elements.has(`node/${id}`), 'Missing original ferry node')
    if (e.type === 'relation') for (const m of e.members) assert(elements.has(`${m.type}/${m.ref}`), 'Missing original ferry member')
  }
  const relations = [], patterns = new Map()
  for (const binding of source.relations) {
    const route = scope.routes.find(r => r.routeId === binding.routeId)
    assert(route && route.agencyId === binding.agencyId && route.line === binding.line && route.routeType === 1000)
    const matching = osm.elements.filter(e => e.type === 'relation' && e.tags?.['gtfs:route_id'] === binding.routeId)
    assert.deepEqual(matching.map(e => e.id).sort((a, b) => a - b), binding.relationIds, 'Changed ferry relation census')
    for (const r of matching) {
      assert(r.tags.type === 'route' && r.tags.route === 'ferry' && r.tags.operator === binding.operator && r.tags.ref === binding.line)
      relations.push({ ...zugFerryRelation(r, elements), routeId: route.routeId })
    }
    for (const day of scope.days) for (const train of day.trains.filter(t => t.routeId === route.routeId)) {
      const uics = train.calls.map(c => stops.get(c.id).didok)
      const matches = relations.filter(r => r.routeId === train.routeId && JSON.stringify(r.stopUics) === JSON.stringify(uics))
      assert.equal(matches.length, 1, 'Full directed boat pattern lacks unique relation')
      const key = directedPatternKey(train), record = patterns.get(key) ?? { key, relationId: matches[0].id, routeId: train.routeId, stopIds: train.calls.map(c => c.id), occurrences: [] }
      record.occurrences.push({ date: day.date, tripId: train.id, sourceTripId: train.sourceTripId, sourceServiceDate: train.sourceServiceDate }); patterns.set(key, record)
    }
  }
  const lakes = JSON.parse(await readFile(join(boatPolicy.sourceDirectory, 'lakes.json')))
  const lake = boatPolicy.lakes.find(l => l.id === 'zugersee'), polygons = lake.shorelineFeatureIds.flatMap(id => lakes.results.find(f => String(f.id) === String(id)).geometry.coordinates)
  const pairs = source.pairs.map(binding => {
    const relation = relations.find(r => r.id === binding.relationId), way = elements.get(`way/${binding.wayId}`)
    assert.equal(relation.routeId, binding.routeId)
    const index = relation.stopNodeIds.indexOf(binding.fromNode)
    assert(index >= 0 && relation.stopNodeIds[index + 1] === binding.toNode, 'Supplement is not an adjacent relation call')
    assert(relation.directedWays.some(w => w.wayId === binding.wayId && !w.reverse), 'Unreviewed direct ferry way orientation')
    assert.equal(way.nodes[0], binding.fromNode); assert.equal(way.nodes.at(-1), binding.toNode)
    assert.equal(way.tags.operator, 'SGZ')
    const from = stops.get(binding.fromId), to = stops.get(binding.toId)
    for (const [s, id] of [[from, binding.fromNode], [to, binding.toNode]]) assert.equal(s.didok, elements.get(`node/${id}`).tags.uic_ref)
    const docks = [point(from), point(to)], vertices = way.nodes.map(id => elements.get(`node/${id}`)).map(n => [n.lon, n.lat])
    const attachmentMetres = [distanceMetres(docks[0], vertices[0]), distanceMetres(docks[1], vertices.at(-1))]
    assert(Math.max(...attachmentMetres) <= source.limits.maximumDockMetres, 'OSM ferry dock attachment exceeds limit')
    const path = [docks[0], ...vertices, docks[1]], pathMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
    assert(pathMetres <= Math.max(boatPolicy.limits.detourFloorMetres, boatPolicy.limits.detourRatio * distanceMetres(...docks)), 'OSM ferry detour exceeds limit')
    const water = auditZugBoatWater(path, polygons, docks, boatPolicy.dockZoneMetres)
    assert(!water.landCrossing, 'OSM ferry crosses land away from endpoint docks')
    const contexts = [...patterns.values()].filter(p => p.relationId === binding.relationId)
    assert.equal(contexts.length, 1, 'Unreviewed ferry pattern variants')
    const intervals = []
    for (const day of scope.days) for (const train of day.trains.filter(t => directedPatternKey(t) === contexts[0].key)) {
      const callIndex = train.calls.findIndex((c, i) => c.id === binding.fromId && train.calls[i + 1]?.id === binding.toId)
      assert(callIndex >= 0)
      const a = train.calls[callIndex], b = train.calls[callIndex + 1], seconds = b.arrival - a.departure, meanKmh = pathMetres * 3.6 / seconds
      assert(seconds > 0 && meanKmh <= source.limits.maximumMeanKmh, 'OSM ferry interval needs review')
      intervals.push({ date: day.date, tripId: train.id, sourceTripId: train.sourceTripId, sourceServiceDate: train.sourceServiceDate, fromSequence: a.sequence, toSequence: b.sequence, seconds, meanKmh })
    }
    return { ...binding, from: from.stop_name, to: to.stop_name, patternKey: contexts[0].key, path, pathMetres,
      attachmentMetres, maximumSnapMetres: Math.max(...attachmentMetres), geometrySha256: sha256(JSON.stringify(path)), water, intervals }
  })
  const name = 'swissTLM3D_TLM_SCHIFFFAHRT', features = parseShippingMembers(...['dbf', 'shp', 'shx'].map(e => files.get(`${name}.${e}`)))
  const lakeBounds = boatPolicy.lakes.map(l => ({ lake: l.id, bounds: bounds(l.shorelineFeatureIds.flatMap(id => lakes.results.find(f => String(f.id) === String(id)).geometry.coordinates.flat(2))) }))
  const topography = features.map(f => {
    const box = bounds(f.paths.flat().map(p => cablewayCoordinate(p[0], p[1])))
    return { id: f.id, attributes: f.attributes, boundsWgs84: box, overlappingLakes: lakeBounds.filter(l => overlaps(l.bounds, box)).map(l => l.lake) }
  })
  assert.equal(topography.length, 27); assert(topography.every(f => f.overlappingLakes.length === 0), 'New national shipping overlap needs review')
  const selectedWays = new Set(pairs.map(p => p.wayId))
  const inventory = osm.elements.filter(e => e.type !== 'node' || e.tags?.amenity === 'ferry_terminal').map(e => ({ type: e.type, id: e.id, version: e.version, timestamp: e.timestamp, tags: e.tags,
    use: e.type === 'node' ? scope.stops.some(s => s.didok === e.tags.uic_ref) ? 'called-dock-identity-evidence' : 'source-only-no-frozen-timetable-dock-binding' : e.type === 'way' && selectedWays.has(e.id) ? 'admitted-only-for-reviewed-directed-pair' : e.type === 'relation' && relations.some(r => r.id === e.id) ? 'full-directed-pattern-identity-evidence' : 'retained-source-only-no-geometry-substitution' }))
  return { source, inventory, relations, patterns: [...patterns.values()], pairs, topography,
    pairKeys: new Set(pairs.map(p => pairKey(p.routeId, p.fromId, p.toId))),
    matchPair(original, route, train, from, to) {
      if (original.path || original.reason !== 'boat-land-crossing' || !train) return original
      const p = pairs.find(p => p.routeId === route.routeId && p.fromId === from.stop_id && p.toId === to.stop_id && p.patternKey === directedPatternKey(train))
      const binding = source.relations.find(r => r.routeId === route.routeId)
      if (!p || route.mode !== 'boat' || route.agencyId !== binding.agencyId || route.line !== binding.line || route.routeType !== 1000) return original
      assert.deepEqual(from, stops.get(from.stop_id)); assert.deepEqual(to, stops.get(to.stop_id))
      return { path: p.path, pathMetres: p.pathMetres, maximumSnapMetres: p.maximumSnapMetres, attachmentMetres: p.attachmentMetres,
        geometrySource: 'osm-boat-pattern-inference', sourceWayIds: [p.wayId], sourceRelationId: p.relationId,
        reviewedPatternId: sha256(p.patternKey).slice(0, 20), lake: lake.id, shorelineFeatureIds: lake.shorelineFeatureIds, water: p.water, primaryFailure: original }
    } }
}
