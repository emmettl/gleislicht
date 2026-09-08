import assert from 'node:assert/strict'
import { BROC_STOPS } from './fribourg-broc.mjs'
const BROC_PAIRS = [BROC_STOPS]
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'

const baseline = '4da95ce'
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
  assert(added.every(t => t.roadReviewKinds?.includes('broc-station-calls')), 'New journey outside Broc evidence')
  assert.equal(added.length, date === '2026-09-04' ? 20 : 16)
  for (const t of added) {
    assert.equal(t.routeId, '92-260-j26-1')
    const stopIds = t.stops.map(([i]) => b.stops[i][4])
    const matches = BROC_PAIRS.flatMap((pair, p) => stopIds.flatMap((id, i) => id === pair[0] && stopIds[i + 1] === pair[1] ? [{ p, i }] : []))
    assert.equal(matches.length, 1)
    const { i } = matches[0]
    assert.equal(t.directionId, '0')
    assert(i > 0 && i < t.stops.length - 2)
    assert.equal(t.stops[i + 1][1] - t.stops[i][2], 480, 'Changed original eight-minute Broc interval')
  }

  days.push({ date, previousJourneys: previous.size, presentJourneys: present.size, addedJourneys: added.length,
    unchangedOriginalSegmentOccurrences: unchangedSegments, lostJourneys: 0,
    newJourneys: added.map(t => ({ id: t.id, routeId: t.routeId, sourceServiceDate: t.sourceServiceDate, directionId: t.directionId,
      reviewedCalls: t.stops.filter(([i]) => BROC_PAIRS.flat().includes(b.stops[i][4])).map(([i, ...times]) => [b.stops[i], ...times]), reviewKinds: t.roadReviewKinds })) })
}
const summary = await current('data/fribourg-audit/summary.json')
await writeFile('data/fribourg-audit/broc-regression.json', JSON.stringify({ baselineCommit: execFileSync('git', ['rev-parse', baseline]).toString().trim(), sourceHashes: summary.sourceHashes,
  assertions: 'Every previously admitted journey retains its original stop identity, coordinates, call permissions, times, direction and segment geometry. Added journeys must carry reviewed Broc road evidence.', days }, null, 2) + '\n')
console.log(days.map(({ newJourneys: _new, ...d }) => d))
