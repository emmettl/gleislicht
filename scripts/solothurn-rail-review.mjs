import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { parseZugRail, zugRailMatcher, operatingPointNumber } from './zug-rail-geometry.mjs'
import { hashFile } from './solothurn-timetable.mjs'
import { previousServiceDate } from './civil-day.mjs'

export async function loadSolothurnRailReview(config, dates) {
  const file = 'data/solothurn-rail-review-policy.json', policy = JSON.parse(await readFile(file))
  for (const field of ['sourceDirectory', 'sourceSha256', 'sourceMetadataSha256']) assert.equal(policy[field], config[field])
  const bytes = await readFile(`${config.sourceDirectory}/network.xtf.gz`)
  const xml = gunzipSync(bytes)
  assert.equal(createHash('sha256').update(xml).digest('hex'), policy.sourceSha256)
  const network = parseZugRail(xml.toString(), config.limits.simplificationMetres)
  const node = network.nodes.get(policy.node.id), segment = network.segments.find(s => s.id === policy.segment.id)
  assert.equal(node.number, policy.node.number); assert.equal(node.name, policy.node.name)
  assert.equal(segment.gauge, policy.segment.gauge)
  assert([segment.start, segment.end].includes(node.id))
  const reviewed = { ...config, routes: policy.routes, operatingPointOverrides: [{ sourceNumber: policy.sourceNumber,
    targetNumber: node.number, expectedName: node.name, routeIds: policy.routes.map(r => r.routeId) }] }
  const matcher = zugRailMatcher(network, reviewed, [previousServiceDate([...dates].sort()[0]), [...dates].sort().at(-1)])
  assert.equal(matcher.sourceInventory.find(s => s.id === segment.id).reason, null)
  return { metadata: { policy, policySha256: await hashFile(file), node, segment: matcher.sourceInventory.find(s => s.id === segment.id) },
    matchPattern(train, rawStops, route, original) {
      const identity = policy.routes.find(r => r.routeId === route.id)
      if (!identity || route.agencyId !== identity.agencyId || route.name !== identity.line || route.mode !== 'rail') return original
      const calls = train.stops.map(([i]) => rawStops[i])
      const targets = calls.filter(s => operatingPointNumber(s[4]) === policy.sourceNumber)
      if (!targets.length) return original
      for (const stop of targets) {
        const expected = policy.stops.find(s => s[4] === stop[4])
        // Unknown platforms do not inherit a station-wide crosswalk.
        if (!expected) return original
        assert.deepEqual(stop, expected, 'Changed reviewed Interlaken platform')
      }
      const stops = new Map(calls.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
      const results = matcher.matchPattern({ ...train, calls: calls.map(s => ({ id: s[4] })) }, stops, { ...route, line: route.name })
      return original.map((value, i) => value.path || !results[i].path ? value : { ...results[i],
        geometrySource: 'fot-reviewed-interlaken-platforms', operatingPointReview: { sourceNumber: policy.sourceNumber,
          targetNumber: node.number, stopIds: targets.map(s => s[4]), nodeId: node.id, segmentId: segment.id } })
    } }
}
