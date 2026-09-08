import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { loadBernRail, applyBernRail } from './bern-rail-geometry.mjs'
import { parseZugRail, operatingPointNumber } from './zug-rail-geometry.mjs'

export const BERN_IC61_ROUTES = ['91-61-A-j26-1']
export async function loadBernIc61() {
  const rail = await loadBernRail({ policyPath: 'data/bern-ic61-policy.json', scope: BERN_IC61_ROUTES,
    infrastructureOperators: ['SBB CFF FFS', 'BLSN', 'BLS'] })
  const { policy, matcher } = rail, review = policy.interlaken
  assert.equal(policy.documents.length, 1)
  for (const doc of policy.documents) assert.equal(createHash('sha256').update(await readFile(`${policy.documentsDirectory}/${doc.file}`)).digest('hex'), doc.sha256, 'Changed IC61 corridor evidence')
  const source = JSON.parse(gunzipSync(await readFile('data/bern-sources/decoded.json.gz')))
  assert.deepEqual(source.lines.find(f => f.properties.liniencode === '310_IC').properties, policy.cantonalFeatureProperties)
  assert.deepEqual(policy.cantonalAssociation, { routeId: BERN_IC61_ROUTES[0], agencyId: '11', line: 'IC61', mode: 'rail', sourceLine: '310_IC', supportingDocument: policy.documents[0].file })
  assert.equal(policy.sourceId, 'bern-ic61-reviewed-fot-rail-20210706')
  assert.deepEqual(policy.operatingPointOverrides, [{ sourceNumber: '8507492', targetNumber: '8519309',
    expectedName: 'Interlaken Ost [Gleis 5-8]', routeIds: BERN_IC61_ROUTES }])
  assert.deepEqual(policy.routes.map(({ pairs: _pairs, ...r }) => r), [{ routeId: BERN_IC61_ROUTES[0], agencyId: '11', line: 'IC61', mode: 'rail' }])
  assert.equal(policy.routes[0].pairs.length, 71)
  for (const pair of policy.routes[0].pairs) {
    assert.deepEqual(pair.operatingPointPair, [pair.fromId, pair.toId].map(operatingPointNumber))
  }
  const network = parseZugRail(gunzipSync(await readFile(`${policy.sourceDirectory}/network.xtf.gz`)).toString(), 0)
  for (const node of [review.genericNode, review.targetNode, ...review.excludedPlatformGroups]) assert.deepEqual(network.nodes.get(node.id), node)
  assert.deepEqual(network.segments.find(s => s.id === 'ch14uvag00087489'), review.curve)
  assert(!network.segments.some(s => [s.start, s.end].includes(review.genericNode.id)), 'Generic Ost station unexpectedly connected')
  assert.equal(review.curve.end, review.targetNode.id)
  assert.equal(review.excludedDepotCurve, 'ch14uvag00087490')
  assert.equal(policy.originalPatterns.length, 59); assert.equal(policy.originalStops.length, 37)
  assert.deepEqual(policy.originalStops.filter(s => operatingPointNumber(s[4]) === '8507492').map(s => s[3]).sort(), ['5', '7'])
  const originals = new Map(policy.originalStops.map(s => [s[4], s]))
  return { ...rail, matcher: { sourceInventory: matcher.sourceInventory, matchPattern(train, stops, route) {
    assert.equal(train.routeId, BERN_IC61_ROUTES[0])
    assert.equal(route.agencyId, '11'); assert.equal(route.line, 'IC61'); assert.equal(route.mode, 'rail')
    const ids = train.calls.map(c => c.id)
    const reject = () => ids.slice(1).map(() => ({ reason: 'rail-unreviewed-interlaken-platform-context' }))
    if (!policy.originalPatterns.some(p => p.directionId === train.directionId && JSON.stringify(p.stopIds) === JSON.stringify(ids))) return reject()
    // Validate every original call before the underlying matcher's pattern cache.
    for (const id of ids) {
      const original = stops.get(id), expected = originals.get(id)
      assert(expected && original, 'Missing reviewed IC61 source stop')
      assert.deepEqual([original.stop_lon, original.stop_lat], expected.slice(0, 2), 'Changed reviewed IC61 source coordinates')
    }
    return matcher.matchPattern(train, stops, route)
  } } }
}
export const applyBernIc61 = applyBernRail

export function bernIc61Crosswalk(crosswalk, policy, dates) {
  assert.deepEqual(dates, policy.dates, 'Unreviewed IC61 crosswalk dates')
  assert(!crosswalk.featureOverrides['310_IC'], 'Unexpected pre-existing IC61 override')
  return { ...crosswalk, featureOverrides: { ...crosswalk.featureOverrides, '310_IC': { routeIdentities: [policy.cantonalAssociation] } },
    supportingDocuments: [...crosswalk.supportingDocuments, ...policy.documents] }
}
