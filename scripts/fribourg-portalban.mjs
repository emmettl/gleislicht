import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './fribourg-timetable.mjs'
export const PORTALBAN_ROUTE = '92-544-j26-1'
export const PORTALBAN_PAIRS = [
  ['ch:1:sloid:10187:0:1', 'ch:1:sloid:4547:0:15626'],
  ['ch:1:sloid:4547:0:15627', 'ch:1:sloid:10187:0:1'],
]
export const decodePortalban = file => JSON.parse(execFileSync('python3', ['scripts/fribourg_portalban.py', file], { maxBuffer: 4 * 1024 * 1024 }))
function project(point, coordinates) {
  return coordinates.slice(1).map((b, i) => {
    const a = coordinates[i], scale = Math.cos(point[1] * Math.PI / 180), dx = (b[0] - a[0]) * scale, dy = b[1] - a[1]
    assert(dx || dy, 'Collapsed source edge')
    const fraction = Math.max(0, Math.min(1, ((point[0] - a[0]) * scale * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    const coordinate = a.map((v, j) => v + fraction * (b[j] - v))
    return { segment: i, fraction, position: i + fraction, coordinate, gapMetres: distanceMetres(point, coordinate) }
  }).sort((a, b) => a.gapMetres - b.gapMetres || a.position - b.position)[0]
}
export function portalbanPath(source, policy, index) {
  assert.equal(policy.maximumAttachmentMetres, 10); assert.equal(policy.maximumLengthMetres, 130)
  const ways = new Map(source.ways.map(w => [w.id, w])), nodes = new Map(source.nodes.map(n => [n.id, n]))
  assert.equal(ways.size, 3); assert.equal(nodes.size, source.nodes.length)
  const definitions = [['43121098', 'Chemin du Four', 'residential'], ['464228790', 'Chemin du Ruisseau', 'residential'], ['1433895409', 'La Râpe', 'tertiary']]
  for (const [id, name, highway] of definitions) {
    const w = ways.get(id); assert(w); assert.equal(w.tags.name, name); assert.equal(w.tags.highway, highway)
    assert(!w.tags.oneway || w.tags.oneway === 'no', 'Changed bidirectional street')
    assert.equal(new Set(w.nodes).size, w.nodes.length)
    for (const e of [w, ...w.nodes.map(id => nodes.get(id))]) {
      assert(e && e.timestamp < '2026-09-04', 'Missing or post-fixture source object')
      assert(!Object.keys(e.tags).some(k => /conditional|restriction|barrier/.test(k)), 'Unreviewed street restriction')
      for (const k of ['access', 'vehicle', 'motor_vehicle', 'psv', 'bus']) assert(!e.tags[k] || ['yes', 'designated'].includes(e.tags[k]), 'Unreviewed street access')
    }
  }
  const touching = source.restrictions.filter(r => r.members.some(m => m.type === 'way' && ways.has(m.ref) || m.type === 'node' && source.ways.some(w => w.nodes.includes(m.ref))))
  assert.equal(touching.length, 0, 'Unreviewed touching turn restriction')
  const stops = policy.pairs[index].stops
  assert.deepEqual(stops.map(s => s[4]), PORTALBAN_PAIRS[index])
  const school = index ? stops[1] : stops[0], village = index ? stops[0] : stops[1]
  const first = ways.get('43121098'), middle = ways.get('464228790'), last = ways.get('1433895409')
  assert.equal(first.nodes[0], '540239211'); assert.equal(last.nodes.at(-1), '5141566792')
  const start = middle.nodes.indexOf('540239211'), end = middle.nodes.indexOf('5141566792')
  assert(start >= 0 && end > start)
  const a = project(school, first.nodes.map(id => nodes.get(id).coordinate)), b = project(village, last.nodes.map(id => nodes.get(id).coordinate))
  assert(a.position > 0 && b.position < last.nodes.length - 1, 'Collapsed street attachment')
  assert(a.gapMetres <= 10 && b.gapMetres <= 10, 'Original platform exceeds street attachment guard')
  let ids = [...first.nodes.filter((_, i) => i < a.position).reverse(), ...middle.nodes.slice(start + 1, end + 1), ...last.nodes.filter((_, i) => i > b.position).reverse().slice(1)]
  assert.equal(new Set(ids).size, ids.length, 'Repeated street-chain node')
  let path = [school.slice(0, 2), a.coordinate, ...ids.map(id => nodes.get(id).coordinate), b.coordinate, village.slice(0, 2)]
  if (index) { path.reverse(); ids.reverse() }
  path = path.map(p => p.map(n => Number(n.toFixed(7))))
  const lengthMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
  assert(lengthMetres > 90 && lengthMetres <= 130, 'Unreviewed street-chain length')
  return { path, lengthMetres, directMetres: distanceMetres(...stops), attachments: index ? [b, a] : [a, b], nodeIds: ids,
    directedSourceWays: index ? [['1433895409', 'forward'], ['464228790', 'backward'], ['43121098', 'forward']] : [['43121098', 'backward'], ['464228790', 'forward'], ['1433895409', 'backward']],
    restrictionRecordsChecked: source.restrictions.length }
}
export function portalbanReview(cache, baseline, policy, source) {
  assert.equal(policy.agencyId, '834'); assert.equal(policy.routeId, PORTALBAN_ROUTE)
  assert.deepEqual(policy.dates, ['2026-09-04', '2026-09-06']); assert.deepEqual(policy.dates, cache.metadata.dates)
  const agency = cache.agencies['834'], contexts = Object.entries(agency.identities).filter(([, p]) => p.routeId === PORTALBAN_ROUTE)
  assert.deepEqual(contexts.map(([id, p]) => ({ id, ...p })), policy.patterns); assert.equal(policy.pairs.length, 2)
  const candidates = new Map(baseline), assessments = []
  for (const [i, pair] of policy.pairs.entries()) {
    const key = JSON.stringify([PORTALBAN_ROUTE, ...PORTALBAN_PAIRS[i]]), original = baseline.get(key), geometry = portalbanPath(source, policy, i)
    assert.equal(original?.reason, 'road-pattern-dependent-path'); assert(!original.path, 'Never replace accepted road geometry')
    const contributingPatterns = [], originalPaths = []
    for (const [id, p] of contexts) for (let j = 1; j < p.stops.length; j++) {
      if (p.stops[j - 1][4] !== pair.stops[0][4] || p.stops[j][4] !== pair.stops[1][4]) continue
      assert.deepEqual(p.stops.slice(j - 1, j + 1), pair.stops)
      assert.equal(p.stops.filter(s => PORTALBAN_PAIRS.flat().includes(s[4])).length, 2)
      assert(p.stops.filter((_, k) => k !== j - 1 && k !== j).every(s => project(s, geometry.path).gapMetres > 50), 'Out-of-order called stop near reviewed streets')
      contributingPatterns.push(id)
      const pathIndex = agency.cache.patterns[id][j - 1]
      assert(Number.isInteger(pathIndex), 'Rejected original matcher occurrence')
      originalPaths.push({ patternId: id, pathIndex, path: agency.cache.paths[pathIndex] })
    }
    assert.deepEqual(contributingPatterns.sort(), original.roadPatternIds); assert.equal(contributingPatterns.length, i ? 4 : 5)
    candidates.set(key, { ...geometry, agencyId: '834', geometrySource: 'osm-road-inference', roadPatternIds: contributingPatterns,
      roadContextOccurrences: contributingPatterns.length, sourceFeatures: source.ways.map(w => w.id), primaryRoadFailure: original,
      roadReview: { id: policy.id, kind: 'portalban-school-streets', sourceSha256: policy.sources[0].sha256 } })
    assessments.push({ key, ...geometry, contributingPatterns, originalPaths, primaryFailure: original })
  }
  return { candidates, audit: { policy, assessments, sourceInventory: source } }
}
export async function loadPortalban(cache, baseline, config) {
  const bytes = await readFile(config.file); assert.equal(sha256(bytes), config.sha256)
  const policy = JSON.parse(bytes); assert.equal(sha256(await readFile('data/fribourg-road-cache.json')), policy.roadCacheSha256)
  for (const s of policy.sources) assert.equal(sha256(await readFile(`${policy.sourceDirectory}/${s.file}`)), s.sha256)
  return portalbanReview(cache, baseline, policy, decodePortalban(`${policy.sourceDirectory}/map.osm.gz`))
}
