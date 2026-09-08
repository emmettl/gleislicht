import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'

const baseline = '0f9e9a3'
const old = file => JSON.parse(execFileSync('git', ['show', `${baseline}:${file}`], { maxBuffer: 128 * 1024 * 1024 }))
const current = async file => JSON.parse(await readFile(file))
const days = []
for (const date of ['2026-09-04', '2026-09-06']) {
  const dir = `data/fribourg-region/${date}`, file = `${dir}/fribourg-region-day-manifest.json`
  const a = old(file), b = await current(file)
  const previous = new Map(a.chunks.flatMap(c => old(`${dir}/${c.path}`).trains).map(t => [t.id, t]))
  const present = new Map((await Promise.all(b.chunks.map(c => current(`${dir}/${c.path}`)))).flatMap(c => c.trains).map(t => [t.id, t]))
  let unchangedSegments = 0
  for (const [id, t] of previous) {
    const u = present.get(id); assert(u, `Lost admitted journey ${id}`)
    for (const key of ['sourceTripId', 'sourceServiceDate', 'routeId', 'agencyId', 'directionId', 'sourceCallCount', 'callPermissions']) assert.deepEqual(u[key], t[key], `Changed identity ${id}: ${key}`)
    assert.deepEqual(u.stops.map(([i, ...times]) => [b.stops[i], ...times]), t.stops.map(([i, ...times]) => [a.stops[i], ...times]), `Changed original calls/times ${id}`)
    assert.deepEqual(u.pathSegments.map(i => b.paths[i]), t.pathSegments.map(i => a.paths[i]), `Changed accepted geometry ${id}`)
    unchangedSegments += t.pathSegments.length
  }
  const added = [...present.values()].filter(t => !previous.has(t.id))
  assert(added.every(t => t.railReviewKinds?.length), 'New journey outside reviewed evidence')
  days.push({ date, previousJourneys: previous.size, presentJourneys: present.size, addedJourneys: added.length,
    unchangedOriginalSegmentOccurrences: unchangedSegments, lostJourneys: 0,
    newJourneys: added.map(t => ({ id: t.id, routeId: t.routeId, reviewKinds: t.railReviewKinds })) })
}
const summary = await current('data/fribourg-audit/summary.json')
await writeFile('data/fribourg-audit/rail-review-regression.json', JSON.stringify({ baselineCommit: execFileSync('git', ['rev-parse', baseline]).toString().trim(), sourceHashes: summary.sourceHashes,
  assertions: 'Every previously admitted journey retains its original stop identity, coordinates, call permissions, times, direction and segment geometry. Added journeys must carry reviewed rail evidence.', days }, null, 2) + '\n')
console.log(days.map(({ newJourneys: _new, ...d }) => d))
