import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseZugRail, zugRailMatcher, operatingPointNumber } from './zug-rail-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { previousServiceDate } from './civil-day.mjs'

const length = p => p.slice(1).reduce((n, b, i) => n + distanceMetres(p[i], b), 0)
export function projectReviewedRailPoint(point, points) {
  const scale = Math.cos(point[1] * Math.PI / 180)
  let best
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = (b[0] - a[0]) * scale, dy = b[1] - a[1]
    if (dx === 0 && dy === 0) continue
    const fraction = Math.max(0, Math.min(1, ((point[0] - a[0]) * scale * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    const coordinate = [a[0] + fraction * (b[0] - a[0]), a[1] + fraction * (b[1] - a[1])], metres = distanceMetres(point, coordinate)
    if (!best || metres < best.metres) best = { edgeIndex: i - 1, fraction, coordinate, metres }
  }
  assert(best, 'Degenerate reviewed source curve')
  return best
}

// Subdivide only explicitly reviewed source curves. Old junctions stay connected;
// all GTFS calls stay untouched. An inserted node is derived, never a FOT record.
export function reviewGraubuendenRailAnchors(network, policy, stops) {
  const nodes = new Map(network.nodes), segments = [...network.segments], reviews = []
  assert.equal(new Set(policy.anchors.map(a => a.segment.id)).size, policy.anchors.length, 'Multiple reviews of one source curve')
  for (const a of policy.anchors) {
    const index = segments.findIndex(s => s.id === a.segment.id), segment = segments[index]
    assert(segment, 'Missing reviewed source curve')
    assert.equal(sha256(JSON.stringify(segment.points)), a.segment.pointsSha256, 'Changed reviewed source curve')
    assert.equal(segment.gauge, 'mm1000'); assert.equal(segment.infrastructureOperator, 'RhB FR VR')
    assert.equal(segment.start, a.segment.start.id); assert.equal(segment.end, a.segment.end.id)
    assert.deepEqual(nodes.get(segment.start), a.segment.start, 'Changed start operating point')
    assert.deepEqual(nodes.get(segment.end), a.segment.end, 'Changed end operating point')
    const existing = [...nodes.values()].filter(n => n.number === a.number)
    assert.deepEqual(existing.map(n => n.id), a.replacesOperatingPoint ? [a.replacesOperatingPoint] : [], 'Changed station identity')
    const usedStops = a.stops.map(record => {
      const stop = stops.get(record.id)
      assert(stop && operatingPointNumber(stop.stop_id) === a.number, 'Unreviewed stop identity')
      assert.equal(stop.stop_name, a.name)
      assert.deepEqual([Number(stop.stop_lon), Number(stop.stop_lat)], record.coordinate, 'Changed reviewed platform coordinate')
      return record.coordinate
    })
    assert(usedStops.length)
    const reference = [0, 1].map(i => usedStops.reduce((n, p) => n + p[i], 0) / usedStops.length)
    assert.deepEqual(reference, a.referenceCoordinate)
    const projection = projectReviewedRailPoint(reference, segment.points)
    assert(projection.fraction > 0 && projection.fraction < 1, 'Review must select a curve interior')
    assert(projection.metres <= policy.limits.snapMetres, 'Reviewed anchor too far from source')
    const attachments = usedStops.map(p => distanceMetres(p, projection.coordinate))
    assert(attachments.every(m => m <= policy.limits.snapMetres), 'Reviewed platform too far from anchor')
    const alternatives = network.segments.filter(s => s.id !== segment.id && s.gauge === 'mm1000' && s.infrastructureOperator === 'RhB FR VR')
      .map(s => ({ id: s.id, metres: projectReviewedRailPoint(reference, s.points).metres })).sort((a, b) => a.metres - b.metres)
    assert(!alternatives.length || alternatives[0].metres - projection.metres >= policy.limits.alternativeSeparationMetres, 'Ambiguous nearby rail curve')
    const id = `gr-reviewed-anchor:${a.id}`
    assert(!nodes.has(id), 'Duplicate derived anchor')
    if (existing.length) nodes.set(existing[0].id, { ...existing[0], number: null })
    nodes.set(id, { id, number: a.number, name: a.name, coordinate: projection.coordinate })
    const left = [...segment.points.slice(0, projection.edgeIndex + 1), projection.coordinate]
    const right = [projection.coordinate, ...segment.points.slice(projection.edgeIndex + 1)]
    assert(Math.abs(length(left) + length(right) - length(segment.points)) < .01, 'Source curve changed during subdivision')
    const slices = [
      { ...segment, id: `${segment.id}:gr:${a.id}:0`, end: id, points: left, length: length(left) },
      { ...segment, id: `${segment.id}:gr:${a.id}:1`, start: id, points: right, length: length(right) },
    ]
    segments.splice(index, 1, ...slices)
    reviews.push({ id: a.id, number: a.number, name: a.name, derivedNodeId: id, sourceSegmentId: segment.id,
      sourcePointsSha256: a.segment.pointsSha256, sourceStartNode: a.segment.start, sourceEndNode: a.segment.end,
      replacesOperatingPoint: a.replacesOperatingPoint, projection, platformAttachmentsMetres: attachments,
      nearestAlternative: alternatives[0] ?? null, sourceLengthMetres: length(segment.points),
      slices: slices.map((s, i) => ({ id: s.id, start: s.start, end: s.end, sourceInterval: i ? [projection.edgeIndex + projection.fraction, segment.points.length - 1] : [0, projection.edgeIndex + projection.fraction], points: s.points })) })
  }
  return { nodes, segments, reviews }
}

export async function loadGraubuendenRailAnchors(policy, raw) {
  if (!policy.railAnchorReview) return null
  const bytes = await readFile('data/graubuenden-rail-review/policy.json')
  assert.equal(sha256(bytes), policy.railAnchorReview.policySha256, 'Changed anchor review policy')
  const review = JSON.parse(bytes), sourceBytes = await readFile('data/graubuenden-rail-review/sources.json')
  assert.equal(sha256(sourceBytes), review.evidenceSha256)
  const evidence = JSON.parse(sourceBytes)
  for (const f of evidence.files) {
    const b = await readFile(`data/graubuenden-rail-review/${f.file}`)
    assert.equal(sha256(b), f.compressedSha256); assert.equal(sha256(gunzipSync(b)), f.sha256)
  }
  assert.deepEqual(review.dates, raw.dates); assert.equal(review.timetableSha256, policy.timetableSha256)
  const xml = gunzipSync(await readFile(`${policy.rail.sourceDirectory}/network.xtf.gz`))
  assert.equal(sha256(xml), policy.rail.sourceSha256)
  const network = parseZugRail(xml.toString(), policy.rail.limits.simplificationMetres), stops = new Map(raw.stops.map(s => [s.stop_id, s]))
  const extended = reviewGraubuendenRailAnchors(network, review, stops), group = policy.railGroups.find(g => g.id === 'rhb')
  const routes = review.routes.map(r => { assert.deepEqual(group.routes.find(v => v.routeId === r.routeId), r); return r })
  const routeIds = new Set(routes.map(r => r.routeId)), reviewedStops = new Set(review.anchors.flatMap(a => a.stops.map(s => s.id)))
  // The review covers exactly the station/platform records used by scoped fixture trips.
  const actualStops = new Set(raw.snapshots.flatMap(d => d.trains.filter(t => routeIds.has(t.routeId)).flatMap(t => t.calls.map(c => c.id))).filter(id => review.anchors.some(a => operatingPointNumber(id) === a.number)))
  assert.deepEqual([...actualStops].sort(), [...reviewedStops].sort(), 'Unreviewed platform entered fixtures')
  const matcher = zugRailMatcher(extended, { ...policy.rail, ...group, routes }, [previousServiceDate(raw.dates[0]), raw.dates.at(-1)])
  const sliceMap = new Map(extended.reviews.flatMap(r => r.slices.map(s => [s.id, { reviewId: r.id, sourceSegmentId: r.sourceSegmentId, sourceInterval: s.sourceInterval }])))
  return { policy: review, reviews: extended.reviews, evidence, sourceInventory: matcher.sourceInventory,
    match(original, train, route) {
      if (original.every(p => p.path) || !routeIds.has(route.routeId)) return original
      return matcher.matchPattern(train, stops, route).map((p, i) => ({ ...p,
        geometrySource: 'fot-reviewed-stop-anchor', primaryFailure: original[i].reason ?? null,
        reviewedSourceSlices: (p.directedSourceSegments ?? []).filter(s => sliceMap.has(s.id)).map(s => ({ derivedSegmentId: s.id, ...sliceMap.get(s.id) })) }))
    } }
}
