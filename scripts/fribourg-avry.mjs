import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseLuzernRail, luzernRailMatcher, luzernRailConsensus, luzernOperatingPoint } from './luzern-rail-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './fribourg-timetable.mjs'

export const avryFeatureKey = r => [r.linienr, r.bp_anfang, r.bp_ende, r.km_agm_von, r.km_agm_bis]
const complete = page => {
  assert.equal(page.total_count, page.results.length, 'Incomplete Avry source query')
  return page.results
}

export function fribourgAvryNetwork(network, config, policy, pages) {
  assert.equal(policy.node.number, '8501632')
  assert.equal(policy.node.name, 'Avry-Matran')
  assert(![...network.nodes.values()].some(n => n.id === policy.node.id || n.number === policy.node.number), 'Avry already in FOT; review must be renewed')
  assert.deepEqual(policy.routes, config.routes.filter(r => r.routeId === '91-2B-Y-j26-1'))
  const platforms = complete(pages.perron)
  assert.equal(platforms.length, 2)
  for (const stop of policy.stops) {
    assert.equal(luzernOperatingPoint(stop), policy.node.number)
    const matches = platforms.filter(r => r.bpuic === policy.node.number && r.p_nr === stop.platform_code)
    assert.equal(matches.length, 1, 'Missing unique SBB platform identity')
    const r = matches[0]
    assert.equal(r.bps, 'AVRY'); assert.equal(r.bps_name, policy.node.name); assert.equal(r.linie, 250)
    assert(distanceMetres([r.geopos.lon, r.geopos.lat], [stop.stop_lon, stop.stop_lat]) < 15, 'Changed Avry platform location')
  }
  // Traffic-count geometry supplies only exact operating-point identities/coordinates.
  // Its two-point links are never used as a route curve.
  const identities = complete(pages.zugzahlen).flatMap(r => [
    { number: String(r.von_bpuic), name: r.bp_von_abschnitt_bezeichnung, code: r.bp_von_abschnitt, coordinate: r.verbindung.geometry.coordinates[0] },
    { number: String(r.bis_bpuic), name: r.bp_bis_abschnitt_bezeichnung, code: r.bp_bis_abschnitt, coordinate: r.verbindung.geometry.coordinates.at(-1) },
  ]).filter(n => n.number === policy.node.number)
  assert(identities.length > 0)
  for (const n of identities) {
    assert.equal(n.code, 'AVRY'); assert.equal(n.name, policy.node.name)
    assert.deepEqual(n.coordinate, policy.node.coordinate, 'Inconsistent exact Avry operating point')
  }
  for (const n of policy.endpoints) assert.deepEqual(network.nodes.get(n.id), n, 'Changed Rosé/Matran identity')
  assert.deepEqual(JSON.parse(JSON.stringify(network.segments.find(s => s.id === policy.replacedSegment.id))), JSON.parse(JSON.stringify(policy.replacedSegment)), 'Changed old Rosé–Matran edge')
  const records = complete(pages.curves), nodes = new Map(network.nodes), assessments = []
  nodes.set(policy.node.id, policy.node)
  const added = policy.curves.map(c => {
    const matches = records.filter(r => JSON.stringify(avryFeatureKey(r)) === JSON.stringify(c.feature))
    assert.equal(matches.length, 1, 'Missing unique reviewed SBB curve')
    const r = matches[0], points = r.geo_shape.geometry.coordinates
    assert.equal(r.spurweite, 'N', 'Unreviewed SBB gauge')
    assert.equal(r.geo_shape.geometry.type, 'LineString'); assert.equal(points.length, c.vertices)
    assert(points.length > 2 && points.every(p => p.length === 2 && p.every(Number.isFinite)))
    assert.equal(r.bp_anf_bez, nodes.get(c.start).name); assert.equal(r.bp_end_bez, nodes.get(c.end).name)
    const attachments = [distanceMetres(points[0], nodes.get(c.start).coordinate), distanceMetres(points.at(-1), nodes.get(c.end).coordinate)]
    assert(attachments.every(m => m <= config.limits.topologyAttachmentMetres), 'SBB curve endpoint too far')
    assessments.push({ ...c, attachmentsMetres: attachments })
    return { id: c.id, start: c.start, end: c.end, points, gauge: 'mm1435', operator: 'SBB Infrastructure', sourceDate: null, validFrom: policy.openingDate }
  })
  assert.equal(new Set(added.map(s => s.id)).size, added.length)
  assert(added.every(s => !network.segments.some(old => old.id === s.id)))
  assert.equal(records.length, added.length, 'Uninventoried SBB curve')
  return { network: { nodes, segments: [...network.segments.filter(s => s.id !== policy.replacedSegment.id), ...added] }, assessments,
    inventory: { curves: records.map(r => ({ feature: avryFeatureKey(r), vertices: r.geo_shape.geometry.coordinates.length, use: 'detailed-standard-gauge-curve' })),
      platforms: platforms.map(r => ({ number: r.bpuic, platform: r.p_nr, use: 'identity-and-location-only' })),
      trafficRecords: pages.zugzahlen.results.length, trafficGeometryUse: 'none; exact operating-point identity and coordinates only' } }
}

export function fribourgAvryMatcher(network, config, policy, pages, dates) {
  const local = fribourgAvryNetwork(network, config, policy, pages)
  const matcher = luzernRailMatcher(local.network, { ...config, routes: policy.routes }, dates)
  return { ...local, match(train, stops, route) {
    assert(policy.routes.some(r => r.routeId === train.routeId), 'Route outside Avry review')
    for (const call of train.calls) if (luzernOperatingPoint(stops.get(call.id)) === policy.node.number) {
      const expected = policy.stops.find(s => s.stop_id === call.id)
      assert(expected, 'Unreviewed Avry platform'); assert.deepEqual(stops.get(call.id), expected, 'Changed Avry call identity')
    }
    return matcher.match(train, stops, route).map(r => ({ ...r,
      ...(r.path && r.directedSourceSegments.some(s => policy.curves.some(c => c.id === s.id)) ? { railReview: {
        id: policy.id, kind: 'sbb-avry-operating-point', operatingPoint: policy.node.number,
        segmentIds: r.directedSourceSegments.filter(s => policy.curves.some(c => c.id === s.id)).map(s => s.id),
      } } : {}) }))
  } }
}

export async function loadFribourgAvry(config, baseline) {
  const bytes = await readFile(config.avry.file)
  assert.equal(sha256(bytes), config.avry.sha256, 'Changed Avry policy')
  const policy = JSON.parse(bytes), directory = policy.sourceDirectory
  assert.equal(policy.fotSha256, baseline.source.sha256); assert.equal(policy.inputsSha256, config.inputsSha256)
  assert.equal(policy.openingDate, '2025-12-14')
  for (const s of policy.sources) assert.equal(sha256(await readFile(`${directory}/${s.file}`)), s.sha256, 'Changed Avry source bytes')
  for (const m of policy.metadata) {
    const metas = JSON.parse(await readFile(`${directory}/${m.dataset}-metadata.json`)).metas
    assert.equal(m.modified, metas.default.modified); assert.equal(m.dataProcessed, metas.default.data_processed)
    assert.equal(m.license, metas.dcat_ap_ch.license); assert.equal(m.rights, metas.dcat_ap_ch.rights)
    assert.equal(m.license, 'terms_by')
  }
  const json = async f => JSON.parse(await readFile(`${directory}/${f}.json`))
  const pages = { curves: await json('linie-mit-polygon'), perron: await json('perron'), zugzahlen: await json('zugzahlen') }
  const inputs = JSON.parse(await readFile(config.inputs))
  const network = parseLuzernRail(gunzipSync(await readFile(`${config.sourceDirectory}/network.xtf.gz`)).toString(), config.limits.simplificationMetres)
  const matcher = fribourgAvryMatcher(network, config, policy, pages, inputs.dates)
  const consensus = luzernRailConsensus(inputs, matcher, { ...config, routes: policy.routes }), pairs = new Map(baseline.pairs), admittedPairs = []
  for (const [key, candidate] of consensus.pairs) {
    const original = pairs.get(key); assert(original)
    if (original.path || !candidate.path) continue
    assert.equal(candidate.railReview?.kind, 'sbb-avry-operating-point', 'New path outside Avry review')
    pairs.set(key, { ...candidate, primaryRailFailure: original })
    admittedPairs.push({ key, primaryFailure: original.reason })
  }
  return { ...baseline, pairs, avry: { policy, policySha256: config.avry.sha256, assessments: matcher.assessments,
    inventory: matcher.inventory, patterns: consensus.patterns, admittedPairs } }
}
