import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { loadBernRail, applyBernRail } from './bern-rail-geometry.mjs'
import { parseZugRail, zugRailMatcher, operatingPointNumber } from './zug-rail-geometry.mjs'
import { bernTerminalProjection } from './fribourg-bern-platforms.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { previousServiceDate } from './civil-day.mjs'
const sha = b => createHash('sha256').update(b).digest('hex')
const length = points => points.slice(1).reduce((n, p, i) => n + distanceMetres(points[i], p), 0)
export const BERN_MORGES_ROUTES = ['91-15-B-j26-1']

// Split one pinned mainline curve at the original platform's projection. Both
// sides remain connected; no terminal spur or return through the stop is added.
export function bernMorgesNetwork(network, policy) {
  assert.deepEqual(network.nodes.get(policy.node.id), policy.node, 'Changed Morges operating point')
  const source = network.segments.find(s => s.id === policy.stationCurve.id)
  assert.deepEqual(source, policy.stationCurve, 'Changed reviewed Morges source curve')
  assert.equal(source.gauge, 'mm1435'); assert.equal(source.infrastructureOperator, 'SBB CFF FFS')
  assert([source.start, source.end].includes(policy.node.id))
  const points = source.start === policy.node.id ? source.points : [...source.points].reverse()
  const projection = bernTerminalProjection(points, policy.stop.slice(0, 2), policy.maximumProjectionMetres)
  assert(projection.removedMetres >= policy.minimumStationSectionMetres && projection.removedMetres <= policy.maximumStationSectionMetres, 'Unreviewed Morges station section length')
  const platform = { id: 'bern:morges-platform:1', number: 'BE-MORGES-1', name: 'Morges reviewed platform 1', coordinate: projection.point }
  const stationPoints = [...points.slice(0, projection.segmentIndex + 1), projection.point]
  const station = { ...source, id: `${source.id}:morges-platform:1:station`, start: policy.node.id, end: platform.id, points: stationPoints, length: length(stationPoints) }
  const north = { ...source, id: `${source.id}:morges-platform:1:north`, start: platform.id,
    end: source.start === policy.node.id ? source.end : source.start, points: projection.retainedPoints, length: length(projection.retainedPoints) }
  assert(Math.abs(station.length + north.length - length(points)) < .01, 'Morges split changed source length')
  const nodes = new Map(network.nodes); nodes.set(platform.id, platform)
  const { retainedPoints: _points, ...projectionEvidence } = projection
  return { network: { ...network, nodes, segments: [...network.segments.filter(s => s !== source), station, north] }, platform,
    evidence: { originalOperatingPoint: policy.node, originalStop: policy.stop, sourceCurveId: source.id, platform,
      projection: projectionEvidence, stationSectionId: station.id, northernSectionId: north.id,
      stationSectionMetres: station.length, northernSectionMetres: north.length, sourceLengthMetres: length(points),
      sourceVertices: points.length, splitVertices: station.points.length + north.points.length - 1, bothSidesConnected: true } }
}

export function bernMorgesMatcher(network, policy) {
  const v = bernMorgesNetwork(network, policy.morges)
  const config = { ...policy, operatingPointOverrides: [{ sourceNumber: policy.morges.node.number,
    targetNumber: v.platform.number, expectedName: v.platform.name, routeIds: BERN_MORGES_ROUTES }] }
  const matcher = zugRailMatcher(v.network, config, [previousServiceDate(policy.dates[0]), policy.dates.at(-1)])
  assert(matcher.sourceInventory.every(s => !s.reason), 'Invalid reviewed Morges segment')
  const patterns = new Set(policy.originalPatterns.map(p => JSON.stringify([p.directionId, p.stopIds])))
  const originals = new Map(policy.originalStops.map(s => [s[4], s]))
  return { sourceInventory: matcher.sourceInventory, evidence: v.evidence, matchPattern(train, stops, route) {
    assert.equal(train.routeId, BERN_MORGES_ROUTES[0]); assert.equal(route.agencyId, '11')
    assert.equal(route.line, 'IR15'); assert.equal(route.mode, 'rail')
    const ids = train.calls.map(c => c.id), reject = () => ids.slice(1).map(() => ({ reason: 'rail-unreviewed-morges-through-context' }))
    if (!patterns.has(JSON.stringify([train.directionId, ids]))) return reject()
    const index = ids.indexOf(policy.morges.stop[4])
    if (index < 1 || index >= ids.length - 1 || ids.filter(id => operatingPointNumber(id) === '8501037').length !== 1) return reject()
    if (operatingPointNumber(ids[index - 1]) !== '8501120' || operatingPointNumber(ids[index + 1]) !== '8501030') return reject()
    for (const id of ids) {
      const original = stops.get(id), expected = originals.get(id)
      assert(original && expected, 'Missing reviewed IR15 original stop')
      assert.deepEqual([original.stop_lon, original.stop_lat], expected.slice(0, 2), 'Changed reviewed IR15 source coordinates')
    }
    return matcher.matchPattern(train, stops, route).map((r, i) => {
      if (i !== index - 1 && i !== index) return { reason: 'rail-outside-morges-reviewed-pairs' }
      return { ...r, ...(r.path ? { morgesReview: { sourceCurveId: policy.morges.stationCurve.id,
        originalStopId: policy.morges.stop[4], throughStation: true, bothSidesConnected: true } } : {}) }
    })
  } }
}

export async function loadBernMorges() {
  const bytes = await readFile('data/bern-morges-policy.json'), policy = JSON.parse(bytes), baseline = await loadBernRail()
  assert.equal(policy.sourceId, 'bern-morges-reviewed-fot-rail-20210706')
  for (const key of ['sourceDirectory', 'sourceMetadataSha256', 'sourceSha256']) assert.equal(policy[key], baseline.policy[key])
  for (const key of ['limits', 'dates', 'gauges', 'infrastructureOperators']) assert.deepEqual(policy[key], baseline.policy[key])
  assert.deepEqual(policy.routes.map(({ pairs: _pairs, ...r }) => r), [{ routeId: BERN_MORGES_ROUTES[0], agencyId: '11', line: 'IR15', mode: 'rail' }])
  assert.equal(policy.morges.maximumProjectionMetres, 75)
  assert.equal(policy.morges.minimumStationSectionMetres, 50); assert.equal(policy.morges.maximumStationSectionMetres, 200)
  assert.equal(policy.morges.stop[4], 'ch:1:sloid:1037:1:1'); assert.equal(policy.morges.node.number, '8501037')
  assert.equal(policy.originalPatterns.length, 5)
  assert.equal(policy.originalStops.length, 17)
  for (const doc of policy.documents) assert.equal(sha(await readFile(`${policy.documentsDirectory}/${doc.file}`)), doc.sha256, 'Changed Morges supporting source')
  const platforms = JSON.parse(await readFile(`${policy.documentsDirectory}/perron.json`))
  assert.equal(platforms.total_count, platforms.results.length)
  assert.deepEqual(platforms.results.filter(r => r.bpuic === '8501037' && r.p_nr === '1'), [policy.morges.sbbPlatform])
  assert.equal(policy.morges.sbbPlatform.fid, 35284906); assert.equal(policy.morges.sbbPlatform.p_lange, 421)
  const metas = JSON.parse(await readFile(`${policy.documentsDirectory}/perron-metadata.json`)).metas
  for (const [field, value] of Object.entries({ publisher: metas.default.publisher, modified: metas.default.modified,
    dataProcessed: metas.default.data_processed, metadataProcessed: metas.default.metadata_processed,
    license: metas.dcat_ap_ch.license, rights: metas.dcat_ap_ch.rights, termsUrl: metas.default.license,
    sourceRecords: platforms.total_count })) assert.equal(policy.sbbPlatformDataset[field], value, 'Changed SBB platform provenance')
  const xml = gunzipSync(await readFile(`${policy.sourceDirectory}/network.xtf.gz`)); assert.equal(sha(xml), policy.sourceSha256)
  const parsed = parseZugRail(xml.toString(), 0), bindings = policy.routes[0].pairs
  assert.equal(bindings.length, 2)
  assert.equal(new Set(bindings.map(p => JSON.stringify([p.fromId, p.toId]))).size, bindings.length)
  for (const p of bindings) assert.deepEqual(p.operatingPointPair, [p.fromId, p.toId].map(operatingPointNumber))
  const selected = new Set(bindings.flatMap(p => p.sourceSegments.map(id => id.split(':morges-platform:')[0])))
  const segments = parsed.segments.filter(s => selected.has(s.id)); assert.equal(segments.length, selected.size)
  const matcher = bernMorgesMatcher({ ...parsed, segments }, policy)
  return { policy, matcher, metadata: { policySha256: sha(bytes), policy, source: baseline.metadata.source,
    sourceSegments: matcher.sourceInventory, throughStationEvidence: matcher.evidence } }
}
export const applyBernMorges = applyBernRail
