import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { thurgauBorderGraph } from './thurgau-border-rail.mjs'
import { bernPatternId } from './bern-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const stop = s => ({ stop_id: s[4], stop_name: s[2], stop_lon: s[0], stop_lat: s[1] })
const vertexGap = (point, path) => Math.min(...path.slice(1).map((b, i) => {
  const a = path[i], scale = Math.cos(point[1] * Math.PI / 180), dx = (b[0] - a[0]) * scale, dy = b[1] - a[1]
  const t = dx || dy ? Math.max(0, Math.min(1, ((point[0] - a[0]) * scale * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0
  return distanceMetres(point, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
}))

export function solothurnComoMatcher(osm, policy, context) {
  assert.equal(policy.reviewedWays, undefined, 'No Como siding exceptions')
  const graph = thurgauBorderGraph(osm, policy), patterns = new Map()
  const route = context.routes.find(r => r.id === policy.route.id)
  for (const [k, v] of Object.entries(policy.route)) assert.equal(route[k], v, 'Changed Como route identity')
  for (const day of context.snapshots) for (const train of day.trains.filter(t => t.routeId === route.id)) {
    const id = bernPatternId(train, day.stops), calls = train.stops.map(([i]) => day.stops[i])
    patterns.set(id, { id, directionId: train.directionId, stops: calls,
      foreignTerminal: calls.filter(s => s[4] === '8301307').length === 1 && [calls[0][4], calls.at(-1)[4]].includes('8301307') })
  }
  assert.deepEqual([...patterns.keys()].sort(), policy.patternIds, 'Changed complete Como pattern scope')
  const pairs = policy.pairs.map(review => {
    const result = graph.match(stop(review.from), stop(review.to))
    assert(result.path, result.reason)
    assert.equal(hash(JSON.stringify(result.path)), review.pathSha256, 'Changed reviewed Como path')
    const ways = [...new Set(result.directedSourceSegments.map(s => Number(s.id.split(':')[1])))]
    assert.deepEqual(ways, review.sourceWayIds, 'Changed Como way order')
    for (const id of ways) {
      const way = graph.inventory.find(w => w.id === id)
      assert.equal(way.tags.usage, 'main'); assert.equal(way.tags.service, undefined)
      assert(Number(way.tags.passenger_lines) > 0, 'Missing passenger corridor evidence')
    }
    const tunnel = graph.inventory.find(w => w.id === review.tunnelWayId)
    assert(ways.includes(tunnel.id)); assert.equal(tunnel.tags.name, 'Monte Olimpino 1')
    assert.equal(tunnel.tags['tunnel:name'], 'Chiasso Olimpino I'); assert.equal(tunnel.tags.tunnel, 'yes')
    const contexts = [...patterns.values()].filter(p => p.stops.some((s, i) => s[4] === review.from[4] && p.stops[i + 1]?.[4] === review.to[4]))
    assert(contexts.length && contexts.every(p => p.foreignTerminal))
    for (const p of contexts) for (const expected of [review.from, review.to]) assert.deepEqual(p.stops.find(s => s[4] === expected[4]), expected)
    return { ...result, geometrySource: 'osm-solothurn-como-rail-inference', sourceWayIds: ways, tunnelWayId: tunnel.id,
      from: review.from, to: review.to, geometrySha256: review.pathSha256, contextPatternIds: contexts.map(p => p.id).sort() }
  })
  return { inventory: graph.inventory, pairs, patterns: [...patterns.values()],
    matchPattern(train, rawStops, candidateRoute, original) {
      if (!Object.entries(policy.route).every(([k, v]) => candidateRoute[k] === v)) return original
      const pattern = patterns.get(bernPatternId(train, rawStops))
      if (!pattern?.foreignTerminal) return original
      const calls = train.stops.map(([i]) => rawStops[i])
      assert.deepEqual(calls, pattern.stops, 'Changed Como pattern coordinates')
      return original.map((value, i) => {
        if (value.path) return value
        const pair = pairs.find(p => p.from[4] === calls[i][4] && p.to[4] === calls[i + 1][4])
        if (!pair) return value
        const { from, to, contextPatternIds, ...result } = pair
        return { ...result, reviewedPatternId: pattern.id, previousSupplementFailure: value.reason }
      })
    } }
}

export async function loadSolothurnComoRail(context) {
  const file = 'data/solothurn-como-policy.json', policy = JSON.parse(await readFile(file)), dir = policy.sourceDirectory
  assert.equal(await hashFile('data/solothurn-pattern-contexts.json.gz'), policy.contextSha256)
  assert.deepEqual(context.sourceHashes, policy.timetableSourceHashes)
  const bytes = await readFile(`${dir}/sources.json`); assert.equal(hash(bytes), policy.sourceSha256)
  const source = JSON.parse(bytes)
  for (const item of source.files) assert.equal(await hashFile(`${dir}/${item.file}`), item.sha256)
  assert.equal(policy.snapshot, source.snapshot)
  assert((await readFile(`${dir}/query.txt`, 'utf8')).includes(`[date:"${policy.snapshot}"]`))
  const matcher = solothurnComoMatcher(JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`))), policy, context)
  const lombardia = JSON.parse(await readFile(`${dir}/lombardia-rail.json`)), ids = JSON.parse(await readFile(`${dir}/lombardia-ids.json`)).objectIds
  assert(!lombardia.error && !lombardia.exceededTransferLimit); assert.equal(lombardia.spatialReference.wkid, 4326)
  assert.equal(new Set(ids).size, 8)
  assert.deepEqual(lombardia.features.map(f => f.attributes.OBJECTID_1).sort((a,b)=>a-b), [...ids].sort((a,b)=>a-b))
  const comparisonInventory = lombardia.features.map(f => {
    const reviewed = source.lombardia.corridorIds.includes(f.attributes.OBJECTID_1)
    const maximumVertexGapMetres = Math.max(...f.geometry.paths.flat().map(p => vertexGap(p, matcher.pairs[0].path)))
    if (reviewed) {
      assert.equal(f.attributes.GESTORE_RETE, 'RFI'); assert.equal(f.attributes.DSCART, 'Standard')
      assert(maximumVertexGapMetres <= policy.comparisonMaximumVertexGapMetres, 'Lombardia corridor disagreement')
    }
    return { id: f.attributes.OBJECTID_1, attributes: f.attributes, vertices: f.geometry.paths.flat().length,
      maximumVertexGapMetres, use: reviewed ? 'independent-corridor-review-only' : 'outside-reviewed-corridor' }
  })
  return { ...matcher, metadata: { policy, policySha256: await hashFile(file), source,
    comparisonInventory, patterns: matcher.patterns, pairEvidence: matcher.pairs.map(({ path, directedSourceSegments, ...p }) => ({ ...p, directedSourceSegmentsSha256: hash(JSON.stringify(directedSourceSegments)) })) } }
}
