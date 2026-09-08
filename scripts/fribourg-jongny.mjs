import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { bernGraph, BERN_LIMITS } from './bern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './fribourg-timetable.mjs'

export const decodeJongny = file => JSON.parse(execFileSync('python3', ['scripts/fribourg_jongny.py', file], { maxBuffer: 4 * 1024 * 1024 }))
export const JONGNY_ROUTES = ['92-213-j26-1', '92-216-j26-1', '92-217-j26-1']
export const JONGNY_STOPS = ['ch:1:sloid:4959:0:2', 'ch:1:sloid:4963:0:4']

function nearestCurveDistance(point, path) {
  let best = Infinity
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], factor = Math.cos(point[1] * Math.PI / 180)
    const dx = (b[0] - a[0]) * factor, dy = b[1] - a[1], denominator = dx * dx + dy * dy
    const t = denominator ? Math.max(0, Math.min(1, ((point[0] - a[0]) * factor * dx + (point[1] - a[1]) * dy) / denominator)) : 0
    best = Math.min(best, distanceMetres(point, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]))
  }
  return best
}

export function jongnyCantonalEvidence(decoded, policy, path) {
  return [43, 44, 45].map((sourceId, i) => {
    const feature = decoded.lines.find(f => f.properties.OBJECTID === sourceId)
    assert.equal(feature.properties.NUMERO_LIGNE, ['10.213', '10.216', '10.217'][i])
    const graph = bernGraph([feature]), primary = matchBaselSegment(graph, ...policy.stops, BERN_LIMITS.bus)
    assert.equal(primary.reason, 'implausible-detour', 'Changed original cantonal failure')
    // Diagnostic reconstruction only; this relaxed call cannot admit a cantonal path.
    const diagnostic = matchBaselSegment(graph, ...policy.stops, { ...BERN_LIMITS.bus, detourRatio: 5 })
    assert(diagnostic.path && diagnostic.pathMetres <= 2050)
    const cantonalToOsmMetres = Math.max(...diagnostic.path.map(p => nearestCurveDistance(p, path)))
    const osmToCantonalMetres = Math.max(...path.map(p => nearestCurveDistance(p, diagnostic.path)))
    assert(cantonalToOsmMetres <= 10 && osmToCantonalMetres <= 10, 'Current route chain disagrees with cantonal source')
    return { sourceId, primary, diagnosticPath: diagnostic.path, diagnosticLengthMetres: diagnostic.pathMetres,
      cantonalToOsmMetres, osmToCantonalMetres, method: 'Maximum original vertex to other polyline distance, both directions; diagnostic only, not a lane/survey accuracy claim.' }
  })
}

export function jongnyPath(source, policy) {
  assert.equal(policy.maximumLengthMetres, 2050); assert.equal(policy.maximumAttachmentMetres, 15)
  const ways = new Map(source.ways.map(w => [w.id, w])), nodes = new Map(source.nodes.map(n => [n.id, n]))
  assert.equal(ways.size, 10); assert.equal(nodes.size, source.nodes.length)
  const ids = [], segments = []
  for (const c of policy.chain) {
    const w = ways.get(c.wayId); assert(w, 'Missing reviewed Jongny way')
    assert.equal(w.tags.highway, 'primary'); assert.equal(w.tags.ref, '12')
    assert(!Object.keys(w.tags).some(k => /conditional|restriction/.test(k)), 'Unreviewed conditional access')
    for (const key of ['access', 'vehicle', 'motor_vehicle', 'psv', 'bus']) assert(!w.tags[key] || ['yes', 'designated'].includes(w.tags[key]), 'Unreviewed road access')
    const start = w.nodes.indexOf(c.from), end = w.nodes.indexOf(c.to)
    assert(start >= 0 && end >= 0 && start !== end, 'Missing source chain endpoint')
    const forward = start < end
    assert.equal(c.direction, forward ? 'forward' : 'backward')
    assert(!w.tags.oneway || ['no', 'yes'].includes(w.tags.oneway), 'Unknown one-way rule')
    if (w.tags.oneway === 'yes' || w.tags.junction === 'roundabout') assert(forward, 'Wrong source road direction')
    const selected = forward ? w.nodes.slice(start, end + 1) : w.nodes.slice(end, start + 1).reverse()
    assert.equal(new Set(selected).size, selected.length, 'Repeated source node')
    if (ids.length) assert.equal(ids.at(-1), selected[0], 'Disconnected source chain')
    ids.push(...selected.slice(ids.length ? 1 : 0))
    segments.push({ ...c, nodeIds: selected, version: w.version, timestamp: w.timestamp, tags: w.tags })
  }
  assert.equal(new Set(ids).size, ids.length, 'Source path loops through an earlier node')
  const touching = source.restrictions.filter(r => r.members.some(m => m.type === 'way' && ways.has(m.ref) || m.type === 'node' && ids.includes(m.ref)))
  assert.equal(touching.length, 0, 'Jongny chain needs turn-restriction review')
  for (const expected of policy.relations) {
    const r = source.relations.find(r => r.id === expected.id); assert(r)
    assert.equal(r.tags['gtfs:route_id'], expected.routeId); assert.equal(r.tags.route, 'bus')
    assert.equal(r.tags.operator, 'VMCV'); assert.equal(r.tags.to, 'Vevey, Gare')
    const calls = r.members.filter(m => m.type === 'node' && m.role.startsWith('stop')).map(m => m.ref)
    const i = calls.indexOf(ids[0]); assert(i >= 0); assert.equal(calls[i + 1], ids.at(-1), 'Changed directed relation stop order')
    const members = r.members.filter(m => m.type === 'way' && m.role === '').map(m => m.ref)
    const a = members.indexOf(policy.chain[0].wayId), b = members.indexOf(policy.chain.at(-1).wayId)
    assert(a >= 0 && b >= a)
    assert.deepEqual(members.slice(a, b + 1), policy.chain.map(c => c.wayId), 'Route relations disagree on source way chain')
  }
  const coordinates = ids.map(id => { assert(nodes.has(id)); return nodes.get(id).coordinate })
  for (const [i, id] of [ids[0], ids.at(-1)].entries()) {
    const n = nodes.get(id)
    assert.equal(n.tags.uic_ref, i ? '8504963' : '8504959')
    assert.equal(n.tags.uic_name, policy.stops[i][2]); assert.equal(n.tags.public_transport, 'stop_position')
  }
  const attachmentsMetres = policy.stops.map((s, i) => distanceMetres(s, i ? coordinates.at(-1) : coordinates[0]))
  assert(attachmentsMetres.every(m => m <= policy.maximumAttachmentMetres), 'Changed exact Jongny platform location')
  const path = [policy.stops[0].slice(0, 2), ...coordinates, policy.stops[1].slice(0, 2)].map(p => p.map(n => +n.toFixed(7)))
  const lengthMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
  assert(lengthMetres > 1900 && lengthMetres <= policy.maximumLengthMetres, 'Unreviewed Jongny path length')
  return { path, lengthMetres, directMetres: distanceMetres(...policy.stops), attachmentsMetres,
    directedSourceSegments: segments, restrictionRecordsChecked: source.restrictions.length }
}

export function jongnyReview(cache, baseline, policy, source) {
  assert.equal(policy.agencyId, '876'); assert.deepEqual(policy.routeIds, JONGNY_ROUTES)
  assert.deepEqual(policy.stops.map(s => s[4]), JONGNY_STOPS)
  assert.deepEqual(policy.dates, cache.metadata.dates)
  const contexts = Object.entries(cache.agencies['876'].identities).filter(([, p]) => JONGNY_ROUTES.includes(p.routeId))
  assert.deepEqual(contexts.map(([id, p]) => ({ id, ...p })), policy.patterns, 'Changed complete VMCV pattern inventory')
  const geometry = jongnyPath(source, policy), candidates = new Map(baseline), assessments = []
  for (const routeId of JONGNY_ROUTES) {
    const key = JSON.stringify([routeId, ...JONGNY_STOPS]), original = baseline.get(key)
    assert.equal(original?.reason, 'road-excessive-detour', 'Changed primary Jongny failure')
    const patterns = []
    for (const [id, p] of contexts.filter(([, p]) => p.routeId === routeId)) for (let i = 1; i < p.stops.length; i++) {
      if (p.stops[i - 1][4] !== JONGNY_STOPS[0] || p.stops[i][4] !== JONGNY_STOPS[1]) continue
      assert.deepEqual(p.stops.slice(i - 1, i + 1), policy.stops, 'Changed original directed platforms')
      const others = p.stops.filter((_, j) => j !== i - 1 && j !== i)
      assert(others.every(s => !JONGNY_STOPS.includes(s[4])), 'Repeated source stop in full context')
      assert(others.every(s => geometry.path.every(point => distanceMetres(s, point) > 30)), 'Another called stop within reviewed corridor')
      patterns.push(id)
    }
    assert.deepEqual(patterns.sort(), original.roadPatternIds)
    const candidate = { ...geometry, agencyId: '876', geometrySource: 'osm-road-inference', roadPatternIds: patterns,
      roadContextOccurrences: patterns.length, sourceFeatures: policy.chain.map(c => c.wayId), primaryRoadFailure: original,
      roadReview: { id: policy.id, kind: 'jongny-route-chain', sourceSha256: policy.sources[0].sha256 } }
    candidates.set(key, candidate); assessments.push({ key, contributingPatterns: patterns, primaryFailure: original })
  }
  assert.equal(assessments.reduce((n, a) => n + a.contributingPatterns.length, 0), 7)
  return { candidates, audit: { policy, geometry, assessments, sourceInventory: source } }
}

export async function loadJongny(cache, baseline, config) {
  const bytes = await readFile(config.file); assert.equal(sha256(bytes), config.sha256, 'Changed Jongny review policy')
  const policy = JSON.parse(bytes)
  assert.equal(sha256(await readFile('data/fribourg-road-cache.json')), policy.roadCacheSha256)
  for (const s of policy.sources) assert.equal(sha256(await readFile(`${policy.sourceDirectory}/${s.file}`)), s.sha256, 'Changed Jongny source bytes')
  const result = jongnyReview(cache, baseline, policy, decodeJongny(`${policy.sourceDirectory}/map.osm.gz`))
  const bytesSource = await readFile('data/fribourg-sources/decoded.json.gz')
  assert.equal(sha256(bytesSource), policy.cantonalSourceSha256)
  result.audit.cantonalComparison = jongnyCantonalEvidence(JSON.parse(gunzipSync(bytesSource)), policy, result.audit.geometry.path)
  return result
}
