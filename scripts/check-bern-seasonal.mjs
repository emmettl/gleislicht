import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
const sha = b => createHash('sha256').update(b).digest('hex')
const summary = JSON.parse(await readFile('data/bern-audit/seasonal-summary.json'))
const bytes = await readFile('data/bern-audit/seasonal-patterns.json.gz')
assert.equal(sha(bytes), summary.patternEvidenceSha256)
const evidence = JSON.parse(gunzipSync(bytes))
const current = JSON.parse(await readFile('data/bern-audit/summary.json'))
for (const key of ['archive', 'source', 'crosswalk', 'mountainPolicy']) assert.equal(summary.sourceHashes[key], current.sourceHashes[key])
assert.deepEqual(evidence.map(d => d.date), Object.values(summary.dateSelection).flat())
assert.equal(summary.routes.length, 705); assert.equal(new Set(summary.routes.map(r => r.routeId)).size, 705)
for (const day of summary.days) {
  const patterns = evidence.find(d => d.date === day.date).patterns
  assert.equal(patterns.length, day.patterns)
  assert.equal(new Set(patterns.map(p => p.id)).size, patterns.length)
  assert.equal(patterns.reduce((n, p) => n + p.trips, 0), day.trips)
  assert.equal(patterns.reduce((n, p) => n + p.admittedTrips, 0), day.admittedTrips)
  for (const p of patterns) {
    assert.equal(p.stopIds.length - 1, p.segmentCount); assert.equal(p.segmentCount, p.matchedMask.length)
    assert.equal(p.matchedSegments, p.matchedMask.filter(Boolean).length)
    assert.equal(Object.values(p.decisions).reduce((n, c) => n + c, 0), p.trips)
    assert.equal(p.decisions.admitted ?? 0, p.admittedTrips)
    if (p.admittedTrips) assert.equal(p.matchedSegments, p.segmentCount)
    assert(!p.supplementalSources || p.supplementalSources.every(id => id === '73.213'), 'September supplements leaked into seasonal audit')
  }
  for (const r of summary.routes) {
    const row = r.days.find(d => d.date === day.date), selected = patterns.filter(p => p.routeId === r.routeId)
    assert.equal(row.trips, selected.reduce((n, p) => n + p.trips, 0))
    assert.equal(row.admittedTrips, selected.reduce((n, p) => n + p.admittedTrips, 0))
  }
}
assert.deepEqual(summary.newlyActiveRoutes, summary.routes.filter(r => r.inactiveInSeptember && r.days.some(d => d.trips)).map(r => r.routeId))
assert.deepEqual(summary.stillInactiveRoutes, summary.routes.filter(r => r.inactiveInSeptember && r.days.every(d => !d.trips)).map(r => r.routeId))
console.log(`${summary.days.length} seasonal dates reconcile; ${summary.newlyActiveRoutes.length} newly active routes; ${summary.stillInactiveRoutes.length} remain inactive`)
