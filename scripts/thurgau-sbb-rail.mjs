import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { luzernRailMatcher, luzernOperatingPoint } from './luzern-rail-geometry.mjs'

const sha = b => createHash('sha256').update(b).digest('hex')
const key = r => JSON.stringify([r.linienr, r.bp_anfang, r.bp_ende, r.km_agm_von, r.km_agm_bis])

export function thurgauSbbNetwork(network, page, policy) {
  assert.equal(page.total_count, page.results.length, 'Truncated SBB source')
  const records = new Map(page.results.map(r => [key(r), r]))
  assert.equal(records.size, page.results.length, 'Duplicate SBB segment')
  const nodes = new Map(network.nodes), foreign = policy.foreignNode
  assert(!nodes.has(foreign.id) && ![...nodes.values()].some(n => n.number === foreign.number), 'Foreign point already exists')
  nodes.set(foreign.id, foreign)
  const added = policy.segments.map(s => {
    const r = records.get(JSON.stringify(s.feature)), node = nodes.get(s.nodeId)
    assert(r && node, 'Missing reviewed source identity')
    assert.equal(node.number, s.number); assert.equal(node.name, s.name)
    assert.equal(r.bp_anf_bez, s.name); assert.equal(r.bp_ende, foreign.sourceCode); assert.equal(r.bp_end_bez, foreign.name)
    assert.equal(r.spurweite, 'N', 'Unreviewed SBB gauge')
    const g = r.geo_shape.geometry
    assert.equal(g.type, 'LineString'); assert(g.coordinates.length > 2, 'Schematic line')
    assert.equal(g.coordinates.length, s.vertices)
    assert(g.coordinates.every(p => p.length === 2 && p.every(Number.isFinite)))
    const attachments = [distanceMetres(node.coordinate, g.coordinates[0]), distanceMetres(foreign.coordinate, g.coordinates.at(-1))]
    assert(attachments.every(m => m <= policy.limits.sourceNodeAttachmentMetres), 'SBB identity endpoint too far')
    return { id: s.id, start: node.id, end: foreign.id, points: g.coordinates, gauge: 'mm1435', operator: 'SBB',
      sourceFeature: s.feature, sourceDate: null, sourceNodeAttachmentsMetres: attachments }
  })
  return { nodes, segments: [...network.segments, ...added], inventory: page.results.map(r => ({ key: key(r), line: r.linienr,
    from: r.bp_anf_bez, to: r.bp_end_bez, vertices: r.geo_shape.geometry.coordinates.length, gauge: r.spurweite,
    usedBy: added.find(s => JSON.stringify(s.sourceFeature) === key(r))?.id ?? null,
    exclusion: added.some(s => JSON.stringify(s.sourceFeature) === key(r)) ? null : r.geo_shape.geometry.coordinates.length <= 2 ? 'schematic-two-point-record' : 'outside-reviewed-konstanz-border-links' })), added }
}

export async function loadThurgauSbbRail(network, config, timetable, primary) {
  const directory = 'data/thurgau-sbb-rail-sources', policyBytes = await readFile('data/thurgau-sbb-rail-policy.json'), policy = JSON.parse(policyBytes)
  const sourceBytes = await readFile(`${directory}/sources.json`), source = JSON.parse(sourceBytes)
  assert.equal(sha(sourceBytes), policy.sourceSha256)
  assert.equal(sha(await readFile('data/thurgau-audit/timetable-cache.json.gz')), policy.timetableSha256)
  for (const f of source.files) assert.equal(sha(await readFile(`${directory}/${f.file}`)), f.sha256, `Changed SBB source ${f.file}`)
  const metadata = JSON.parse(await readFile(`${directory}/metadata.json`)).metas
  assert.equal(metadata.dcat_ap_ch.license, source.license); assert.equal(metadata.dcat_ap_ch.rights, source.rights)
  assert.equal(metadata.default.modified, source.modified); assert.equal(metadata.default.data_processed, source.dataProcessed)
  const routeIds = new Set(timetable.snapshots.flatMap(d => d.trains.filter(t => t.stops.some(([i]) => d.stops[i][4] === policy.foreignNode.number)).map(t => t.routeId)))
  assert.deepEqual(policy.routes, config.routes.filter(r => routeIds.has(r.routeId)))
  assert(timetable.snapshots.every(d => d.stops.some(s => s[4] === policy.foreignNode.number && s[2] === policy.foreignNode.name)))
  const extended = thurgauSbbNetwork(network, JSON.parse(await readFile(`${directory}/foreign-review.json`)), policy)
  const matcher = luzernRailMatcher(extended, { ...config, routes: policy.routes }, config.dates)
  const sourceIds = new Set(extended.added.map(s => s.id))
  const review = JSON.parse(await readFile(`${directory}/bregenz-review.json`))
  assert.equal(review.total_count, review.results.length)
  assert(review.results.every(r => r.geo_shape.geometry.coordinates.length === 2))
  const reviewInventory = review.results.map(r => ({ key: key(r), line: r.linienr, from: r.bp_anf_bez, to: r.bp_end_bez,
    vertices: 2, gauge: r.spurweite, usedBy: null, exclusion: 'schematic-two-point-record', sourceFile: 'bregenz-review.json' }))
  return { policy, policySha256: sha(policyBytes), source, inventory: [...extended.inventory.map(r => ({ ...r, sourceFile: 'foreign-review.json' })), ...reviewInventory],
    joins: extended.added.map(({ points: _points, ...s }) => s),
    match(train, stops, route) {
      const original = primary.match(train, stops, route)
      if (original.every(s => s.path) || !routeIds.has(route.routeId) || !train.calls.some(c => luzernOperatingPoint(stops.get(c.id)) === policy.foreignNode.number)) return original
      return matcher.match(train, stops, route).map((s, i) => {
        const ids = s.directedSourceSegments?.filter(e => sourceIds.has(e.id)).map(e => e.id) ?? []
        return { ...s, geometrySource: ids.length ? 'fot-sbb-rail-inference' : s.geometrySource,
          sbbSourceSegments: ids, primaryFailure: original[i].reason ?? null }
      })
    } }
}
