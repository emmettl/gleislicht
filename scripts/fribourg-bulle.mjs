import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './fribourg-timetable.mjs'
export const BULLE_ROUTES = ['92-258-j26-1', '92-454-j26-1']
export const BULLE_PAIRS = [['ch:1:sloid:77725:0:15884', 'ch:1:sloid:93291:0:17067'], ['ch:1:sloid:77725:0:15898', 'ch:1:sloid:93291:0:17067']]
export const BULLE_ANCHOR = [7.051726, 46.620289]
const COMMON = [['1446630633', '13273200042', '13273200040'], ['129100337', '13273200040', '4459904043'], ['449022778', '4459904043', '4459904050'], ['128507000', '4459904050', '1420043598'], ['449022786', '1420043598', '4459904042']]
export const BULLE_CHAINS = [[['1446630640', '13273200096', '13273200080'], ['1446630636', '13273200080', '13273200042'], ...COMMON], [['1446630641', '13273200097', '13273200084'], ['1446630636', '13273200084', '13273200042'], ...COMMON]]
export const decodeBulle = file => JSON.parse(execFileSync('python3', ['scripts/fribourg_bulle.py', file], { maxBuffer: 4 * 1024 * 1024 }))
const length = path => path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
export function bullePrefix(source, policy, index) {
  assert.equal(policy.maximumAttachmentMetres, 6); assert.equal(policy.maximumPrefixMetres, 220); assert.equal(policy.maximumJoinMetres, 0.1); assert.equal(policy.maximumDestinationMetres, 0.1)
  assert.deepEqual(policy.cases[index].chain, BULLE_CHAINS[index])
  const ways = new Map(source.ways.map(w => [w.id, w])), nodes = new Map(source.nodes.map(n => [n.id, n]))
  assert.equal(ways.size, 11); assert.equal(nodes.size, source.nodes.length)
  const ordered = [], segments = []
  for (const [id, from, to] of BULLE_CHAINS[index]) {
    const w = ways.get(id); assert(w && !w.contextOnly)
    assert.equal(w.tags.highway, ['129100337', '449022778'].includes(id) ? 'residential' : ['128507000', '449022786'].includes(id) ? 'tertiary' : 'service')
    if (id === '129100337') assert(!w.tags.oneway)
    else if (id === '128507000') { assert.equal(w.tags.junction, 'roundabout'); assert(!w.tags.oneway || w.tags.oneway === 'yes') }
    else assert.equal(w.tags.oneway, 'yes', 'Changed directed station street')
    const busOnly = ['1446630640', '1446630641', '1446630636'].includes(id)
    if (busOnly) { assert.equal(w.tags.access, 'no'); assert.equal(w.tags.bus, 'designated'); assert.equal(w.tags.operator, 'TPF') }
    for (const e of [w, ...w.nodes.map(id => nodes.get(id))]) {
      assert(e && e.timestamp < '2026-09-04', 'Missing or post-fixture object')
      assert(!Object.keys(e.tags).some(k => /conditional|restriction|barrier/.test(k)), 'Unreviewed road restriction')
      for (const k of ['access', 'vehicle', 'motor_vehicle', 'psv', 'bus']) {
        if (e === w && busOnly && k === 'access') continue
        assert(!e.tags[k] || ['yes', 'designated'].includes(e.tags[k]), 'Unreviewed road access')
      }
    }
    let ids = w.nodes, start = ids.indexOf(from), end = ids.indexOf(to)
    assert(start >= 0 && end >= 0 && start !== end)
    if (id === '128507000') { assert.equal(ids[0], ids.at(-1)); ids = ids.slice(0, -1); assert.equal(new Set(ids).size, ids.length) }
    else { assert.equal(new Set(ids).size, ids.length); assert(end > start, 'Opposed source direction') }
    const selected = end > start ? ids.slice(start, end + 1) : [...ids.slice(start), ...ids.slice(0, end + 1)]
    if (ordered.length) assert.equal(ordered.at(-1), selected[0], 'Disconnected station chain')
    ordered.push(...selected.slice(ordered.length ? 1 : 0))
    segments.push({ wayId: id, version: w.version, timestamp: w.timestamp, nodeIds: selected, direction: 'forward', tags: w.tags })
  }
  assert.equal(new Set(ordered).size, ordered.length, 'Repeated station-chain node')
  const stop = policy.cases[index].stops[0], position = nodes.get(ordered[0])
  assert.equal(stop[3], index ? 'M' : 'L'); assert.equal(position.tags.ref, stop[3]); assert.equal(position.tags.uic_ref, '8577725'); assert.equal(position.tags.public_transport, 'stop_position'); assert.equal(position.tags.bus, 'yes')
  const attachmentMetres = distanceMetres(stop, position.coordinate), joinMetres = distanceMetres(nodes.get(ordered.at(-1)).coordinate, BULLE_ANCHOR)
  assert(attachmentMetres <= 6, 'Original platform attachment exceeds guard'); assert(joinMetres <= 0.1, 'Changed common-tail source join')
  const path = [stop.slice(0, 2), ...ordered.map(id => nodes.get(id).coordinate), BULLE_ANCHOR].map(p => p.map(n => Number(n.toFixed(7))))
  const lengthMetres = length(path); assert(lengthMetres > 180 && lengthMetres <= 220, 'Unreviewed station prefix length')
  const transitions = [...segments.slice(1).map((s, i) => [segments[i].wayId, s.nodeIds[0], s.wayId]), ['449022786', '4459904042', '1075813860']]
  const restrictionChecks = source.restrictions.map(r => {
    assert(r.timestamp < '2026-09-04'); assert.deepEqual(r.tags, { restriction: 'no_u_turn', type: 'restriction' }, 'Unreviewed turn rule')
    assert.deepEqual(r.members.map(m => [m.type, m.role]), [['way', 'from'], ['node', 'via'], ['way', 'to']])
    const prohibited = r.members.map(m => m.ref), violated = transitions.some(t => JSON.stringify(t) === JSON.stringify(prohibited))
    assert(!violated, 'Prohibited source turn')
    return { id: r.id, prohibited, violated }
  })
  assert.equal(restrictionChecks.length, 7)
  return { path, lengthMetres, attachmentMetres, joinMetres, segments, transitions, restrictionChecks }
}
export function bulleReview(cache, baseline, policy, source) {
  assert.equal(policy.agencyId, '834'); assert.deepEqual(policy.routeIds, BULLE_ROUTES)
  assert.deepEqual(policy.dates, ['2026-09-04', '2026-09-06']); assert.deepEqual(cache.metadata.dates, policy.dates)
  const agency = cache.agencies['834'], contexts = Object.entries(agency.identities).filter(([, p]) => BULLE_ROUTES.includes(p.routeId))
  assert.deepEqual(contexts.map(([id, p]) => ({ id, ...p })), policy.patterns); assert.equal(policy.cases.length, 2)
  const candidates = new Map(baseline), assessments = []
  for (const [i, c] of policy.cases.entries()) {
    assert.deepEqual(c.stops.map(s => s[4]), BULLE_PAIRS[i])
    const key = JSON.stringify([BULLE_ROUTES[i], ...BULLE_PAIRS[i]]), original = baseline.get(key)
    assert.equal(original?.reason, 'road-pattern-dependent-path'); assert(!original.path, 'Never replace accepted geometry')
    const prefix = bullePrefix(source, policy, i), originalPaths = []
    for (const [id, p] of contexts) if (p.routeId === BULLE_ROUTES[i]) for (let j = 1; j < p.stops.length; j++) {
      if (p.stops[j - 1][4] !== c.stops[0][4] || p.stops[j][4] !== c.stops[1][4]) continue
      assert.deepEqual(p.stops.slice(j - 1, j + 1), c.stops)
      assert.equal(p.stops.filter(s => s[4] === c.stops[0][4]).length, 1)
      const pathIndex = agency.cache.patterns[id][j - 1]; assert(Number.isInteger(pathIndex), 'Rejected original matcher context')
      const path = agency.cache.paths[pathIndex], anchors = path.flatMap((p, k) => JSON.stringify(p) === JSON.stringify(BULLE_ANCHOR) ? [k] : [])
      assert.equal(anchors.length, 1, 'Ambiguous common-tail anchor')
      assert.deepEqual(path.slice(anchors[0]), c.commonTail, 'Differing geometry beyond reviewed station prefix')
      assert(p.stops.filter((_, k) => k !== j - 1).every(s => prefix.path.every(p => distanceMetres(s, p) > 50)), 'Out-of-order called stop near station exit')
      originalPaths.push({ patternId: id, pathIndex, path })
    }
    assert.deepEqual(originalPaths.map(p => p.patternId).sort(), original.roadPatternIds); assert.equal(originalPaths.length, 3)
    assert.equal(c.commonTail.length, 25); assert.equal(sha256(JSON.stringify(c.commonTail)), policy.commonTailSha256)
    // The untouched shared tail leaves Route de la Pâla southwest, not back into its opposing entrance.
    const exit = source.ways.find(w => w.id === '1075813860'), nodes = new Map(source.nodes.map(n => [n.id, n.coordinate]))
    assert.equal(exit.nodes.at(-1), '4459904042'); assert.equal(exit.tags.name, 'Route de la Pâla'); assert(!exit.tags.oneway)
    const a = nodes.get(exit.nodes.at(-1)), b = nodes.get(exit.nodes.at(-2)), t = c.commonTail[1]
    const v = [b[0] - a[0], b[1] - a[1]], u = [t[0] - a[0], t[1] - a[1]]
    const exitHeadingCosine = (v[0] * u[0] + v[1] * u[1]) / Math.hypot(...v) / Math.hypot(...u)
    assert(exitHeadingCosine > 0.999, 'Common tail opposes source exit heading')
    const destinationAttachmentMetres = distanceMetres(c.commonTail.at(-1), c.stops[1])
    assert(destinationAttachmentMetres <= 0.1, 'Changed original destination attachment')
    const path = [...prefix.path, ...c.commonTail.slice(1), c.stops[1].slice(0, 2).map(n => Number(n.toFixed(7)))], lengthMetres = length(path), directMetres = distanceMetres(...c.stops)
    assert(lengthMetres <= Math.max(600, 3 * directMetres), 'Original general detour guard')
    candidates.set(key, { path, lengthMetres, directMetres, agencyId: '834', geometrySource: 'osm-road-inference', roadPatternIds: original.roadPatternIds,
      roadContextOccurrences: 3, sourceFeatures: prefix.segments.map(s => s.wayId), primaryRoadFailure: original,
      roadReview: { id: policy.id, kind: 'bulle-directed-platform-exit', sourceSha256: policy.sources[0].sha256 } })
    assessments.push({ key, prefix, originalPaths, commonTail: c.commonTail, exitHeadingCosine, destinationAttachmentMetres, lengthMetres, path, primaryFailure: original })
  }
  return { candidates, audit: { policy, assessments, sourceInventory: source } }
}
export async function loadBulle(cache, baseline, config) {
  const bytes = await readFile(config.file); assert.equal(sha256(bytes), config.sha256)
  const policy = JSON.parse(bytes); assert.equal(sha256(await readFile('data/fribourg-road-cache.json')), policy.roadCacheSha256)
  for (const s of policy.sources) assert.equal(sha256(await readFile(`${policy.sourceDirectory}/${s.file}`)), s.sha256)
  return bulleReview(cache, baseline, policy, decodeBulle(`${policy.sourceDirectory}/map.osm.gz`))
}
