import assert from 'node:assert/strict'
import { loadBernRail, applyBernRail } from './bern-rail-geometry.mjs'
import { operatingPointNumber } from './zug-rail-geometry.mjs'

export const BERN_CROSSCANTON_RAIL_ROUTES = ['91-20-B-j26-1', '91-21-A-j26-1', '91-1X-Y-j26-1',
  '91-3W-Y-j26-1', '91-4R-Y-j26-1', '91-8-L-j26-1']
export async function loadBernCrosscantonRail() {
  const rail = await loadBernRail({ policyPath: 'data/bern-crosscanton-rail-policy.json', scope: BERN_CROSSCANTON_RAIL_ROUTES,
    infrastructureOperators: ['SBB CFF FFS', 'BLSN'] })
  assert.equal(rail.policy.sourceId, 'bern-crosscanton-fot-rail-20210706')
  for (const r of rail.policy.routes) {
    assert(['11', '33', '53'].includes(r.agencyId) && r.mode === 'rail')
    assert(r.pairs.every(p => p.fromId && p.toId && p.operatingPointPair.length === 2))
    for (const p of r.pairs) assert.deepEqual(p.operatingPointPair, [p.fromId, p.toId].map(operatingPointNumber), 'Changed reviewed station identity')
    assert.equal(new Set(r.pairs.map(p => JSON.stringify([p.fromId, p.toId]))).size, r.pairs.length)
  }
  return rail
}
export const applyBernCrosscantonRail = applyBernRail
