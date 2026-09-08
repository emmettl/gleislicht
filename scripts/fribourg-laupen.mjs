import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './fribourg-timetable.mjs'

export const LAUPEN_ROUTE = '96-881-j26-1'
export const LAUPEN_PAIRS = [
  ['ch:1:sloid:70554:0:323303', 'ch:1:sloid:70555:0:83983'],
  ['ch:1:sloid:70554:0:323303', 'ch:1:sloid:70555:0:602697'],
  ['ch:1:sloid:70555:0:602697', 'ch:1:sloid:70554:0:65751'],
]
const ANCHORS = [['308077056', '1408214299'], ['308077056', '983847733'], ['983847733', '8945081564']]
const WEST_WAYS = ['1218962505', '1218962506', '1218939917', '1218944698', '1311028303', '1311028296', '1311028295']
export const decodeLaupen = file => JSON.parse(execFileSync('python3', ['scripts/fribourg_laupen.py', file], { maxBuffer: 4 * 1024 * 1024 }))

export function directedLaupenNodes(way, c) {
  assert(['forward', 'backward'].includes(c.direction), 'Unknown source direction')
  const closed = way.nodes[0] === way.nodes.at(-1), ids = closed ? way.nodes.slice(0, -1) : way.nodes
  assert.equal(new Set(ids).size, ids.length, 'Repeated source way node')
  const start = ids.indexOf(c.from), end = ids.indexOf(c.to), step = c.direction === 'forward' ? 1 : -1
  assert(start >= 0 && end >= 0 && start !== end, 'Missing or collapsed source anchors')
  const one = way.tags.oneway ?? (way.tags.junction === 'roundabout' ? 'yes' : 'no')
  assert(['yes', 'no', '-1'].includes(one), 'Unknown one-way value')
  assert(one === 'no' || one === 'yes' && step === 1 || one === '-1' && step === -1, 'Opposes source one-way direction')
  const selected = [ids[start]]
  for (let i = start; i !== end;) {
    i += step
    if (closed) i = (i + ids.length) % ids.length
    assert(i >= 0 && i < ids.length && selected.length < ids.length, 'Unreviewed source wrap or full lap')
    selected.push(ids[i])
  }
  return selected
}

function checkAccess(tags) {
  assert(!Object.keys(tags).some(k => /conditional|restriction/.test(k)), 'Unreviewed conditional access')
  for (const key of ['access', 'vehicle', 'motor_vehicle', 'psv', 'bus']) assert(!tags[key] || ['yes', 'designated'].includes(tags[key]), 'Unreviewed vehicle access')
  assert(!tags.barrier || tags.barrier === 'entrance', 'Unreviewed barrier')
}

export function laupenPath(source, policy, index) {
  assert.equal(policy.maximumAttachmentMetres, 15)
  assert.deepEqual(policy.pairs.map(p => p.maximumLengthMetres), [2000, 2000, 2500])
  const pair = policy.pairs[index], ways = new Map(source.ways.map(w => [w.id, w])), nodes = new Map(source.nodes.map(n => [n.id, n]))
  assert.equal(ways.size, 29); assert.equal(nodes.size, source.nodes.length)
  assert.deepEqual(pair.stops.map(s => s[4]), LAUPEN_PAIRS[index])
  assert.deepEqual([pair.chain[0].from, pair.chain.at(-1).to], ANCHORS[index])
  assert.equal(new Set(pair.chain.map(c => c.wayId)).size, pair.chain.length, 'Repeated road way')
  for (const id of WEST_WAYS) assert(pair.chain.some(c => c.wayId === id), 'Missing documented western bypass section')
  assert.equal(ways.get('1311028296').tags.bridge, 'yes'); assert.equal(ways.get('1311028296').tags.name, 'Bauumfahrung West')
  const ordered = [], segments = []
  for (const c of pair.chain) {
    const w = ways.get(c.wayId); assert(w, 'Missing selected road way')
    assert(['secondary', 'tertiary', 'residential', 'service'].includes(w.tags.highway), 'Unusable road class or construction')
    assert.notEqual(w.tags.service, 'parking_aisle', 'Unreviewed parking shortcut')
    checkAccess(w.tags)
    const ids = directedLaupenNodes(w, c)
    if (ordered.length) assert.equal(ordered.at(-1), ids[0], 'Disconnected source chain')
    ordered.push(...ids.slice(ordered.length ? 1 : 0))
    segments.push({ ...c, version: w.version, timestamp: w.timestamp, nodeIds: ids, tags: w.tags })
  }
  assert.equal(new Set(ordered).size, ordered.length, 'Repeated source node in movement')
  const touching = source.restrictions.filter(r => r.members.some(m => m.type === 'way' && pair.chain.some(c => c.wayId === m.ref) || m.type === 'node' && ordered.includes(m.ref)))
  assert.equal(touching.length, 0, 'Turn restriction needs separate review')
  const coordinates = ordered.map(id => { const n = nodes.get(id); assert(n, 'Missing source node'); checkAccess(n.tags); return n.coordinate })
  const attachments = pair.stops.map((s, i) => distanceMetres(s, i ? coordinates.at(-1) : coordinates[0]))
  assert(attachments.every(m => m <= 15), 'Original platform too far from reviewed road anchor')
  for (const id of ['1408214299', '983847733']) {
    const n = nodes.get(id); assert.equal(n.tags.uic_ref, '8570555'); assert.equal(n.tags.public_transport, 'stop_position'); assert.equal(n.tags.bus, 'yes')
  }
  assert.equal(nodes.get('12135658380').tags.uic_ref, '8570554')
  assert.equal(nodes.get('308077071').tags.uic_ref, '8570554')
  const path = [pair.stops[0].slice(0, 2), ...coordinates, pair.stops[1].slice(0, 2)].map(p => p.map(n => Number(n.toFixed(7))))
  const lengthMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
  assert(lengthMetres > 1800 && lengthMetres <= pair.maximumLengthMetres, 'Unreviewed diversion length')
  return { path, lengthMetres, directMetres: distanceMetres(...pair.stops), attachmentsMetres: attachments,
    directedSourceSegments: segments, restrictionRecordsChecked: source.restrictions.length }
}

export function laupenReview(cache, baseline, policy, source) {
  assert.equal(policy.agencyId, '801'); assert.equal(policy.routeId, LAUPEN_ROUTE)
  assert.deepEqual(policy.dates, ['2026-09-04', '2026-09-06'], 'Diversion review is limited to the two fixture dates')
  assert.deepEqual(policy.dates, cache.metadata.dates)
  const contexts = Object.entries(cache.agencies['801'].identities).filter(([, p]) => p.routeId === LAUPEN_ROUTE)
  assert.deepEqual(contexts.map(([id, p]) => ({ id, ...p })), policy.patterns, 'Changed complete route-121 patterns')
  assert.equal(contexts.length, 6); assert.equal(policy.pairs.length, 3)
  const candidates = new Map(baseline), assessments = []
  for (const [index, pair] of policy.pairs.entries()) {
    const geometry = laupenPath(source, policy, index), key = JSON.stringify([LAUPEN_ROUTE, ...LAUPEN_PAIRS[index]]), original = baseline.get(key)
    assert.equal(original?.reason, index === 2 ? 'road-matcher-rejected' : 'road-excessive-detour', 'Changed primary Laupen failure')
    assert(!original.path, 'Never overwrite accepted road geometry')
    const contributingPatterns = []
    for (const [id, p] of contexts) for (let i = 1; i < p.stops.length; i++) {
      if (p.stops[i - 1][4] !== pair.stops[0][4] || p.stops[i][4] !== pair.stops[1][4]) continue
      assert.deepEqual(p.stops.slice(i - 1, i + 1), pair.stops, 'Changed original platform records')
      assert(index === 2 ? i === 1 : i === p.stops.length - 1, 'Station pair is not at full journey endpoint')
      const others = p.stops.filter((_, j) => j !== i - 1 && j !== i)
      assert(others.every(s => !pair.stops.some(t => t[4] === s[4])), 'Repeated reviewed stop in pattern')
      assert(others.every(s => geometry.path.every(point => distanceMetres(s, point) > 30)), 'Other called stop intersects reviewed movement')
      contributingPatterns.push(id)
    }
    assert.deepEqual(contributingPatterns.sort(), original.roadPatternIds)
    assert.equal(contributingPatterns.length, [2, 1, 3][index])
    candidates.set(key, { ...geometry, agencyId: policy.agencyId, geometrySource: 'osm-road-inference',
      roadPatternIds: contributingPatterns, roadContextOccurrences: contributingPatterns.length,
      sourceFeatures: pair.chain.map(c => c.wayId), primaryRoadFailure: original,
      roadReview: { id: policy.id, kind: 'laupen-western-bypass', sourceSha256: policy.sources[0].sha256 } })
    assessments.push({ key, ...geometry, contributingPatterns, primaryFailure: original })
  }
  return { candidates, audit: { policy, assessments, sourceInventory: source } }
}

export async function loadLaupen(cache, baseline, config) {
  const bytes = await readFile(config.file)
  assert.equal(sha256(bytes), config.sha256, 'Changed Laupen review policy')
  const policy = JSON.parse(bytes)
  assert.equal(sha256(await readFile('data/fribourg-road-cache.json')), policy.roadCacheSha256)
  for (const s of policy.sources) assert.equal(sha256(await readFile(`${policy.sourceDirectory}/${s.file}`)), s.sha256, 'Changed Laupen source bytes')
  return laupenReview(cache, baseline, policy, decodeLaupen(`${policy.sourceDirectory}/map.osm.gz`))
}
