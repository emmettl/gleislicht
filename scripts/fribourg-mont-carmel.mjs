import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './fribourg-timetable.mjs'

export const decodeMontCarmel = file => JSON.parse(execFileSync('python3', ['scripts/fribourg_mont_carmel.py', file], { maxBuffer: 4 * 1024 * 1024 }))

export function montCarmelPath(source, policy) {
  const ways = new Map(source.ways.map(w => [w.id, w])), nodes = new Map(source.nodes.map(n => [n.id, n]))
  assert.equal(ways.size, 3); assert.equal(nodes.size, source.nodes.length)
  assert.deepEqual(policy.chain.map(c => c.wayId), ['1097802067', '55700630', '1095950865'])
  const ordered = [], segments = []
  for (const c of policy.chain) {
    const way = ways.get(c.wayId); assert(way, 'Missing reviewed terminal way')
    assert.equal(way.tags.highway, 'primary'); assert.equal(way.tags.trolley_wire, 'yes')
    assert(!Object.keys(way.tags).some(k => /conditional|restriction/.test(k)), 'Unreviewed conditional road rule')
    for (const key of ['access', 'vehicle', 'motor_vehicle', 'psv', 'bus']) assert(!way.tags[key] || ['yes', 'designated'].includes(way.tags[key]), 'Unreviewed road access')
    if (c.wayId === '55700630') {
      assert.equal(way.tags.junction, 'roundabout'); assert(!way.tags.oneway || way.tags.oneway === 'yes')
    } else assert.equal(way.tags.oneway, 'yes', 'Changed directed terminal approach')
    const start = way.nodes.indexOf(c.from), end = way.nodes.indexOf(c.to)
    assert(start >= 0 && end > start, 'Terminal chain opposes source direction')
    const ids = way.nodes.slice(start, end + 1)
    assert.equal(new Set(ids).size, ids.length, 'Repeated terminal source node')
    if (ordered.length) assert.equal(ordered.at(-1), ids[0], 'Disconnected terminal source ways')
    ordered.push(...ids.slice(ordered.length ? 1 : 0))
    segments.push({ wayId: way.id, version: way.version, timestamp: way.timestamp, from: c.from, to: c.to, nodeIds: ids, direction: 'forward', tags: way.tags })
  }
  // Fail closed if the snapshot contains any restriction involving these ways or nodes.
  const touching = source.restrictions.filter(r => r.members.some(m => m.type === 'way' && ways.has(m.ref) || m.type === 'node' && ordered.includes(m.ref)))
  assert.equal(touching.length, 0, 'Terminal chain requires turn-restriction review')
  const coordinates = ordered.map(id => { assert(nodes.has(id), 'Missing terminal source node'); return nodes.get(id).coordinate })
  const attachments = policy.stops.map((s, i) => distanceMetres(s, i ? coordinates.at(-1) : coordinates[0]))
  assert.equal(policy.maximumAttachmentMetres, 15)
  assert(attachments.every(m => m <= policy.maximumAttachmentMetres), 'Terminal platform too far from exact OSM stop')
  for (const [i, id] of [ordered[0], ordered.at(-1)].entries()) {
    const n = nodes.get(id)
    assert.equal(n.tags.uic_ref, '8587238'); assert.equal(n.tags.public_transport, 'stop_position')
    assert.equal(n.tags.trolleybus, 'yes'); assert.equal(n.tags.name, policy.stops[i][2])
  }
  for (const relation of policy.relations) {
    const actual = source.relations.find(r => r.id === relation.id)
    assert(actual && actual.tags.ref === '3' && actual.tags.route === 'trolleybus')
    assert(actual.members.some(m => m.type === 'node' && m.ref === relation.stopNode && m.role === relation.role), 'Changed route-3 terminal role')
  }
  const path = [policy.stops[0].slice(0, 2), ...coordinates, policy.stops[1].slice(0, 2)].map(p => p.map(n => Number(n.toFixed(7))))
  const lengthMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
  assert(lengthMetres >= 50 && lengthMetres <= 250, 'Unreviewed terminal movement length')
  return { path, lengthMetres, directMetres: distanceMetres(...policy.stops), attachmentsMetres: attachments, directedSourceSegments: segments,
    restrictionRecordsChecked: source.restrictions.length }
}

export function montCarmelReview(cache, baseline, policy, source) {
  assert.equal(policy.agencyId, '834'); assert.equal(policy.routeId, '92-3-A-j26-1')
  assert.deepEqual(policy.dates, cache.metadata.dates, 'Changed terminal validation dates')
  assert.deepEqual(policy.stops.map(s => s[4]), ['ch:1:sloid:87238:0:15107', 'ch:1:sloid:87238:0:15108'])
  const contexts = Object.entries(cache.agencies[policy.agencyId].identities).filter(([, p]) => p.routeId === policy.routeId)
  assert.deepEqual(contexts.map(([id, identity]) => ({ id, ...identity })), policy.patterns, 'Changed full route-3 pattern inventory')
  const key = JSON.stringify([policy.routeId, ...policy.stops.map(s => s[4])]), original = baseline.get(key)
  assert.equal(original?.reason, 'road-matcher-rejected', 'Primary terminal failure changed')
  const geometry = montCarmelPath(source, policy), contributingPatterns = []
  for (const [id, p] of contexts) for (let i = 1; i < p.stops.length; i++) {
    if (p.stops[i - 1][4] !== policy.stops[0][4] || p.stops[i][4] !== policy.stops[1][4]) continue
    assert.equal(i, p.stops.length - 1, 'Reviewed movement must terminate the full journey')
    assert.deepEqual(p.stops.slice(i - 1), policy.stops, 'Changed terminal platform records')
    assert(p.stops.slice(0, i - 1).every(s => !policy.stops.some(t => t[4] === s[4])), 'Repeated terminal earlier in full pattern')
    assert(p.stops.slice(0, i - 1).every(s => geometry.path.every(point => distanceMetres(s, point) > 30)), 'Other called stop within terminal movement')
    contributingPatterns.push(id)
  }
  assert.deepEqual(contributingPatterns.sort(), original.roadPatternIds)
  assert.equal(contributingPatterns.length, 2)
  const candidates = new Map(baseline)
  candidates.set(key, { ...geometry, agencyId: policy.agencyId, geometrySource: 'osm-road-inference',
    roadPatternIds: contributingPatterns, roadContextOccurrences: contributingPatterns.length,
    sourceFeatures: policy.chain.map(c => c.wayId), primaryRoadFailure: original,
    roadReview: { id: policy.id, kind: 'mont-carmel-terminal', sourceSha256: policy.sources[0].sha256 } })
  return { candidates, audit: { policy, geometry, contributingPatterns, primaryFailure: original, sourceInventory: source } }
}

export async function loadMontCarmel(cache, baseline, config) {
  const bytes = await readFile(config.file)
  assert.equal(sha256(bytes), config.sha256, 'Changed Mont-Carmel review policy')
  const policy = JSON.parse(bytes)
  assert.equal(sha256(await readFile('data/fribourg-road-cache.json')), policy.roadCacheSha256)
  for (const s of policy.sources) assert.equal(sha256(await readFile(`${policy.sourceDirectory}/${s.file}`)), s.sha256, 'Changed terminal source bytes')
  const source = decodeMontCarmel(`${policy.sourceDirectory}/map.osm.gz`)
  return montCarmelReview(cache, baseline, policy, source)
}
