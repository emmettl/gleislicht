import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { auditZugBoatWater } from './zug-boat-geometry.mjs'
import { inWater } from './water-paths.mjs'
import { reconcileThurgauGeometry } from './thurgau-regional-roads.mjs'
export const THURGAU_SHIPPING_SOURCE = 'official-osm-shipping-inference'
const sha = b => createHash('sha256').update(b).digest('hex')
const identity = p => JSON.stringify([p.routeId, p.agencyId, p.line, p.directionId, p.calls])
const trainIdentity = (t, raw) => identity({ routeId: t.routeId, agencyId: t.agencyId, line: t.route, directionId: t.directionId, calls: t.stops.map(([i]) => raw.stops[i]) })
function elementsOf(response, snapshot) {
  assert(!response.remark, 'Incomplete shipping response')
  const elements = new Map()
  for (const e of response.elements) {
    assert(e.timestamp <= snapshot, 'Unreviewed source date')
    const k = `${e.type}:${e.id}`; if (elements.has(k)) assert.deepEqual(e, elements.get(k), 'Conflicting source duplicate')
    elements.set(k, e)
  }
  return elements
}
const coordinates = (way, elements) => way.nodes.map(id => { const n = elements.get(`node:${id}`); assert(n && Number.isFinite(n.lon) && Number.isFinite(n.lat), 'Missing source node'); return [n.lon, n.lat] })
export function thurgauRhinePolygon(response, policy) {
  const elements = elementsOf(response, policy.snapshot), relation = elements.get('relation:1679977')
  assert(relation, 'Missing Rhine water relation')
  assert.deepEqual(relation.members, [{ type: 'way', ref: 122858269, role: 'outer' }, { type: 'way', ref: 937838731, role: 'inner' }], 'Changed river boundary or island membership')
  assert.equal(relation.tags.natural, 'water'); assert.equal(relation.tags.water, 'river')
  const ways = relation.members.map(m => elements.get(`way:${m.ref}`)); assert(ways.every(Boolean), 'Missing river ring')
  const nodes = [...new Set(ways.flatMap(w => w.nodes))].map(id => elements.get(`node:${id}`))
  assert.equal(sha(JSON.stringify([relation, ...ways, ...nodes])), policy.riverElementsSha256, 'Changed river geometry')
  const polygon = ways.map(w => { assert.equal(w.nodes[0], w.nodes.at(-1), 'Open river ring'); return coordinates(w, elements) })
  assert(polygon[1].every(p => inWater(p, [polygon[0]])), 'River island is outside its outer boundary')
  return polygon
}

export function thurgauShippingGeometry(osm, water, lakePolygons, previous, policy) {
  const elements = elementsOf(osm, policy.snapshot), riverPolygon = thurgauRhinePolygon(water, policy)
  const candidates = policy.pairs.map(pair => {
    const way = elements.get(`way:${pair.wayId}`); assert(way, 'Missing selected shipping way')
    const path = coordinates(way, elements)
    assert.equal(sha(JSON.stringify([way, ...way.nodes.map(id => elements.get(`node:${id}`))])), pair.selectedElementsSha256, 'Changed selected shipping geometry')
    assert.equal(way.version, pair.version); assert.equal(way.timestamp, pair.timestamp)
    assert.equal(way.tags.route, 'ferry'); assert.equal(way.tags.foot, 'yes')
    assert(!way.tags.oneway || way.tags.oneway === 'no', 'Unreviewed shipping direction')
    assert(!way.tags.access || way.tags.access === 'yes', 'Unreviewed shipping access')
    return { pair, graph: lineGraph([{ id: String(way.id), geometry: { type: 'LineString', coordinates: path } }]) }
  })
  const replacements = new Map()
  const patterns = policy.patterns.map(p => {
    const old = previous.patterns.find(o => identity(o) === identity(p))
    assert(old && !old.admitted && old.segments.length === p.calls.length - 1, 'Changed original shipping pattern')
    assert.deepEqual(old.days, p.days)
    const segments = old.segments.map((original, i) => {
      if (original.path) return { ...original, geometrySource: 'swisstopo-boat-inference' }
      const a = p.calls[i], b = p.calls[i + 1], key = JSON.stringify([a, b])
      if (replacements.has(key)) return replacements.get(key)
      const candidate = candidates.find(({ pair }) => [JSON.stringify([pair.from, pair.to]), JSON.stringify([pair.to, pair.from])].includes(key))
      if (!candidate) return { reason: 'no-reviewed-shipping-pair', previousReason: original.reason }
      const { pair, graph } = candidate, result = matchBaselSegment(graph, a, b, pair.limits)
      const { path, ...evidence } = result
      const base = { ...evidence, geometrySource: 'osm-shipping-way', wayId: pair.wayId, waterSource: pair.water }
      let assessment = base
      if (path) {
        const audit = auditZugBoatWater(path, pair.water === 'rhine-osm' ? [riverPolygon] : lakePolygons, [a, b], pair.dockZoneMetres)
        assessment = audit.landCrossing ? { ...base, water: audit, reason: 'shipping-outside-reviewed-water', rejectedGeometrySha256: sha(JSON.stringify(path)) } : { ...base, water: audit, path }
      }
      replacements.set(key, assessment); return assessment
    })
    return { ...p, key: identity(p), segments, admitted: segments.every(s => s.path) }
  })
  const wayIds = new Set(policy.pairs.map(p => p.wayId))
  const selectedNodes = new Set([...wayIds].flatMap(id => elements.get(`way:${id}`).nodes))
  const inventory = { shipping: [...elements.values()].filter(e => e.type !== 'node').map(e => ({ ...e, sha256: sha(JSON.stringify(e)), status: e.type === 'way' && wayIds.has(e.id) ? 'selected-exact-dock-pair-way' : 'excluded-outside-reviewed-dock-pairs' })),
    shippingNodeCount: [...elements.values()].filter(e => e.type === 'node').length, selectedShippingNodeCount: selectedNodes.size,
    water: [...elementsOf(water, policy.snapshot).values()].filter(e => e.type !== 'node').map(e => ({ ...e, sha256: sha(JSON.stringify(e)), status: e.type === 'relation' && e.id === 1679977 || e.type === 'way' && [122858269, 937838731].includes(e.id) ? 'selected-rhine-water-or-island' : 'excluded-outside-reviewed-rhine-polygon' })),
    nodeEvidence: 'Every original node with coordinates, edit timestamp and version remains in the hash-pinned responses. Selected way-node membership and selected element hashes are pinned in the policy.' }
  return { patterns, riverPolygon, inventory }
}

export async function loadThurgauShipping(timetable) {
  const dir = 'data/thurgau-shipping-sources', policyBytes = await readFile('data/thurgau-shipping-policy.json'), policy = JSON.parse(policyBytes)
  const sourceBytes = await readFile(`${dir}/sources.json`), source = JSON.parse(sourceBytes)
  assert.equal(sha(sourceBytes), policy.sourceSha256)
  for (const f of source.files) assert.equal(sha(await readFile(`${dir}/${f.file}`)), f.sha256, `Changed shipping source ${f.file}`)
  for (const file of ['query.txt', 'water-query.txt']) assert((await readFile(`${dir}/${file}`, 'utf8')).includes(`[date:"${policy.snapshot}"]`))
  const timetableBytes = await readFile('data/thurgau-audit/timetable-cache.json.gz')
  assert.equal(sha(timetableBytes), policy.timetableSha256); assert.deepEqual(timetable, JSON.parse(gunzipSync(timetableBytes)))
  assert.deepEqual(policy.dates, timetable.snapshots.map(d => d.metadata.serviceDate))
  assert.deepEqual(policy.routes, timetable.routes.filter(r => policy.routes.some(p => p.routeId === r.id)).map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, type: r.type })))
  const previousBytes = await readFile('data/thurgau-boat-sources/path-review.json'), previous = JSON.parse(previousBytes)
  assert.equal(sha(previousBytes), policy.previousBoatReviewSha256)
  assert.equal(sha(await readFile('data/thurgau-boat-policy.json')), policy.previousBoatPolicySha256)
  assert.deepEqual(policy.patterns, previous.patterns.filter(p => !p.admitted && policy.routes.some(r => r.routeId === p.routeId)).map(p => ({ routeId: p.routeId, agencyId: p.agencyId, line: p.line, directionId: p.directionId, calls: p.calls, days: p.days })))
  const counts = new Map(policy.patterns.map(p => [identity(p), {}]))
  for (const day of timetable.snapshots) for (const t of day.trains) {
    const count = counts.get(trainIdentity(t, day)); if (count) count[day.metadata.serviceDate] = (count[day.metadata.serviceDate] ?? 0) + 1
  }
  for (const p of policy.patterns) assert.deepEqual(counts.get(identity(p)), p.days)
  const lakeBytes = await readFile(source.shoreline.source); assert.equal(sha(lakeBytes), policy.shorelineSha256)
  const lakes = JSON.parse(gunzipSync(lakeBytes)).results.filter(f => f.id === 124)
  assert.equal(lakes.length, 1); assert.equal(lakes[0].geometry.type, 'MultiPolygon'); assert.equal(lakes[0].layerBodId, 'ch.bafu.vec25-seen')
  const osm = JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`))), water = JSON.parse(gunzipSync(await readFile(`${dir}/water.json.gz`)))
  assert.equal(elementsOf(osm, policy.snapshot).size, source.acquisition.shippingUniqueElements); assert.equal(elementsOf(water, policy.snapshot).size, source.acquisition.waterUniqueElements)
  return { ...thurgauShippingGeometry(osm, water, lakes[0].geometry.coordinates, previous, policy), policy, source, policySha256: sha(policyBytes) }
}

export function applyThurgauShipping(raw, result, shipping) {
  if (!shipping) return result
  const patterns = new Map(result.patterns.map(p => [p.id, p])), seen = new Set(), indexes = new Map(result.paths.map((p, i) => [JSON.stringify(p), i]))
  for (const train of result.trains) {
    if (train.reservationRequired || train.admission === 'admitted' || !shipping.policy.routes.some(r => r.routeId === train.routeId)) continue
    const match = shipping.patterns.find(p => p.key === trainIdentity(train, raw)); assert(match, 'Unreviewed full shipping pattern or coordinates')
    const pattern = patterns.get(train.patternId)
    if (!seen.has(pattern.id)) {
      seen.add(pattern.id); assert.equal(pattern.boatSupplement?.status, 'rejected-incomplete-pattern')
      const complete = match.segments.every(s => s.path)
      pattern.shippingSupplement = { status: complete ? 'admitted' : 'rejected-incomplete-pattern', segments: match.segments.map(({ path, ...e }) => ({ ...e, geometrySha256: path ? sha(JSON.stringify(path)) : null })) }
      if (complete) {
        pattern.pathSegments = match.segments.map(({ path }) => { const key = JSON.stringify(path); if (!indexes.has(key)) { indexes.set(key, result.paths.length); result.paths.push(path) } return indexes.get(key) })
        pattern.matchedSegments = pattern.segmentCount; pattern.geometrySource = THURGAU_SHIPPING_SOURCE
      }
    }
    if (pattern.geometrySource === THURGAU_SHIPPING_SOURCE) { train.pathSegments = pattern.pathSegments; train.geometrySource = pattern.geometrySource; train.admission = 'admitted' }
  }
  return reconcileThurgauGeometry(raw, result)
}
