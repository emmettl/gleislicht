import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadZugRoads } from './zug-road-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

// Diagnostic only: this module deliberately exposes no matching/admission API.
// A smaller offset is insufficient evidence to substitute a questionable loop.
export async function reviewZugGrienbach(policy, roadPolicy, raw, timetableHash) {
  const bytes = await readFile(join(policy.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), policy.sourceSha256, 'Changed Grienbach review catalogue')
  const source = JSON.parse(bytes)
  for (const file of source.files) assert.equal(sha256(await readFile(join(policy.sourceDirectory, file.file))), file.sha256, 'Changed Grienbach trial evidence')
  assert.deepEqual(source.runs.map(r => r.id), ['control', 'station-radius-100', 'coordinate-only'])
  const baseline = await readFile(roadPolicy.configFile, 'utf8')
  const expectedConfigs = [baseline,
    baseline.replace('osm_max_station_cand_distance: 200', 'osm_max_station_cand_distance: 100'),
    baseline.replace('[bus, coach]\n', '[bus, coach]\nrouting_use_stations: false\n')]
  const days = raw.snapshots.map(day => {
    const trains = day.trains.filter(t => t.routeId === source.route.routeId)
    const intervals = trains.flatMap(t => t.calls.slice(1).flatMap((call, i) => t.calls[i].id === source.pairs[1][0] && call.id === source.pairs[1][1] ? [{ sourceTripId: t.sourceTripId, fromSequence: t.calls[i].sequence, toSequence: call.sequence, seconds: call.arrival - t.calls[i].departure }] : []))
    assert(intervals.every(i => i.seconds > 0), 'Invalid source interval')
    return { date: day.date, routeTrips: trains.length, affectedTrips: intervals.length,
      intervalSeconds: [...new Set(intervals.map(i => i.seconds))].sort((a, b) => a - b) }
  })
  const runs = []
  for (const [index, run] of source.runs.entries()) {
    assert.equal(await readFile(run.configFile, 'utf8'), expectedConfigs[index], 'Unreviewed trial configuration change')
    assert.equal(run.binarySha256, roadPolicy.binarySha256)
    assert.equal(run.patternsSha256, source.runs[0].patternsSha256, 'Trial input patterns differ')
    const roads = await loadZugRoads({ ...run, routes: [source.route], limits: roadPolicy.limits }, raw, timetableHash)
    assert.deepEqual(roads.source.source, source.source)
    assert.equal(roads.inventory.length, 4, 'Trial omits a full line 604 pattern')
    const cache = JSON.parse(await readFile(run.cacheFile)), report = cache.agencies['839'].cache.report
    const pairs = source.pairs.map(([fromId, toId]) => {
      const candidate = roads.candidates.get(JSON.stringify([source.route.routeId, fromId, toId]))
      assert(candidate, 'Missing reviewed pair')
      if (index === 0) assert.equal(candidate.reason, 'road-matcher-rejected')
      else assert(candidate.path, 'Diagnostic trial failed geometry checks')
      const path = candidate.path
      return { fromId, toId, geometryPasses: Boolean(path), reason: candidate.reason ?? null,
        roadPatternIds: candidate.roadPatternIds, occurrences: candidate.roadContextOccurrences,
        geometrySha256: path ? sha256(JSON.stringify(path)) : null,
        lengthMetres: candidate.lengthMetres ?? null,
        repeatedVertices: path ? path.filter((p, i) => path.findIndex(q => JSON.stringify(q) === JSON.stringify(p)) < i).length : null }
    })
    const timedPair = pairs[1]
    if (index > 0) assert(timedPair.repeatedVertices > 0, 'Roundabout finding needs fresh review')
    runs.push({ id: run.id, matcher: cache.agencies['839'].cache.metadata.matcher, report, pairs,
      impliedAverageKmh: timedPair.lengthMetres === null ? [] : days.map(d => ({ date: d.date, values: d.intervalSeconds.map(seconds => timedPair.lengthMetres * 3.6 / seconds) })) })
  }
  return { source, days, runs, admittedFromTrials: 0, decision: source.decision }
}
