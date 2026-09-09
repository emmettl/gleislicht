import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { thurgauBorderGraph } from './thurgau-border-rail.mjs'
import { bernPatternId } from './bern-line-geometry.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const stop = s => ({ stop_id: s[4], stop_name: s[2], stop_lon: s[0], stop_lat: s[1] })
export function solothurnDelleMatcher(osm, policy, context) {
  assert.equal(policy.reviewedWays, undefined, 'No Delle siding exceptions')
  const graph = thurgauBorderGraph(osm, policy), patterns = new Map()
  const route = context.routes.find(r => r.id === policy.route.id)
  for (const [k, v] of Object.entries(policy.route)) assert.equal(route[k], v, 'Changed Delle route identity')
  for (const day of context.snapshots) for (const train of day.trains.filter(t => t.routeId === route.id)) {
    const id = bernPatternId(train, day.stops), calls = train.stops.map(([i]) => day.stops[i])
    patterns.set(id, { id, directionId: train.directionId, stops: calls,
      foreignTerminal: calls.filter(s => s[4] === '8718444').length === 1 && [calls[0][4], calls.at(-1)[4]].includes('8718444') })
  }
  assert.deepEqual([...patterns.keys()].sort(), policy.patternIds, 'Changed complete Delle pattern scope')
  const pairs = policy.pairs.map(review => {
    const result = graph.match(stop(review.from), stop(review.to))
    assert(result.path, result.reason)
    assert.equal(hash(JSON.stringify(result.path)), review.pathSha256, 'Changed reviewed Delle path')
    const ways = [...new Set(result.directedSourceSegments.map(s => Number(s.id.split(':')[1])))]
    assert.deepEqual(ways, review.sourceWayIds, 'Changed Delle way order')
    for (const id of ways) {
      const way = graph.inventory.find(w => w.id === id)
      assert.equal(way.tags.usage, 'branch'); assert.equal(way.tags.service, undefined)
      assert(Number(way.tags.passenger_lines) > 0, 'Missing passenger corridor evidence')
    }
    const contexts = [...patterns.values()].filter(p => p.stops.some((s, i) => s[4] === review.from[4] && p.stops[i + 1]?.[4] === review.to[4]))
    assert(contexts.length && contexts.every(p => p.foreignTerminal))
    for (const p of contexts) for (const expected of [review.from, review.to]) assert.deepEqual(p.stops.find(s => s[4] === expected[4]), expected)
    return { ...result, geometrySource: 'osm-solothurn-delle-rail-inference', sourceWayIds: ways,
      from: review.from, to: review.to, geometrySha256: review.pathSha256, contextPatternIds: contexts.map(p => p.id).sort() }
  })
  return { inventory: graph.inventory, pairs, patterns: [...patterns.values()],
    matchPattern(train, rawStops, candidateRoute, original) {
      if (!Object.entries(policy.route).every(([k, v]) => candidateRoute[k] === v)) return original
      const pattern = patterns.get(bernPatternId(train, rawStops))
      if (!pattern?.foreignTerminal) return original
      const calls = train.stops.map(([i]) => rawStops[i])
      assert.deepEqual(calls, pattern.stops, 'Changed Delle pattern coordinates')
      return original.map((value, i) => {
        if (value.path) return value
        const pair = pairs.find(p => p.from[4] === calls[i][4] && p.to[4] === calls[i + 1][4])
        if (!pair) return value
        const { from: _from, to: _to, contextPatternIds: _contextPatternIds, ...result } = pair
        return { ...result, reviewedPatternId: pattern.id, previousSupplementFailure: value.reason }
      })
    } }
}

export async function loadSolothurnDelleRail(context) {
  const file = 'data/solothurn-delle-policy.json', policy = JSON.parse(await readFile(file)), dir = policy.sourceDirectory
  assert.equal(await hashFile('data/solothurn-pattern-contexts.json.gz'), policy.contextSha256)
  assert.deepEqual(context.sourceHashes, policy.timetableSourceHashes)
  const bytes = await readFile(`${dir}/sources.json`); assert.equal(hash(bytes), policy.sourceSha256)
  const source = JSON.parse(bytes)
  for (const item of source.files) assert.equal(await hashFile(`${dir}/${item.file}`), item.sha256)
  assert.equal(policy.snapshot, source.snapshot)
  assert((await readFile(`${dir}/query.txt`, 'utf8')).includes(`[date:"${policy.snapshot}"]`))
  const matcher = solothurnDelleMatcher(JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`))), policy, context)
  return { ...matcher, metadata: { policy, policySha256: await hashFile(file), source,
    patterns: matcher.patterns, pairEvidence: matcher.pairs.map(({ path: _path, directedSourceSegments, ...p }) => ({ ...p, directedSourceSegmentsSha256: hash(JSON.stringify(directedSourceSegments)) })) } }
}
