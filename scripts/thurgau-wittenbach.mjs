import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { distanceMetres } from './water-paths.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { reconcileThurgauGeometry } from './thurgau-regional-roads.mjs'
const sha = b => createHash('sha256').update(b).digest('hex')

function project(p, line) {
  let best; const c = Math.cos(p[1] * Math.PI / 180)
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], dx = (b[0] - a[0]) * c, dy = b[1] - a[1], norm = dx * dx + dy * dy
    if (!norm) continue
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * c * dx + (p[1] - a[1]) * dy) / norm))
    const point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], gap = distanceMetres(p, point)
    if (!best || gap < best.gap) best = { point, gap, i, t, side: dx * (p[1] - point[1]) - dy * (p[0] - point[0]) * c }
  }
  return best
}

export function wittenbachTurnaround(osm, restrictions, policy) {
  const elements = new Map()
  assert(!osm.remark && !restrictions.remark, 'Incomplete Overpass response')
  for (const e of osm.elements) {
    assert(e.timestamp <= policy.snapshot, 'Source newer than requested snapshot')
    const key = `${e.type}:${e.id}`
    if (elements.has(key)) assert.deepEqual(e, elements.get(key))
    elements.set(key, e)
  }
  for (const pin of policy.features) {
    const e = elements.get(`${pin.type}:${pin.id}`)
    assert(e, 'Missing reviewed source element'); assert.equal(sha(JSON.stringify(e)), pin.sha256, 'Changed reviewed source element')
    assert.equal(e.version, pin.version); assert.equal(e.timestamp, pin.timestamp)
  }
  const approach = elements.get(`way:${policy.wayIds[0]}`), roundabout = elements.get(`way:${policy.wayIds[1]}`)
  for (const way of [approach, roundabout]) {
    assert.equal(way.tags.highway, 'secondary')
    for (const key of ['access', 'vehicle', 'motor_vehicle', 'bus']) assert(!way.tags[key] || ['yes', 'designated', 'permissive'].includes(way.tags[key]), 'Unreviewed vehicle restriction')
  }
  assert(!approach.tags.oneway || approach.tags.oneway === 'no', 'Approach is no longer bidirectional')
  assert.equal(roundabout.tags.junction, 'roundabout'); assert(!roundabout.tags.oneway || roundabout.tags.oneway === 'yes')
  assert.equal(approach.nodes.at(-1), policy.sharedNode)
  assert.equal(roundabout.nodes[0], policy.sharedNode); assert.equal(roundabout.nodes.at(-1), policy.sharedNode)
  const coordinates = ids => ids.map(id => {
    const n = elements.get(`node:${id}`); assert(n && Number.isFinite(n.lon) && Number.isFinite(n.lat))
    return [n.lon, n.lat]
  })
  const road = coordinates(approach.nodes), circle = coordinates(roundabout.nodes)
  assert(circle.slice(1).reduce((s, p, i) => s + circle[i][0] * p[1] - p[0] * circle[i][1], 0) > 0, 'Reversed roundabout traffic direction')
  // The selected source relations explicitly contain the approach and circle,
  // but their stop lists do not establish the entire two-platform movement.
  for (const [id, routeId] of [[17128888, '96-220-5-j26-1'], [16238506, '96-220-6-j26-1']]) {
    const r = elements.get(`relation:${id}`)
    assert.equal(r.tags['gtfs:route_id'], routeId); assert.equal(r.tags.operator, 'PAG')
    for (const way of policy.wayIds) assert(r.members.some(m => m.type === 'way' && m.ref === way))
  }
  assert.equal(restrictions.elements.length, 1, 'Changed restriction inventory requires review')
  const restriction = restrictions.elements[0]
  assert.equal(restriction.id, 14866387); assert.equal(restriction.version, 2); assert.equal(restriction.tags.restriction, 'only_right_turn')
  assert.deepEqual(restriction.members, [{ type: 'way', ref: 697567549, role: 'from' }, { type: 'node', ref: 7826558259, role: 'via' }, { type: 'way', ref: 1111858974, role: 'to' }])
  const a = project(policy.from, road), b = project(policy.to, road)
  assert(a.gap <= policy.limits.attachmentMetres && b.gap <= policy.limits.attachmentMetres, 'Changed platform attachment')
  assert(a.side < 0 && b.side > 0, 'Platforms no longer lie on opposite right-hand approaches')
  assert(a.i > 0 && b.i > 0, 'Turnaround reaches the separately restricted side-road junction')
  const sourcePath = [a.point, ...road.slice(a.i + 1), ...circle.slice(1), ...road.slice(b.i + 1, -1).reverse(), b.point]
  const roadMetres = sourcePath.slice(1).reduce((n, p, i) => n + distanceMetres(sourcePath[i], p), 0)
  assert(roadMetres >= policy.limits.minimumRoadMetres && roadMetres <= policy.limits.maximumRoadMetres, 'Unreviewed turnaround length')
  const path = [policy.from.slice(0, 2), ...sourcePath, policy.to.slice(0, 2)]
    .map(p => p.map(n => Number(n.toFixed(7)))).filter((p, i, ps) => !i || JSON.stringify(p) !== JSON.stringify(ps[i - 1]))
  return { path, sourcePath, roadMetres, attachmentsMetres: [a.gap, b.gap], geometrySource: 'osm-wittenbach-turnaround-inference',
    wayTraversal: [{ id: approach.id, direction: 'forward', fromSegment: a.i }, { id: roundabout.id, direction: 'forward', fullRing: true }, { id: approach.id, direction: 'backward', toSegment: b.i }],
    restriction: { id: restriction.id, decision: 'not-traversed; distinct incoming side road and outside selected subpath' },
    limitation: 'Explicit mapped-road turnaround inference; route relations omit the full two-platform movement. No operator or lane certification.' }
}

export async function loadThurgauWittenbach(timetable, regionalRoads) {
  const dir = 'data/thurgau-wittenbach-sources', policyBytes = await readFile('data/thurgau-wittenbach-policy.json'), policy = JSON.parse(policyBytes)
  const sourceBytes = await readFile(`${dir}/sources.json`), source = JSON.parse(sourceBytes)
  assert.equal(sha(sourceBytes), policy.sourceSha256)
  const timetableBytes = await readFile('data/thurgau-audit/timetable-cache.json.gz'), roadBytes = await readFile('data/thurgau-regional-roads/cache.json.gz')
  assert.equal(sha(timetableBytes), policy.timetableSha256); assert.equal(sha(roadBytes), policy.regionalRoadsSha256)
  assert.deepEqual(timetable, JSON.parse(gunzipSync(timetableBytes))); assert.deepEqual(regionalRoads, JSON.parse(gunzipSync(roadBytes)))
  const oldBytes = await readFile('data/thurgau-audit/wittenbach-review.json'), old = JSON.parse(oldBytes)
  assert.equal(sha(oldBytes), policy.previousReviewSha256)
  for (const f of source.files) assert.equal(sha(await readFile(`${dir}/${f.file}`)), f.sha256)
  for (const file of ['query.txt', 'restrictions-query.txt']) assert((await readFile(`${dir}/${file}`, 'utf8')).includes(`[date:"${policy.snapshot}"]`))
  const osm = JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`))), restrictions = JSON.parse(gunzipSync(await readFile(`${dir}/restrictions.json.gz`)))
  const turn = wittenbachTurnaround(osm, restrictions, policy), cache = regionalRoads.caches['801']
  const matched = new Set()
  for (const d of timetable.snapshots) for (const t of d.trains) {
    const key = roadPatternId(t, d.stops), p = policy.patterns.find(p => p.roadPatternId === key)
    if (!p) continue
    assert.equal(t.agencyId, p.agencyId); assert.equal(t.routeId, p.routeId); assert.equal(t.route, p.line); assert.equal(t.directionId, p.directionId)
    assert.deepEqual(d.stops[t.stops[0][0]], policy.from); assert.deepEqual(d.stops[t.stops[1][0]], policy.to)
    const segments = cache.patterns[key]
    assert(segments.length === t.stops.length - 1 && segments[0] === null && segments.slice(1).every(i => Number.isInteger(i) && cache.paths[i]?.length >= 2))
    const issue = cache.report.issues.filter(i => i.pattern === key)
    assert.equal(issue.length, 1); assert.equal(issue[0].reason, 'missing-shape'); assert.equal(issue[0].segment, 0)
    const previous = old.patterns.find(p => p.roadPatternId === key)
    assert(previous && previous.matcherCalls.every(c => Number(c.shape_dist_traveled) === 0))
    matched.add(key)
  }
  assert.equal(matched.size, policy.patterns.length)
  return { policy, source, turn, policySha256: sha(policyBytes) }
}

export function applyThurgauWittenbach(raw, result, supplement, regionalRoads) {
  if (!supplement) return result
  const patterns = new Map(result.patterns.map(p => [p.id, p])), seen = new Set(), cache = regionalRoads.caches['801']
  const indexes = new Map(result.paths.map((p, i) => [JSON.stringify(p), i]))
  for (const train of result.trains) {
    if (train.reservationRequired || train.agencyId !== '801') continue
    const key = roadPatternId(train, raw.stops), mapping = supplement.policy.patterns.find(p => p.roadPatternId === key)
    if (!mapping) continue
    const pattern = patterns.get(train.patternId)
    if (train.admission === 'admitted') continue
    assert.equal(train.routeId, mapping.routeId); assert.equal(train.route, mapping.line); assert.equal(train.directionId, mapping.directionId)
    assert.deepEqual(raw.stops[train.stops[0][0]], supplement.policy.from); assert.deepEqual(raw.stops[train.stops[1][0]], supplement.policy.to)
    if (!seen.has(pattern.id)) {
      seen.add(pattern.id)
      assert.equal(pattern.roadSupplement.status, 'rejected-incomplete-pattern')
      const segments = cache.patterns[key]; assert(segments[0] === null && segments.slice(1).every(i => i !== null))
      const { path: _path, sourcePath: _sourcePath, ...turnEvidence } = supplement.turn
      pattern.wittenbachSupplement = { ...turnEvidence, geometrySha256: sha(JSON.stringify(supplement.turn.path)),
        previousRoadFailure: pattern.roadSupplement, roadPatternId: key }
      pattern.pathSegments = segments.map((index, i) => {
        const path = structuredClone(i === 0 ? supplement.turn.path : cache.paths[index])
        const a = raw.stops[train.stops[i][0]], b = raw.stops[train.stops[i + 1][0]]
        assert(distanceMetres(path[0], a) < .15 && distanceMetres(path.at(-1), b) < .15)
        path[0] = a.slice(0, 2); path[path.length - 1] = b.slice(0, 2)
        const signature = JSON.stringify(path)
        if (!indexes.has(signature)) { indexes.set(signature, result.paths.length); result.paths.push(path) }
        return indexes.get(signature)
      })
      pattern.matchedSegments = pattern.segmentCount; pattern.geometrySource = 'osm-wittenbach-turnaround-inference'
    }
    train.pathSegments = pattern.pathSegments; train.geometrySource = pattern.geometrySource; train.admission = 'admitted'
  }
  return reconcileThurgauGeometry(raw, result)
}
