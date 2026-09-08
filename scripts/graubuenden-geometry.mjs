import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadZugRail } from './zug-rail-geometry.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { loadGraubuendenRailAnchors } from './graubuenden-rail-anchors.mjs'

export async function loadGraubuendenGeometry(policy, raw) {
  const rails = new Map(), railInventory = []
  for (const group of policy.railGroups) {
    const matcher = await loadZugRail({ ...policy.rail, ...group }, raw.dates)
    railInventory.push({ id: group.id, gauges: group.gauges, infrastructureOperators: group.infrastructureOperators, segments: matcher.sourceInventory })
    for (const r of group.routes) { assert(!rails.has(r.routeId)); rails.set(r.routeId, matcher) }
  }
  const railAnchors = await loadGraubuendenRailAnchors(policy, raw)
  if (railAnchors) railInventory.push({ id: 'rhb-reviewed-stop-anchors', segments: railAnchors.sourceInventory, reviews: railAnchors.reviews })
  const bytes = await readFile('data/graubuenden-roads/cache.json.gz')
  assert.equal(sha256(bytes), policy.roads.cacheSha256, 'Changed road paths: rebuild and review')
  const roads = JSON.parse(gunzipSync(bytes))
  assert.equal(roads.metadata.sourceSha256, policy.roads.osmSha256)
  assert.equal(roads.metadata.matcher.configSha256, policy.roads.configSha256)
  const failures = new Map(roads.report.issues.map(i => [`${i.pattern}:${i.segment}`, i]))
  const platforms = raw.stops.map(s => [Number(s.stop_lon), Number(s.stop_lat), s.stop_name, s.platform_code, s.stop_id])
  const indexes = new Map(platforms.map((s, i) => [s[4], i])), stops = new Map(raw.stops.map(s => [s.stop_id, s]))
  return { railInventory, railAnchors, roads, matchPattern(train, route) {
    if (route.mode === 'rail') {
      const original = rails.has(route.routeId) ? rails.get(route.routeId).matchPattern(train, stops, route) : train.calls.slice(1).map(() => ({ reason: 'unreviewed-rail-identity' }))
      return railAnchors ? railAnchors.match(original, train, route) : original
    }
    if (route.mode !== 'bus') return train.calls.slice(1).map(() => ({ reason: `no-reviewed-${route.mode}-geometry` }))
    const key = roadPatternId({ ...train, stops: train.calls.map(c => [indexes.get(c.id), c.arrival, c.departure]) }, platforms)
    const segments = roads.patterns[key]
    assert(segments && segments.length === train.calls.length - 1, 'Missing whole bus pattern; regenerate road matching')
    return segments.map((index, i) => {
      const evidence = { geometrySource: 'osm', roadPatternId: key, roadSegmentIndex: i }
      if (index === null) return { ...evidence, reason: `road-${failures.get(`${key}:${i}`)?.reason ?? 'unmatched'}` }
      const path = structuredClone(roads.paths[index]), a = platforms[indexes.get(train.calls[i].id)].slice(0, 2), b = platforms[indexes.get(train.calls[i + 1].id)].slice(0, 2)
      assert(distanceMetres(a, path[0]) < .15 && distanceMetres(b, path.at(-1)) < .15, 'Road pattern endpoint mismatch')
      path[0] = a; path[path.length - 1] = b
      return { ...evidence, path }
    })
  } }
}
