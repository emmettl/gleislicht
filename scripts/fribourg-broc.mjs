import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './fribourg-timetable.mjs'
export const BROC_ROUTE = '92-260-j26-1'
export const BROC_STOPS = ['ch:1:sloid:77727:0:10', 'ch:1:sloid:77727:0:19835']
export const decodeBroc = file => JSON.parse(execFileSync('python3', ['scripts/fribourg_broc.py', file], { maxBuffer: 1024 * 1024 }))

export function brocPath(source, policy) {
  assert.equal(policy.maximumAttachmentMetres, 10); assert.equal(policy.maximumLengthMetres, 35)
  assert.deepEqual(policy.stops.map(s => s[4]), BROC_STOPS)
  const way = source.ways.find(w => w.id === '1395561049'), nodes = new Map(source.nodes.map(n => [n.id, n]))
  assert.deepEqual(way?.nodes, ['370444709', '3313999352'])
  assert.equal(way.tags.highway, 'service'); assert.equal(way.tags.oneway, 'yes'); assert.equal(way.tags.name, 'La Gare')
  const records = [way, ...way.nodes.map(id => nodes.get(id))]
  for (const record of records) {
    assert(record && record.timestamp < '2026-09-04', 'Source edited after fixtures')
    assert(!Object.keys(record.tags).some(k => /conditional|restriction|barrier/.test(k)), 'Unreviewed station restriction')
    for (const key of ['access', 'vehicle', 'motor_vehicle', 'psv', 'bus']) assert(!record.tags[key] || ['yes', 'designated'].includes(record.tags[key]), 'Unreviewed station access')
  }
  assert.equal(nodes.get('3313999352').tags.uic_ref, '8577727'); assert.equal(nodes.get('3313999352').tags.public_transport, 'stop_position')
  assert.equal(source.restrictions.filter(r => r.members.some(m => m.type === 'way' && m.ref === way.id || m.type === 'node' && way.nodes.includes(m.ref))).length, 0, 'Touching station turn restriction')
  const [a, b] = way.nodes.map(id => nodes.get(id).coordinate), stop = policy.stops[0]
  // Local metric projection onto this single explicitly reviewed directed source edge.
  const scale = Math.cos((a[1] + b[1]) / 2 * Math.PI / 180)
  const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1]
  const fraction = ((stop[0] - a[0]) * scale * dx + (stop[1] - a[1]) * dy) / (dx * dx + dy * dy)
  assert(fraction > 0 && fraction < 1, 'Arrival projection outside directed edge')
  const projected = a.map((n, i) => n + fraction * (b[i] - n))
  const attachmentsMetres = [distanceMetres(stop, projected), distanceMetres(policy.stops[1], b)]
  assert(attachmentsMetres.every(m => m <= 10), 'Station call exceeds reviewed attachment bound')
  const sourceMetres = distanceMetres(projected, b)
  assert(sourceMetres >= 5 && sourceMetres <= 20, 'Unreviewed or collapsed station source section')
  const path = [stop.slice(0, 2), projected, b, policy.stops[1].slice(0, 2)].map(p => p.map(n => Number(n.toFixed(7))))
  const lengthMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
  assert(lengthMetres > 15 && lengthMetres <= 35, 'Unreviewed station movement length')
  return { path, lengthMetres, sourceMetres, attachmentsMetres, sourceFraction: fraction, sourceProjection: projected,
    directedSourceSegments: [{ wayId: way.id, version: way.version, timestamp: way.timestamp, direction: 'forward', fromFraction: fraction, toFraction: 1, nodeIds: way.nodes }], restrictionRecordsChecked: source.restrictions.length }
}

export function brocReview(cache, baseline, policy, source) {
  assert.equal(policy.agencyId, '834'); assert.equal(policy.routeId, BROC_ROUTE)
  assert.deepEqual(policy.dates, ['2026-09-04', '2026-09-06']); assert.deepEqual(policy.dates, cache.metadata.dates)
  const contexts = Object.entries(cache.agencies['834'].identities).filter(([, p]) => p.routeId === BROC_ROUTE)
  assert.equal(contexts.length, 10)
  assert.deepEqual(contexts.map(([id, p]) => ({ id, ...p })), policy.patterns, 'Changed complete route-260 pattern inventory')
  const key = JSON.stringify([BROC_ROUTE, ...BROC_STOPS]), original = baseline.get(key)
  assert.equal(original?.reason, 'road-matcher-rejected'); assert(!original.path, 'Never replace accepted geometry')
  const geometry = brocPath(source, policy), contributingPatterns = []
  for (const [id, p] of contexts) for (let i = 1; i < p.stops.length; i++) {
    if (p.stops[i - 1][4] !== BROC_STOPS[0] || p.stops[i][4] !== BROC_STOPS[1]) continue
    assert.deepEqual(p.stops.slice(i - 1, i + 1), policy.stops, 'Changed original Broc calls')
    assert.equal(p.stops[i - 2]?.[4], 'ch:1:sloid:77726:0:15909', 'Unreviewed incoming branch')
    assert.equal(p.stops[i + 1]?.[4], 'ch:1:sloid:77728:0:15874', 'Unreviewed outgoing branch')
    assert(p.stops.filter(s => BROC_STOPS.includes(s[4])).length === 2, 'Repeated Broc calls')
    contributingPatterns.push(id)
  }
  assert.deepEqual(contributingPatterns.sort(), original.roadPatternIds); assert.equal(contributingPatterns.length, 2)
  const candidates = new Map(baseline)
  candidates.set(key, { ...geometry, agencyId: '834', geometrySource: 'osm-road-inference', roadPatternIds: contributingPatterns,
    roadContextOccurrences: 2, sourceFeatures: ['1395561049'], primaryRoadFailure: original,
    roadReview: { id: policy.id, kind: 'broc-station-calls', sourceSha256: policy.sources[0].sha256 } })
  return { candidates, audit: { policy, geometry, contributingPatterns, primaryFailure: original, sourceInventory: source } }
}

export async function loadBroc(cache, baseline, config) {
  const bytes = await readFile(config.file); assert.equal(sha256(bytes), config.sha256)
  const policy = JSON.parse(bytes); assert.equal(sha256(await readFile('data/fribourg-road-cache.json')), policy.roadCacheSha256)
  for (const s of policy.sources) assert.equal(sha256(await readFile(`${policy.sourceDirectory}/${s.file}`)), s.sha256)
  return brocReview(cache, baseline, policy, decodeBroc(`${policy.sourceDirectory}/map.osm.gz`))
}
