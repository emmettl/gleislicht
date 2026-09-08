import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stGallenRoadScope, validateStGallenRoadReview } from './review-st-gallen-roads.mjs'

const json = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'))
const policy = json('data/st-gallen-road-pilot-policy.json')

test('road scope retains complete foreign calls and overnight times, and rejects operator or admission changes', () => {
  const raw = { dates: policy.dates, inventory: policy.routes,
    snapshots: [{ date: policy.dates[0], trains: [
      { routeId: policy.routes[0].routeId, calls: [{ id: 'foreign', arrival: -60 }, { id: 'canton', arrival: 120 }] },
      { routeId: 'unreviewed', calls: [{ id: 'canton' }] },
    ] }] }
  const before = structuredClone(raw), scoped = stGallenRoadScope(raw, policy)
  assert.deepEqual(raw, before)
  assert.deepEqual(scoped.snapshots[0].trains, [raw.snapshots[0].trains[0]])
  const changed = structuredClone(raw); changed.inventory[0].agencyId = 'other'
  assert.throws(() => stGallenRoadScope(changed, policy), /route identity/)
  assert.throws(() => stGallenRoadScope(raw, { ...policy, admissionEnabled: true }), /cannot admit/)
})

test('tracked road audit rejects hidden pairs, altered connectors, stale feed bindings and inflated coverage', () => {
  const report = json('data/st-gallen-road-pilot-review.json'), endpoints = json('data/st-gallen-endpoint-review.json')
  const index = json('data/st-gallen-region/index.json'), followup = json('data/st-gallen-endpoint-followup.json')
  const check = r => validateStGallenRoadReview(r, endpoints, index, policy, followup)
  check(report)
  for (const mutate of [
    r => r.pairs.pop(),
    r => { r.pairs[0].geometrySha256 = '0'.repeat(64) },
    r => { r.pairs[0].contexts[0].toSnapMetres = 0 },
    r => { r.pairs[0].contexts.pop() },
    r => { r.feedDays[0].manifestSha256 = '0'.repeat(64) },
    r => { r.routes[0].days[0].trips++ },
    r => { r.validation.roadGeometryAdmitted = true },
    r => { r.source.swissDate = '2026-09-09' },
    r => { r.license = 'CC0' },
  ]) { const changed = structuredClone(report); mutate(changed); assert.throws(() => check(changed)) }
})
