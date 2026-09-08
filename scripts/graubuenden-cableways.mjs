import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sha256 } from './download-luzern-sources.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { loadLuzernCableways, matchLuzernCableway } from './luzern-cableway-geometry.mjs'

export function graubuendenCablewayPattern(network, review, train, route, stops) {
  const excluded = reason => train.calls.slice(1).map(() => ({ reason }))
  if (!review.routes.some(r => r.routeId === route.routeId)) return excluded('cableway-unreviewed-route')
  if (!review.patternIds.includes(sha256(directedPatternKey(train)).slice(0, 20))) return excluded('cableway-unreviewed-complete-pattern')
  return train.calls.slice(1).map((call, i) => matchLuzernCableway(network, review, route, stops.get(train.calls[i].id), stops.get(call.id), review.dates))
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
  const { source, network } = await loadLuzernCableways(review, raw)
  const stops = new Map(raw.stops.map(s => [s.stop_id, s]))
  return { source: { ...source, supportingEvidence: evidence }, network, review, match: (train, route) => graubuendenCablewayPattern(network, review, train, route, stops) }
}
