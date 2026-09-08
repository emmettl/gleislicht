import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { bernPatternId } from './bern-line-geometry.mjs'
import { parseZugRail, zugRailMatcher } from './zug-rail-geometry.mjs'
import { sbbSegmentKey } from './zug-sbb-rail-supplement.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { hashFile } from './solothurn-timetable.mjs'
import { previousServiceDate } from './civil-day.mjs'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

export function solothurnS26Network(network, page, policy) {
  assert.equal(page.results.length, page.total_count, 'Incomplete SBB source response')
  const records = page.results.filter(r => sbbSegmentKey(r) === JSON.stringify(policy.feature))
  assert.equal(records.length, 1, 'Missing or duplicate SBB source identity')
  const feature = records[0], points = feature.geo_shape.geometry.coordinates
  assert.equal(hash(JSON.stringify(feature)), policy.featureSha256, 'Changed SBB source curve')
  assert.equal(feature.spurweite, 'N'); assert.equal(feature.geo_shape.geometry.type, 'LineString')
  assert.equal(points.length, 44); assert(points.every(p => p.length === 2 && p.every(Number.isFinite)))
  assert.deepEqual(network.segments.find(s => s.id === policy.originalSegment.id), policy.originalSegment, 'Changed original FOT gauge evidence')
  assert.equal(policy.originalSegment.gauge, 'mm1000')
  for (const node of policy.nodes) assert.deepEqual(network.nodes.get(node.id), node, 'Changed FOT operating point')
  assert.equal(feature.bp_anf_bez, policy.nodes[0].name); assert.equal(feature.bp_end_bez, policy.nodes[1].name)
  const attachments = policy.nodes.map((node, i) => distanceMetres(node.coordinate, i ? points.at(-1) : points[0]))
  assert(attachments.every(m => m <= 20), 'SBB curve too far from reviewed operating points')
  const added = { id: policy.id, start: policy.nodes[0].id, end: policy.nodes[1].id, points, gauge: 'mm1435',
    dataStand: null, validFrom: null, validUntil: null, infrastructureOperator: 'SBB Infrastructure' }
  assert(!network.segments.some(s => s.id === added.id))
  return { network: { ...network, segments: [...network.segments, added] }, evidence: { addedSegment: added, attachments,
    originalSegmentRetained: policy.originalSegment, effectiveAlignmentDateEstablished: false } }
}

export async function loadSolothurnS26Review(config, dates) {
  const file = 'data/solothurn-s26-policy.json', policy = JSON.parse(await readFile(file))
  assert.equal(policy.fotSha256, config.sourceSha256); assert.deepEqual(policy.limits, config.limits)
  const pairs = [{ route: policy.route, from: policy.from, to: policy.to }, ...(policy.additionalPairs ?? [])]
  const routes = [...new Map(pairs.map(p => [p.route.routeId, p.route])).values()]
  for (const route of routes) assert.deepEqual(config.routes.find(r => r.routeId === route.routeId), route)
  assert.equal(await hashFile('data/solothurn-pattern-contexts.json.gz'), policy.contextSha256)
  assert.equal(await hashFile(`${policy.sourceDirectory}/sources.json`), policy.sourceSha256)
  const context = JSON.parse(gunzipSync(await readFile('data/solothurn-pattern-contexts.json.gz')))
  for (const pair of policy.additionalPairs ?? []) {
    const ids = []
    for (const day of context.snapshots) for (const train of day.trains.filter(t => t.routeId === pair.route.routeId)) {
      const calls = train.stops.map(([i]) => day.stops[i])
      if (calls.some((s, i) => s[4] === pair.from[4] && calls[i + 1]?.[4] === pair.to[4])) ids.push(bernPatternId(train, day.stops))
    }
    assert.deepEqual([...new Set(ids)].sort(), pair.patternIds, 'Changed seasonal S23/S26 complete contexts')
  }
  const source = JSON.parse(await readFile(`${policy.sourceDirectory}/sources.json`))
  for (const item of source.files) assert.equal(await hashFile(`${policy.sourceDirectory}/${item.file}`), item.sha256)
  const xml = gunzipSync(await readFile(`${config.sourceDirectory}/network.xtf.gz`)); assert.equal(hash(xml), policy.fotSha256)
  const network = parseZugRail(xml.toString(), config.limits.simplificationMetres)
  const variant = solothurnS26Network(network, JSON.parse(await readFile(`${policy.sourceDirectory}/line540.json`)), policy)
  const matcher = zugRailMatcher(variant.network, { ...config, routes }, [previousServiceDate([...dates].sort()[0]), [...dates].sort().at(-1)])
  assert.equal(matcher.sourceInventory.find(s => s.id === policy.originalSegment.id).reason, 'non-standard-gauge')
  assert.equal(matcher.sourceInventory.find(s => s.id === policy.id).reason, null)
  return { metadata: { policy, policySha256: await hashFile(file), source, ...variant.evidence },
    matchPattern(train, rawStops, route, original) {
      const scoped = pairs.filter(p => route.id === p.route.routeId && route.agencyId === p.route.agencyId && route.name === p.route.line && route.mode === 'rail')
      if (!scoped.length) return original
      const calls = train.stops.map(([i]) => rawStops[i]), targets = new Set()
      for (const pair of scoped) for (let i = 0; i < calls.length - 1; i++) {
        if (calls[i][4] !== pair.from[4] || calls[i + 1][4] !== pair.to[4] || original[i].path) continue
        assert.deepEqual(calls[i], pair.from); assert.deepEqual(calls[i + 1], pair.to); targets.add(i)
      }
      if (!targets.size) return original
      const stops = new Map(calls.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
      const results = matcher.matchPattern({ ...train, calls: calls.map(s => ({ id: s[4] })) }, stops, { ...route, line: route.name })
      let changed = false
      const reviewed = original.map((r, i) => {
        const value = results[i]
        if (!targets.has(i) || !value.path) return r
        assert(value.directedSourceSegments.some(s => s.id === policy.id), 'S23/S26 path bypassed reviewed SBB curve')
        assert(!value.directedSourceSegments.some(s => s.id === policy.originalSegment.id), 'S23/S26 used rejected metre-gauge source')
        assert(value.pathMetres < 15000, 'S23/S26 path outside reviewed Aarau–Olten corridor')
        changed = true
        return { ...value, geometrySource: 'fot-sbb-reviewed-s26', sourceReview: policy.id, previousSupplementFailure: r.reason }
      })
      return changed ? reviewed : original
    } }
}
