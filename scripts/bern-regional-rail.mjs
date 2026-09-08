import assert from 'node:assert/strict'
import { loadBernRail, applyBernRail } from './bern-rail-geometry.mjs'
import { operatingPointNumber } from './zug-rail-geometry.mjs'

export const BERN_REGIONAL_RAIL_ROUTES = ['91-5-j26-1', '91-23-j26-1', '91-13-G-j26-1', '91-20-A-j26-1',
  '91-31-j26-1', '91-42-C-j26-1', '91-41-F-j26-1', '91-15-B-j26-1', '91-5-A-j26-1']
export async function loadBernRegionalRail() {
  const rail = await loadBernRail({ policyPath: 'data/bern-regional-rail-policy.json', scope: BERN_REGIONAL_RAIL_ROUTES,
    infrastructureOperators: ['SBB CFF FFS', 'BLSN'] })
  assert.equal(rail.policy.sourceId, 'bern-regional-fot-rail-20210706')
  for (const r of rail.policy.routes) {
    assert(['11', '33'].includes(r.agencyId) && r.mode === 'rail')
    assert(r.pairs.every(p => p.fromId && p.toId && p.operatingPointPair.length === 2))
    for (const p of r.pairs) assert.deepEqual(p.operatingPointPair, [p.fromId, p.toId].map(operatingPointNumber), 'Changed reviewed station identity')
    assert.equal(new Set(r.pairs.map(p => JSON.stringify([p.fromId, p.toId]))).size, r.pairs.length)
  }
  return rail
}
export const applyBernRegionalRail = applyBernRail
