import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadBernRail, applyBernRail } from './bern-rail-geometry.mjs'
import { parseZugRail, operatingPointNumber } from './zug-rail-geometry.mjs'

export const BERN_INTERLAKEN_ROUTES = ['91-8-L-j26-1']
export async function loadBernInterlaken() {
  const rail = await loadBernRail({ policyPath: 'data/bern-interlaken-policy.json', scope: BERN_INTERLAKEN_ROUTES,
    infrastructureOperators: ['BLS'] })
  const { policy, matcher } = rail, review = policy.interlaken
  assert.equal(policy.sourceId, 'bern-interlaken-reviewed-fot-rail-20210706')
  assert.deepEqual(policy.operatingPointOverrides, [{ sourceNumber: '8507492', targetNumber: '8519309',
    expectedName: 'Interlaken Ost [Gleis 5-8]', routeIds: BERN_INTERLAKEN_ROUTES }])
  assert.deepEqual(policy.routes.map(({ pairs: _pairs, ...r }) => r), [{ routeId: BERN_INTERLAKEN_ROUTES[0], agencyId: '33', line: 'RE8', mode: 'rail' }])
  assert.equal(policy.routes[0].pairs.length, 3)
  for (const pair of policy.routes[0].pairs) {
    assert.deepEqual(pair.sourceSegments, ['ch14uvag00087489'])
    assert.deepEqual(pair.operatingPointPair, [pair.fromId, pair.toId].map(operatingPointNumber))
  }
  const network = parseZugRail(gunzipSync(await readFile(`${policy.sourceDirectory}/network.xtf.gz`)).toString(), 0)
  for (const node of [review.genericNode, review.targetNode, ...review.excludedPlatformGroups]) assert.deepEqual(network.nodes.get(node.id), node)
  assert.deepEqual(network.segments.find(s => s.id === 'ch14uvag00087489'), review.curve)
  assert(!network.segments.some(s => [s.start, s.end].includes(review.genericNode.id)), 'Generic Ost station unexpectedly connected')
  assert.equal(review.curve.end, review.targetNode.id)
  assert.equal(review.excludedDepotCurve, 'ch14uvag00087490')
  assert.equal(policy.originalPatterns.length, 4); assert.equal(policy.originalStops.length, 12)
  assert.deepEqual(policy.originalStops.filter(s => operatingPointNumber(s[4]) === '8507492').map(s => s[3]).sort(), ['5', '8'])
  const originals = new Map(policy.originalStops.map(s => [s[4], s]))
  return { ...rail, matcher: { sourceInventory: matcher.sourceInventory, matchPattern(train, stops, route) {
    assert.equal(train.routeId, BERN_INTERLAKEN_ROUTES[0])
    assert.equal(route.agencyId, '33'); assert.equal(route.line, 'RE8'); assert.equal(route.mode, 'rail')
    const ids = train.calls.map(c => c.id)
    const reject = () => ids.slice(1).map(() => ({ reason: 'rail-unreviewed-interlaken-platform-context' }))
    if (!policy.originalPatterns.some(p => p.directionId === train.directionId && JSON.stringify(p.stopIds) === JSON.stringify(ids))) return reject()
    // Validate every original call before the underlying matcher's pattern cache.
    for (const id of ids) {
      const original = stops.get(id), expected = originals.get(id)
      assert(expected && original, 'Missing reviewed RE8 source stop')
      assert.deepEqual([original.stop_lon, original.stop_lat], expected.slice(0, 2), 'Changed reviewed RE8 source coordinates')
    }
    return matcher.matchPattern(train, stops, route)
  } } }
}
export const applyBernInterlaken = applyBernRail
