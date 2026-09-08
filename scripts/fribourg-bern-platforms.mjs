import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseLuzernRail, luzernRailMatcher, luzernRailConsensus, luzernOperatingPoint } from './luzern-rail-geometry.mjs'
import { fribourgRailReviewMatcher } from './fribourg-rail-review.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './fribourg-timetable.mjs'

export function bernTerminalProjection(points, coordinate, maximumMetres = 75) {
  const factor = Math.cos(coordinate[1] * Math.PI / 180)
  let best
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = (b[0] - a[0]) * factor, dy = b[1] - a[1]
    const denominator = dx * dx + dy * dy
    if (!denominator) continue
    const fraction = Math.max(0, Math.min(1, ((coordinate[0] - a[0]) * factor * dx + (coordinate[1] - a[1]) * dy) / denominator))
    const point = [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction].map(n => Number(n.toFixed(7)))
    const attachmentMetres = distanceMetres(point, coordinate)
    if (!best || attachmentMetres < best.attachmentMetres) best = { segmentIndex: i - 1, fraction, point, attachmentMetres }
  }
  assert(best && best.attachmentMetres <= maximumMetres, 'Reviewed terminal too far from pinned approach curve')
  assert(best.segmentIndex > 0 && best.segmentIndex < points.length - 2, 'Terminal projection is not inside reviewed source curve')
  return { ...best, retainedPoints: [best.point, ...points.slice(best.segmentIndex + 1)],
    removedMetres: points.slice(1, best.segmentIndex + 1).reduce((n, p, i) => n + distanceMetres(points[i], p), 0) + distanceMetres(points[best.segmentIndex], best.point) }
}

export function bernTerminalNetwork(network, policy, stop, corridor) {
  assert.deepEqual(network.nodes.get(policy.node.id), policy.node, 'Changed Bern operating point')
  const source = network.segments.find(s => s.id === corridor.segment.id)
  assert.deepEqual(JSON.parse(JSON.stringify(source)), JSON.parse(JSON.stringify(corridor.segment)), 'Changed reviewed Bern approach')
  assert.equal(source.gauge, 'mm1435')
  assert([source.start, source.end].includes(policy.node.id))
  const points = source.start === policy.node.id ? source.points : [...source.points].reverse()
  const projection = bernTerminalProjection(points, [stop.stop_lon, stop.stop_lat], policy.maximumProjectionMetres)
  assert(projection.removedMetres >= policy.minimumTrimMetres && projection.removedMetres <= policy.maximumTrimMetres, 'Unreviewed station-centre trim length')
  const other = source.start === policy.node.id ? source.end : source.start
  const nodes = new Map(network.nodes)
  nodes.set(policy.node.id, { ...policy.node, coordinate: projection.point })
  // This is a pattern-local terminal. Remove every station-centre connection;
  // only the clipped, explicitly selected western approach remains connected.
  const removed = network.segments.filter(s => s.start === policy.node.id || s.end === policy.node.id)
  const clipped = { ...source, id: `${source.id}:bern-terminal:${stop.platform_code}`, start: policy.node.id, end: other, points: projection.retainedPoints,
    length: projection.retainedPoints.slice(1).reduce((n, p, i) => n + distanceMetres(projection.retainedPoints[i], p), 0) }
  return { network: { nodes, segments: [...network.segments.filter(s => !removed.includes(s)), clipped] },
    evidence: { id: policy.id, kind: 'bern-western-terminal', stopId: stop.stop_id, sourceSegmentId: source.id, clippedSegmentId: clipped.id,
      originalOperatingPoint: policy.node, projection, removedStationCentreSegmentIds: removed.map(s => s.id).sort() } }
}

export function fribourgBernMatcher(network, config, policy, previousReview, page, inputs) {
  assert.deepEqual(policy.routes, config.routes.filter(r => policy.corridors.some(c => c.routeIds.includes(r.routeId))))
  const routes = new Set(policy.routes.map(r => r.routeId)), variants = new Map(), assessments = []
  const base = luzernRailMatcher(network, config, inputs.dates)
  return { assessments, match(train, stops, route) {
    assert(routes.has(train.routeId), 'Route outside Bern terminal review')
    const terminals = train.calls.map((c, i) => ({ index: i, stop: stops.get(c.id) })).filter(c => luzernOperatingPoint(c.stop) === policy.node.number)
    const reviewed = terminals.length === 1 && [0, train.calls.length - 1].includes(terminals[0].index)
      ? policy.stops.find(s => s.stop_id === terminals[0].stop.stop_id) : undefined
    if (!reviewed) return base.match(train, stops, route)
    assert.deepEqual(terminals[0].stop, reviewed, 'Changed reviewed Bern platform')
    const corridor = policy.corridors.find(c => c.routeIds.includes(train.routeId))
    assert(corridor, 'Missing route-specific western corridor')
    const signature = JSON.stringify([corridor.segment.id, reviewed.stop_id])
    if (!variants.has(signature)) {
      const variant = bernTerminalNetwork(network, policy, reviewed, corridor)
      const matcher = train.routeId === previousReview.kerzers.routeId
        ? fribourgRailReviewMatcher(variant.network, config, previousReview, page, inputs.dates)
        : luzernRailMatcher(variant.network, config, inputs.dates)
      variants.set(signature, { ...variant, matcher }); assessments.push(variant.evidence)
    }
    const { evidence, matcher } = variants.get(signature)
    return matcher.match(train, stops, route).map((r, i) => ({ ...r,
      ...(r.path && (terminals[0].index === i || terminals[0].index === i + 1) ? { railReview: evidence } : {}) }))
  } }
}

export async function loadFribourgBernPlatforms(config, baseline) {
  const bytes = await readFile(config.bernPlatforms.file)
  assert.equal(sha256(bytes), config.bernPlatforms.sha256, 'Changed Bern terminal policy')
  const policy = JSON.parse(bytes)
  assert.equal(policy.fotSha256, baseline.source.sha256)
  assert.equal(policy.inputsSha256, config.inputsSha256)
  assert.equal(policy.previousReviewSha256, config.review.sha256)
  assert.equal(policy.maximumProjectionMetres, 75)
  assert.equal(policy.minimumTrimMetres, 200)
  assert.equal(policy.maximumTrimMetres, 600)
  for (const file of policy.sources) assert.equal(sha256(await readFile(`${policy.sourceDirectory}/${file.file}`)), file.sha256, 'Changed Bern source evidence')
  const inputs = JSON.parse(await readFile(config.inputs))
  const network = parseLuzernRail(gunzipSync(await readFile(`${config.sourceDirectory}/network.xtf.gz`)).toString(), config.limits.simplificationMetres)
  const previous = baseline.review.policy
  const matcher = fribourgBernMatcher(network, config, policy, previous, JSON.parse(await readFile(`${previous.sourceDirectory}/sbb-daeniken.json`)), inputs)
  const consensus = luzernRailConsensus(inputs, matcher, { ...config, routes: policy.routes }), pairs = new Map(baseline.pairs), admittedPairs = []
  for (const [key, candidate] of consensus.pairs) {
    const original = pairs.get(key); assert(original)
    if (original.path || !candidate.path) continue
    assert.equal(candidate.railReview?.kind, 'bern-western-terminal', 'New pair outside terminal review')
    pairs.set(key, { ...candidate, primaryRailFailure: original })
    admittedPairs.push({ key, primaryFailure: original.reason })
  }
  return { ...baseline, pairs, bernPlatforms: { policy, policySha256: config.bernPlatforms.sha256,
    assessments: matcher.assessments, patterns: consensus.patterns, admittedPairs } }
}
