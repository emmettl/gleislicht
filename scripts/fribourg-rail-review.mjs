import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseLuzernRail, luzernRailMatcher, luzernRailConsensus, luzernOperatingPoint } from './luzern-rail-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './fribourg-timetable.mjs'

const key = r => JSON.stringify([r.linienr, r.bp_anfang, r.bp_ende, r.km_agm_von, r.km_agm_bis])

export function fribourgRailReviewMatcher(network, config, policy, page, dates) {
  assert.deepEqual(policy.limits, config.limits)
  assert.deepEqual(policy.routes, config.routes.filter(r => [policy.kerzers.routeId, policy.daeniken.routeId].includes(r.routeId)))
  const k = policy.kerzers, d = policy.daeniken
  assert.deepEqual(network.nodes.get(k.node.id), k.node, 'Changed reviewed Kerzers BLS node')
  assert.equal(k.node.number, '8516192'); assert.equal(k.node.name, 'Kerzers BLS')
  for (const s of k.stops) {
    assert.equal(luzernOperatingPoint(s), k.sourceNumber)
    assert(['4', '6'].includes(s.platform_code))
    assert.equal(s.stop_name, 'Kerzers')
  }
  assert.equal(page.total_count, page.results.length, 'Truncated SBB query')
  const records = new Map(page.results.map(r => [key(r), r]))
  assert.equal(records.size, page.results.length, 'Duplicate SBB record')
  const feature = records.get(JSON.stringify(d.feature))
  assert(feature, 'Missing exact SBB Däniken record')
  assert.equal(feature.spurweite, 'N', 'Unreviewed SBB gauge')
  assert.equal(feature.geo_shape.geometry.type, 'LineString')
  const points = feature.geo_shape.geometry.coordinates
  assert.equal(points.length, d.vertices); assert(points.length > 2)
  assert(points.every(p => p.length === 2 && p.every(Number.isFinite)))
  for (const node of d.nodes) assert.deepEqual(network.nodes.get(node.id), node, 'Changed Däniken node')
  assert.equal(feature.bp_anf_bez, d.nodes[0].name); assert.equal(feature.bp_end_bez, d.nodes[1].name)
  assert.deepEqual(JSON.parse(JSON.stringify(network.segments.find(s => s.id === d.originalSegment.id))), d.originalSegment, 'Changed original FOT gauge evidence')
  assert.equal(d.originalSegment.gauge, 'mm1000')
  const attachments = d.nodes.map((n, i) => distanceMetres(n.coordinate, i ? points.at(-1) : points[0]))
  assert(attachments.every(m => m <= config.limits.topologyAttachmentMetres), 'SBB identity endpoint too far')
  const added = { id: d.id, start: d.nodes[0].id, end: d.nodes[1].id, points, gauge: 'mm1435', operator: 'SBB Infrastructure', sourceDate: null }
  assert(!network.segments.some(s => s.id === added.id))
  const bls = luzernRailMatcher(network, { ...config, routes: policy.routes.filter(r => r.routeId === k.routeId) }, dates)
  const sbb = luzernRailMatcher({ ...network, segments: [...network.segments, added] }, { ...config, routes: policy.routes.filter(r => r.routeId === d.routeId) }, dates)
  const inventory = page.results.map(r => ({ key: key(r), line: r.linienr, from: r.bp_anf_bez, to: r.bp_end_bez, gauge: r.spurweite,
    vertices: r.geo_shape.geometry.coordinates.length, usedBy: key(r) === JSON.stringify(d.feature) ? d.id : null,
    exclusion: key(r) === JSON.stringify(d.feature) ? null : 'outside-reviewed-dk-dko-connection' }))
  return { inventory, sourceSegment: sbb.sourceInventory.find(s => s.id === d.id), attachments,
    match(train, stops, route) {
      if (train.routeId === k.routeId) {
        const changed = new Map(stops), reviewed = new Set()
        for (const call of train.calls) {
          const expected = k.stops.find(s => s.stop_id === call.id)
          if (!expected) continue
          assert.deepEqual(stops.get(call.id), expected, 'Changed reviewed Kerzers platform')
          changed.set(call.id, { ...expected, didok: k.node.number }); reviewed.add(call.id)
        }
        return bls.match(train, changed, route).map((r, i) => ({ ...r,
          ...(reviewed.has(train.calls[i].id) || reviewed.has(train.calls[i + 1].id) ? { railReview: { id: policy.id, kind: 'kerzers-bls-platform',
            sourceNumber: k.sourceNumber, targetNumber: k.node.number, stopIds: [train.calls[i].id, train.calls[i + 1].id].filter(id => reviewed.has(id)) } } : {}) }))
      }
      assert.equal(train.routeId, d.routeId, 'Route outside rail review')
      return sbb.match(train, stops, route).map(r => ({ ...r,
        ...(r.directedSourceSegments?.some(s => s.id === d.id) ? { railReview: { id: policy.id, kind: 'sbb-daeniken-curve', segmentId: d.id, sourceFeature: d.feature } } : {}) }))
    } }
}

export async function loadFribourgRailReview(config, baseline) {
  const bytes = await readFile(config.review.file)
  assert.equal(sha256(bytes), config.review.sha256, 'Changed rail review policy')
  const policy = JSON.parse(bytes), directory = policy.sourceDirectory
  assert.equal(policy.fotSha256, baseline.source.sha256)
  assert.equal(policy.inputsSha256, config.inputsSha256)
  const sourceBytes = await readFile(`${directory}/sources.json`), source = JSON.parse(sourceBytes)
  assert.equal(sha256(sourceBytes), policy.sourceSha256)
  for (const file of source.files) assert.equal(sha256(await readFile(`${directory}/${file.file}`)), file.sha256, `Changed rail review source ${file.file}`)
  const metadata = JSON.parse(await readFile(`${directory}/sbb-metadata.json`)).metas
  assert.equal(source.license, metadata.dcat_ap_ch.license); assert.equal(source.rights, metadata.dcat_ap_ch.rights)
  assert.equal(source.modified, metadata.default.modified); assert.equal(source.dataProcessed, metadata.default.data_processed)
  const inputs = JSON.parse(await readFile(config.inputs))
  const network = parseLuzernRail(gunzipSync(await readFile(`${config.sourceDirectory}/network.xtf.gz`)).toString(), config.limits.simplificationMetres)
  const matcher = fribourgRailReviewMatcher(network, config, policy, JSON.parse(await readFile(`${directory}/sbb-daeniken.json`)), inputs.dates)
  const consensus = luzernRailConsensus(inputs, matcher, { ...config, routes: policy.routes })
  const pairs = new Map(baseline.pairs), admittedPairs = []
  for (const [key, candidate] of consensus.pairs) {
    const original = pairs.get(key)
    assert(original, 'Review pair absent from complete baseline')
    if (original.path || !candidate.path) continue
    assert(candidate.railReview, 'New path lacks specific reviewed mapping or SBB geometry')
    pairs.set(key, { ...candidate, primaryRailFailure: original })
    admittedPairs.push({ key, kind: candidate.railReview.kind, primaryFailure: original.reason })
  }
  return { pairs, review: { policy, policySha256: config.review.sha256, source, patterns: consensus.patterns,
    inventory: matcher.inventory, sourceSegment: matcher.sourceSegment, attachments: matcher.attachments, admittedPairs } }
}
