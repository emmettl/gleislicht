import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sha256 } from './download-luzern-sources.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { loadLuzernCableways, matchLuzernCableway, matchFederalFunicular } from './luzern-cableway-geometry.mjs'

export function graubuendenCablewayPattern(network, review, train, route, stops) {
  const excluded = reason => train.calls.slice(1).map(() => ({ reason }))
  const blocked = review.blockedRoutes?.find(r => r.routeId === route.routeId)
  if (blocked) { assert.equal(route.agencyId, blocked.agencyId); return excluded(blocked.reason) }
  if (!review.routes.some(r => r.routeId === route.routeId)) return excluded('cableway-unreviewed-route')
  if (!review.patternIds.includes(sha256(directedPatternKey(train)).slice(0, 20))) return excluded('cableway-unreviewed-complete-pattern')
  const identity = review.routes.find(r => r.routeId === route.routeId)
  const matcher = identity.routeType === 1400 ? matchFederalFunicular : matchLuzernCableway
  return train.calls.slice(1).map((call, i) => matcher(network, review, route, stops.get(train.calls[i].id), stops.get(call.id), review.dates))
}
export async function loadGraubuendenCableways(policy, raw) {
  if (!policy.cablewayReview) return null
  const bytes = await readFile('data/graubuenden-cableway-policy.json')
  assert.equal(sha256(bytes), policy.cablewayReview.policySha256, 'Changed GR cableway policy')
  const review = JSON.parse(bytes)
  assert.deepEqual(review.dates, raw.dates, 'Cableway dates need a new review')
  const evidenceBytes = await readFile('data/graubuenden-cableway-sources/evidence.json')
  assert.equal(sha256(evidenceBytes), review.supportingEvidenceSha256, 'Changed operator evidence')
  const evidence = JSON.parse(evidenceBytes)
  assert.equal(sha256(await readFile(`data/graubuenden-cableway-sources/${evidence.file}`)), evidence.sha256, 'Changed operator page')
  const expansionBytes = await readFile('data/graubuenden-cableway-sources/expansion-evidence.json')
  assert.equal(sha256(expansionBytes), review.expansionEvidenceSha256, 'Changed cableway expansion evidence')
  const expansionEvidence = JSON.parse(expansionBytes)
  for (const r of expansionEvidence.responses) assert.equal(sha256(await readFile(`data/graubuenden-cableway-sources/${r.file}`)), r.sha256, 'Changed operator context page')
  assert.equal(sha256(await readFile('data/graubuenden-cableway-sources/initial-policy.json')), review.initialPolicySha256, 'Changed previous cableway scope')
  assert(!review.blockedRoutes.some(b => review.routes.some(r => r.routeId === b.routeId)), 'Blocked route cannot be admitted')
  const funicularBytes = await readFile('data/graubuenden-cableway-sources/funicular-evidence.json')
  assert.equal(sha256(funicularBytes), review.funicularEvidenceSha256, 'Changed funicular operator evidence')
  const funicularEvidence = JSON.parse(funicularBytes)
  for (const r of funicularEvidence.responses) assert.equal(sha256(await readFile(`data/graubuenden-cableway-sources/${r.file}`)), r.sha256)
  assert.equal(sha256(await readFile('data/graubuenden-cableway-sources/six-route-policy.json')), review.sixRoutePolicySha256, 'Changed six-route baseline')
  const { source, network } = await loadLuzernCableways(review, raw)
  const stops = new Map(raw.stops.map(s => [s.stop_id, s]))
  return { source: { ...source, supportingEvidence: evidence, expansionEvidence, funicularEvidence }, network, review, match: (train, route) => graubuendenCablewayPattern(network, review, train, route, stops) }
}
