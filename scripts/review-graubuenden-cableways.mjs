import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { readJson, saveJson } from './build-graubuenden-region.mjs'
import { loadGraubuendenGeometry } from './graubuenden-geometry.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { graubuendenCablewayPattern } from './graubuenden-cableways.mjs'
import { graubuendenCablewayTrials } from './graubuenden-cableway-trials.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const raw = await readJson('data/graubuenden-audit/timetable.json.gz'), policy = await readJson('data/graubuenden-policy.json')
const current = await loadGraubuendenGeometry(policy, raw), baseline = await loadGraubuendenGeometry({ ...policy, cablewayReview: null }, raw)
const routes = new Map(raw.inventory.map(r => [r.routeId, r])), stopMap = new Map([...raw.cantonStops, ...raw.stops].map(s => [s.stop_id, s]))
const initial = await readJson('data/graubuenden-cableway-sources/initial-policy.json'), stops = new Map(raw.stops.map(s => [s.stop_id, s]))
const memo = new Map(), days = [], admitted = (t, pairs) => pairs.every(p => p.path) && t.calls.every(c => !['2', '3'].includes(c.pickupType) && !['2', '3'].includes(c.dropOffType))
for (const day of raw.snapshots) {
  const result = { date: day.date, candidates: day.trains.length, baselineAdmitted: 0, admitted: 0, added: 0, addedHeadwayInstances: 0, addedScheduledInstances: 0, preservedJourneys: 0, preservedNonMountainPatterns: 0, priorCablewayScopeAdmitted: 0, expansionAdded: 0, expansionHeadways: 0 }
  const seen = new Set()
  for (const t of day.trains) {
    const key = directedPatternKey(t), route = routes.get(t.routeId)
    if (!memo.has(key)) {
      const before = baseline.matchPattern(t, route), after = current.matchPattern(t, route)
      const previous = route.mode === 'mountain' ? graubuendenCablewayPattern(current.cableways.network, initial, t, route, stops) : before
      if (admitted(t, previous)) assert.deepEqual(after, previous, 'Changed prior cableway scope geometry')
      if (route.mode !== 'mountain') assert.deepEqual(after, before, 'Changed existing rail/bus/other geometry')
      if (admitted(t, before)) assert.deepEqual(after, before, 'Changed previously admitted journey')
      memo.set(key, { id: sha256(key).slice(0, 20), routeId: t.routeId, train: t, before, after, previous })
    }
    const p = memo.get(key), was = admitted(t, p.before), now = admitted(t, p.after)
    const prior = admitted(t, p.previous)
    result.priorCablewayScopeAdmitted += Number(prior)
    if (now && !prior) { result.expansionAdded++; result.expansionHeadways += Number(t.frequency?.exactTimes === 0) }
    if (!seen.has(key) && route.mode !== 'mountain') result.preservedNonMountainPatterns++
    seen.add(key); result.baselineAdmitted += Number(was); result.admitted += Number(now)
    if (was) { assert(now); result.preservedJourneys++ }
    if (!was && now) { assert.equal(route.mode, 'mountain'); result.added++; if (t.frequency?.exactTimes === 0) result.addedHeadwayInstances++; else result.addedScheduledInstances++ }
  }
  days.push(result)
}
const additions = [...memo.values()].filter(p => !admitted(p.train, p.before) && admitted(p.train, p.after))
assert.deepEqual(additions.map(p => p.id).sort(), current.cableways.review.patternIds, 'Review must admit exactly its complete patterns')
const network = current.cableways.network
const inventory = raw.inventory.filter(r => r.mode === 'mountain').map(r => {
  const trains = raw.snapshots.flatMap(d => d.trains.filter(t => t.routeId === r.routeId))
  const ids = new Set([...r.annualCantonStopIds, ...trains.flatMap(t => t.calls.map(c => c.id))])
  const sourceStops = [...ids].map(id => { const s = stopMap.get(id); assert(s, `Missing inventory stop ${id}`); return { id, number: s.didok, name: s.stop_name } })
  const numbers = new Set(sourceStops.map(s => s.number))
  const candidates = new Set(network.stations.filter(s => numbers.has(s.number)).map(s => s.installation))
  return { ...r, stops: sourceStops, identityLeads: network.installations.filter(i => candidates.has(i.id)).map(i => ({ ...i,
    stations: network.stations.filter(s => s.installation === i.id), segments: network.segments.filter(s => s.installation === i.id).map(s => ({ id: s.id, lines: s.lines.length, vertices: s.lines.reduce((n, l) => n + l.length, 0) })) })),
    disposition: current.cableways.review.routes.some(x => x.routeId === r.routeId) ? 'reviewed-exact-full-patterns' : trains.length ? 'not-admitted-needs-installation-and-complete-pattern-review' : 'inactive-on-both-September-fixtures',
    days: raw.snapshots.map(d => {
      const tt = d.trains.filter(t => t.routeId === r.routeId), ok = tt.filter(t => admitted(t, memo.get(directedPatternKey(t)).after))
      return { date: d.date, candidates: tt.length, admitted: ok.length, headwayInstances: tt.filter(t => t.frequency?.exactTimes === 0).length, admittedHeadwayInstances: ok.filter(t => t.frequency?.exactTimes === 0).length,
        reasons: [...new Set(tt.flatMap(t => memo.get(directedPatternKey(t)).after.filter(p => !p.path).map(p => p.reason)))] }
    }) }
})
assert.deepEqual(initial.limits, current.cableways.review.limits, 'Cableway limits changed')
const review = { schemaVersion: 1, timetableSha256: policy.timetableSha256, policySha256: sha256(await readFile('data/graubuenden-cableway-policy.json')), source: current.cableways.source,
  scope: 'Every annual canton-calling mountain route. Identity leads are exact station-number overlaps only; they do not approve installations, operators, aliases, routes or journeys. Inactive routes use annual in-canton calls, not an invented dated full journey.',
  annualMountainRoutes: inventory.length, sourceInstallations: network.installations.length, sourceStations: network.stations.length, sourceSegments: network.segments.length,
  expansion: { initialPolicySha256: current.cableways.review.initialPolicySha256, limitsUnchanged: true, trials: graubuendenCablewayTrials(raw, network, initial, current.cableways.review) },
  days, patterns: additions.map(p => ({ id: p.id, routeId: p.routeId, stopIds: p.train.calls.map(c => c.id), pairs: p.after })), inventory }
await saveJson('data/graubuenden-audit/cableways.json', review)
console.log(JSON.stringify({ routes: inventory.length, patterns: additions.length, days }))
