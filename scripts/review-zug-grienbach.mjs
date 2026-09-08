import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { loadZugRoads } from './zug-road-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export function grienbachPlatformDistances(osm, raw, review, routeId) {
  assert(!osm.remark, 'Incomplete platform response')
  assert.equal(osm.elements.length, review.osmElementCount, 'Changed platform inventory')
  const nodes = osm.elements.filter(e => e.type === 'node' && review.osmStationNumbers.includes(e.tags?.uic_ref))
  assert.equal(new Set(nodes.map(n => n.id)).size, nodes.length)
  for (const n of nodes) {
    assert(n.timestamp <= review.osmSnapshot, 'Platform newer than requested snapshot')
    assert(Number.isFinite(n.lon) && Number.isFinite(n.lat))
  }
  assert.deepEqual(nodes.filter(n => n.tags.uic_ref === '8593448').map(n => n.id).sort((a,b) => a-b), review.grienbachNodeIds, 'Changed same-UIC Grienbach candidates')
  const stops = raw.stops.filter(s => review.osmStationNumbers.includes(s.didok)).sort((a,b) => a.stop_id.localeCompare(b.stop_id))
  assert.equal(stops.length, 6, 'Incomplete reviewed platform scope')
  return stops.map(stop => {
    const candidates = nodes.filter(n => n.tags.uic_ref === stop.didok).map(n => ({ nodeId: n.id, name: n.tags.name, coordinates: [n.lon,n.lat],
      version: n.version, timestamp: n.timestamp, distanceMetres: distanceMetres([Number(stop.stop_lon),Number(stop.stop_lat)], [n.lon,n.lat]) }))
    assert.equal(candidates.length, 2, 'Each reviewed station needs both mapped positions')
    const days = raw.snapshots.map(day => {
      const contexts = new Map()
      for (const train of day.trains.filter(t => t.routeId === routeId)) for (let i=0;i<train.calls.length;i++) {
        if (train.calls[i].id !== stop.stop_id) continue
        const context = { directionId: train.directionId, previousId: train.calls[i-1]?.id ?? null, nextId: train.calls[i+1]?.id ?? null }
        const key = JSON.stringify(context), entry = contexts.get(key) ?? { ...context, trips: 0 }
        entry.trips++; contexts.set(key, entry)
      }
      return { date: day.date, contexts: [...contexts.values()] }
    })
    return { stopId: stop.stop_id, name: stop.stop_name, didok: stop.didok, coordinates: [Number(stop.stop_lon),Number(stop.stop_lat)], candidates,
      minimumSameUicDistanceMetres: Math.min(...candidates.map(n => n.distanceMetres)), days }
  })
}

async function reviewPlatforms(policy, source, raw) {
  const review = source.platformReview
  const read = async file => { const bytes = await readFile(join(policy.sourceDirectory,file)); return file.endsWith('.gz') ? gunzipSync(bytes).toString() : bytes.toString() }
  assert((await read('platforms-query.txt')).includes(`[date:"${review.osmSnapshot}"]`))
  const osm = JSON.parse(await read('platforms.json.gz'))
  const platforms = grienbachPlatformDistances(osm, raw, review, source.route.routeId)
  const city = (await read('city-direction-notice.html.gz')).replaceAll('&auml;', 'ä').replaceAll('&uuml;', 'ü')
  assert(city.includes('27.05.2025'))
  assert(city.includes('Stadteinwärts kann über die Grienbachstrasse gefahren werden.'))
  assert(city.includes('Stadtauswärts wird der Verkehr über die Industriestrasse und die Tangente zur Inwilerriedstrasse geführt.'))
  const html = await read('construction-story.html.gz'), match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  assert(match, 'Missing published construction story')
  const story = JSON.parse(match[1]).props
  assert.equal(story.itemDetails.id, review.constructionStoryId)
  assert.equal(story.itemDetails.modified, review.constructionStoryModified)
  const laterClosure = story.publishedData.nodes['n-1fKWvY'].data.text
  assert(laterClosure.includes('28.08.2026') && laterClosure.includes('11. September 2026') && laterClosure.includes('13. September 2026'))
  const notices = await readFile(review.operatorNoticesFile)
  assert.equal(sha256(notices), review.operatorNoticesSha256, 'Changed dated operator notices')
  const operator = notices.toString()
  assert(operator.includes('Grienbach in Richtung Baar, Bahnhof verschoben') && operator.includes('18.08.2025, 05:00 - 31.10.2026, 23:59'))
  assert(operator.includes('11.09.2026, 19:00 - 14.09.2026, 05:00'))
  const line = await read('operator-line604.html.gz')
  const operatorStopContexts = [...line.matchAll(/<ul class="route-line l604-border">(.*?)<\/ul>/gs)].map(([,list]) => {
    const ids = [...list.matchAll(/id="station-(\d+)"/g)].map(m => m[1]), i = ids.indexOf('93448')
    assert(i > 0 && i < ids.length-1)
    return ids.slice(i-1,i+2)
  })
  assert.deepEqual(operatorStopContexts, [['87279','93448','87280'],['87280','93448','87279']], 'Changed operator direction order')
  const map = JSON.parse(await read('construction-map.json'))
  const ignoredPopups = Object.entries(map.popups).filter(([,p]) => /Breitenbach/.test(p.description ?? '')).map(([id]) => id)
  assert.deepEqual(ignoredPopups, ['4720c634-cae1-4caa-aebb-dfa54a76845b'])
  return { source: review, platforms, operatorStopContexts, ignoredConstructionPopups: ignoredPopups,
    noticeDates: { outboundRelocation: ['2025-08-18','2026-10-31'], inboundLaterRelocation: ['2026-09-11','2026-09-14'],
      cityFullClosure: ['2026-09-11','2026-09-13'], cityClosureAnnouncement: '2026-08-28' },
    admittedFromReview: 0, coordinateCorrections: 0 }
}

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
  const platformReview = await reviewPlatforms(policy, source, raw)
  return { source, days, runs, platformReview, admittedFromTrials: 0, decision: source.decision }
}
