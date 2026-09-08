import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { bernGraph, BERN_LIMITS } from './bern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './fribourg-timetable.mjs'
export const BOLTIGEN_ROUTE = '92-259-j26-1'
export const BOLTIGEN_PAIRS = [
  ['ch:1:sloid:88866:0:16061', 'ch:1:sloid:77762:0:16063'],
  ['ch:1:sloid:77762:0:16062', 'ch:1:sloid:88866:0:16060'],
]
export const decodeBoltigen = file => JSON.parse(execFileSync('python3', ['scripts/fribourg_boltigen.py', file], { maxBuffer: 4 * 1024 * 1024 }))
function projections(point, path) {
  return path.slice(1).map((b, i) => {
    const a = path[i], scale = Math.cos(point[1] * Math.PI / 180), dx = (b[0] - a[0]) * scale, dy = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * scale * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    const p = a.map((v, j) => v + t * (b[j] - v))
    return { segment: i, fraction: t, position: i + t, coordinate: p, gapMetres: distanceMetres(point, p) }
  }).sort((a, b) => a.gapMetres - b.gapMetres || a.position - b.position)
}
const curveGap = (p, path) => projections(p, path)[0].gapMetres
export function boltigenPath(source, policy, index) {
  assert.equal(policy.maximumAttachmentMetres, 20); assert.equal(policy.maximumLengthMetres, 1200); assert.equal(policy.maximumComparisonMetres, 20)
  const way = source.way, nodes = new Map(source.nodes.map(n => [n.id, n])), stops = policy.pairs[index].stops
  assert.equal(way.id, '584938515'); assert.equal(way.tags.highway, 'secondary'); assert.equal(way.tags.ref, '219')
  assert(!way.tags.oneway || way.tags.oneway === 'no', 'Bidirectional hairpin source changed')
  assert.equal(new Set(way.nodes).size, way.nodes.length)
  for (const r of [way, ...way.nodes.map(id => nodes.get(id))]) {
    assert(r && r.timestamp < '2026-09-04', 'Missing or post-fixture source object')
    assert(!Object.keys(r.tags).some(k => /conditional|restriction|barrier/.test(k)), 'Unreviewed road restriction')
    for (const key of ['access', 'vehicle', 'motor_vehicle', 'psv', 'bus']) assert(!r.tags[key] || ['yes', 'designated'].includes(r.tags[key]), 'Unreviewed road access')
  }
  assert.equal(source.restrictions.filter(r => r.members.some(m => m.type === 'way' && m.ref === way.id || m.type === 'node' && way.nodes.includes(m.ref))).length, 0)
  assert.deepEqual(stops.map(s => s[4]), BOLTIGEN_PAIRS[index])
  const coordinates = way.nodes.map(id => nodes.get(id).coordinate), attachments = stops.map(s => projections(s, coordinates)[0]), [a, b] = attachments
  assert(attachments.every(p => p.gapMetres <= 20), 'Original platform exceeds hairpin attachment guard')
  assert(index === 0 ? a.position < b.position : a.position > b.position, 'Reversed hairpin projection order')
  const lo = Math.min(a.position, b.position), hi = Math.max(a.position, b.position)
  const ids = way.nodes.filter((_, i) => i > lo && i < hi)
  const middle = ids.map(id => nodes.get(id).coordinate)
  if (index === 1) { ids.reverse(); middle.reverse() }
  const path = [stops[0].slice(0, 2), a.coordinate, ...middle, b.coordinate, stops[1].slice(0, 2)].map(p => p.map(n => Number(n.toFixed(7))))
  const lengthMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
  assert(lengthMetres > 900 && lengthMetres <= 1200, 'Unreviewed hairpin length')
  const f = source.bernFeature
  assert.equal(f.properties.objectid, 300); assert.equal(f.properties.liniencode, '20_259'); assert.equal(f.properties.tucode, 'TPF'); assert.equal(f.properties.vkmtyp, 2)
  const comparison = matchBaselSegment(bernGraph([f]), ...stops, BERN_LIMITS.bus)
  assert(comparison.path, 'Independent Bern corridor fails original cantonal limits')
  const bernToOsmMetres = Math.max(...comparison.path.map(p => curveGap(p, path))), osmToBernMetres = Math.max(...path.map(p => curveGap(p, comparison.path)))
  assert(bernToOsmMetres <= 20 && osmToBernMetres <= 20, 'Independent corridor disagreement')
  return { path, lengthMetres, directMetres: distanceMetres(...stops), attachments,
    directedSourceSegments: [{ wayId: way.id, version: way.version, timestamp: way.timestamp, direction: index ? 'backward' : 'forward', from: a, to: b, nodeIds: ids }],
    comparison: { ...comparison, bernToOsmMetres, osmToBernMetres, sourceId: 300, method: 'Maximum source vertex to other polyline distance in both directions, not continuous lane accuracy.' }, restrictionRecordsChecked: source.restrictions.length }
}
export function boltigenReview(cache, baseline, policy, source) {
  assert.equal(policy.agencyId, '834'); assert.equal(policy.routeId, BOLTIGEN_ROUTE)
  assert.deepEqual(policy.dates, ['2026-09-04', '2026-09-06']); assert.deepEqual(policy.dates, cache.metadata.dates)
  const contexts = Object.entries(cache.agencies['834'].identities).filter(([, p]) => p.routeId === BOLTIGEN_ROUTE)
  assert.deepEqual(contexts.map(([id, p]) => ({ id, ...p })), policy.patterns); assert.equal(contexts.length, 2); assert.equal(policy.pairs.length, 2)
  const candidates = new Map(baseline), assessments = []
  for (const [i, pair] of policy.pairs.entries()) {
    const key = JSON.stringify([BOLTIGEN_ROUTE, ...BOLTIGEN_PAIRS[i]]), original = baseline.get(key), geometry = boltigenPath(source, policy, i)
    assert.equal(original?.reason, 'road-excessive-detour'); assert(!original.path, 'Never replace accepted road geometry')
    const contributingPatterns = []
    for (const [id, p] of contexts) for (let j = 1; j < p.stops.length; j++) {
      if (p.stops[j - 1][4] !== pair.stops[0][4] || p.stops[j][4] !== pair.stops[1][4]) continue
      assert.deepEqual(p.stops.slice(j - 1, j + 1), pair.stops)
      assert.equal(p.stops.filter(s => BOLTIGEN_PAIRS.flat().includes(s[4])).length, 2)
      const others = p.stops.filter((_, k) => k !== j - 1 && k !== j)
      assert(others.every(s => curveGap(s, geometry.path) > 50), 'Out-of-order called stop near reviewed hairpins')
      contributingPatterns.push(id)
    }
    assert.deepEqual(contributingPatterns.sort(), original.roadPatternIds); assert.equal(contributingPatterns.length, 1)
    candidates.set(key, { ...geometry, agencyId: '834', geometrySource: 'osm-road-inference', roadPatternIds: contributingPatterns,
      roadContextOccurrences: 1, sourceFeatures: [source.way.id], primaryRoadFailure: original,
      roadReview: { id: policy.id, kind: 'boltigen-corroborated-hairpins', sourceSha256: policy.sources[0].sha256 } })
    assessments.push({ key, ...geometry, contributingPatterns, primaryFailure: original })
  }
  return { candidates, audit: { policy, assessments, sourceInventory: source } }
}
export async function loadBoltigen(cache, baseline, config) {
  const bytes = await readFile(config.file); assert.equal(sha256(bytes), config.sha256)
  const policy = JSON.parse(bytes); assert.equal(sha256(await readFile('data/fribourg-road-cache.json')), policy.roadCacheSha256)
  for (const s of policy.sources) assert.equal(sha256(await readFile(s.repositoryFile ?? `${policy.sourceDirectory}/${s.file}`)), s.sha256)
  return boltigenReview(cache, baseline, policy, decodeBoltigen(`${policy.sourceDirectory}/map.osm.gz`))
}
