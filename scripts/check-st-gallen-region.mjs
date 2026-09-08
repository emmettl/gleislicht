import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sha256 } from './download-luzern-sources.mjs'
import { validateStGallenSnapshot } from './build-st-gallen-region.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const sum = (items, key) => items.reduce((n, item) => n + item[key], 0)

export async function checkStGallenRegion({ auditPath = 'data/st-gallen-audit/local-report.json', sourceDirectory = 'data/st-gallen-sources/local', timetablePath } = {}) {
  const audit = await json(auditPath), catalogue = await json(join(sourceDirectory, 'sources.json'))
  assert.equal(sha256(await readFile(join(sourceDirectory, 'sources.json'))), audit.sourceHashes.catalogue)
  assert.equal(sha256(await readFile('data/st-gallen-policy.json')), audit.sourceHashes.policy)
  for (const source of catalogue.sources) assert.equal(sha256(await readFile(join(sourceDirectory, source.file))), source.sha256, `Source hash: ${source.file}`)
  assert.equal(audit.sourceInventory.length, 226)
  assert.equal(new Set(audit.inventory.map(r => r.routeId)).size, audit.annualRouteRecords)
  assert.equal(new Set(audit.inventory.map(r => r.agencyId)).size, audit.annualAgencies)
  assert.equal(sum(audit.inventory, 'annualTripRecords'), audit.scope.annualScopedTripRecords)
  const sourceKeys = new Set(audit.sourceInventory.map(s => s.key))
  for (const route of audit.inventory) for (const key of route.sourceFeatures) assert(sourceKeys.has(key))
  let raw
  if (timetablePath) {
    assert.equal(sha256(await readFile(timetablePath)), audit.sourceHashes.timetable); raw = await json(timetablePath)
    assert.equal(raw.inventory.length, audit.annualRouteRecords)
    for (const r of raw.inventory) {
      const result = audit.inventory.find(item => item.routeId === r.routeId); assert(result)
      for (const key of ['agencyId', 'line', 'routeType', 'annualTripRecords', 'activeSourceTripRecords']) assert.deepEqual(result[key], r[key])
    }
  }
  const summaries = []
  for (const day of audit.days) {
    const manifest = await json(join(day.artifacts.directory, 'st-gallen-region-day-manifest.json')), trains = new Map()
    assert.equal(manifest.metadata.serviceDate, day.date)
    assert.equal(manifest.tripCount, day.admittedTrips)
    for (const chunk of manifest.chunks) {
      const bytes = await readFile(join(day.artifacts.directory, chunk.path))
      assert.equal(bytes.length, chunk.bytes, `Chunk length ${chunk.path}`)
      assert.equal(sha256(bytes), chunk.sha256, `Chunk hash ${chunk.path}`)
      const payload = JSON.parse(bytes)
      assert.equal(payload.trains.length, chunk.tripCount)
      assert.equal(payload.windowStart, chunk.windowStart); assert.equal(payload.windowEnd, chunk.windowEnd)
      for (const t of payload.trains) {
        assert(t.start <= chunk.windowEnd && t.end >= chunk.windowStart)
        if (trains.has(t.id)) assert.deepEqual(trains.get(t.id), t, 'Inconsistent duplicated journey across chunks')
        trains.set(t.id, t)
      }
    }
    assert.equal(trains.size, day.admittedTrips)
    const snapshot = { ...manifest, trains: [...trains.values()] }
    validateStGallenSnapshot(snapshot)
    assert.deepEqual(manifest.metadata.sourceHashes, audit.sourceHashes)
    const morning = await json(join(day.artifacts.directory, 'st-gallen-region-morning.json'))
    assert.deepEqual(morning.trains.map(t => t.id).sort(), [...trains.values()].filter(t => t.start <= 31500 && t.end >= 24300).map(t => t.id).sort())
    validateStGallenSnapshot(morning)
    for (const train of morning.trains) {
      const full = trains.get(train.id)
      assert.deepEqual(train.stops.map(([i,a,d])=>[morning.stops[i][4],a,d]),full.stops.map(([i,a,d])=>[manifest.stops[i][4],a,d]))
      assert.deepEqual(train.pathSegments.map(i=>morning.paths[i]),full.pathSegments.map(i=>manifest.paths[i]))
      assert.deepEqual(train.callRules,full.callRules)
    }
    const patterns = new Map(day.directedPatterns.map(p => [p.id, p])), pairs = new Map(day.directedStopPairs.map(p => [p.key, p]))
    assert.equal(day.directedStopPairs.filter(p => p.geometryRepairIds?.length).length, day.repairedDirectedPairs)
    assert.equal(sum(day.directedPatterns.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometryRepairIds?.length)), 'trips'), day.admittedTripsUsingRepair)
    assert.equal(patterns.size, day.patterns); assert.equal(pairs.size, day.directedPairs)
    assert.equal(sum(day.directedPatterns, 'trips'), day.trips)
    assert.equal(sum(day.directedPatterns.filter(p => p.admitted), 'trips'), day.admittedTrips)
    assert.equal(day.excludedTrips + day.admittedTrips, day.trips)
    assert.equal(day.directedPatterns.filter(p => p.admitted).length, day.admittedPatterns)
    assert.equal(sum(day.directedStopPairs, 'occurrences'), day.segmentOccurrences)
    assert.equal(sum(day.directedStopPairs.filter(p => p.matched), 'occurrences'), day.matchedSegmentOccurrences)
    assert.equal(sum(day.directedStopPairs, 'scheduledOccurrences'), day.scheduledSegmentOccurrences)
    assert.equal(sum(day.directedStopPairs, 'representativeHeadwayOccurrences'), day.representativeHeadwaySegmentOccurrences)
    assert.equal(day.scheduledSegmentOccurrences + day.representativeHeadwaySegmentOccurrences, day.segmentOccurrences)
    assert.equal(day.directedStopPairs.filter(p => p.matched).length, day.matchedDirectedPairs)
    for (const field of ['trips', 'admittedTrips', 'patterns', 'admittedPatterns', 'directedPairs', 'matchedDirectedPairs', 'segmentOccurrences', 'matchedSegmentOccurrences']) assert.equal(sum(day.groups, field), day[field], `Group ${field}`)
    assert.equal(new Set(day.routes.map(r => r.routeId)).size, day.routes.length)
    for (const route of day.routes) {
      const pp = day.directedPatterns.filter(p => p.routeId === route.routeId), sp = day.directedStopPairs.filter(p => p.routeId === route.routeId)
      assert.equal(sum(pp, 'trips'), route.trips)
      assert.equal(sum(pp.filter(p => p.admitted), 'trips'), route.admittedTrips)
      assert.equal(sum(sp, 'occurrences'), route.segmentOccurrences)
      assert.equal(sum(sp.filter(p => p.matched), 'occurrences'), route.matchedSegmentOccurrences)
    }
    for (const route of audit.inventory) {
      const count = day.routes.find(r => r.routeId === route.routeId), entry = route.days.find(d => d.date === day.date); assert(entry)
      assert.equal(entry.trips, count?.trips ?? 0); assert.equal(entry.admittedTrips, count?.admittedTrips ?? 0)
      const status = !count ? 'inactive-on-civil-day' : count.admittedTrips === count.trips ? 'admitted' : count.admittedTrips ? 'partially-admitted' : 'excluded'
      assert.equal(entry.status, status)
      assert.deepEqual([...entry.reasons].sort(), [...new Set(day.directedPatterns.filter(p => p.routeId === route.routeId).flatMap(p => p.reasons))].sort())
    }
    const patternTrips = new Map(), pairOccurrences = new Map(), admittedOccurrences = new Map()
    for (const pattern of patterns.values()) {
      assert.equal(pattern.stopIds.length, pattern.pairKeys.length + 1)
      assert.equal(pattern.admitted, pattern.reasons.length === 0)
      assert.equal(pattern.geometryPairs, pattern.pairKeys.filter(k => pairs.get(k).matched).length)
      for (let i = 0; i < pattern.pairKeys.length; i++) {
        const key = pattern.pairKeys[i], pair = pairs.get(key); assert(pair)
        assert.equal(pair.fromId, pattern.stopIds[i]); assert.equal(pair.toId, pattern.stopIds[i + 1])
        pairOccurrences.set(key, (pairOccurrences.get(key) ?? 0) + pattern.trips)
        if (pattern.admitted) admittedOccurrences.set(key, (admittedOccurrences.get(key) ?? 0) + pattern.trips)
      }
    }
    for (const pair of pairs.values()) {
      assert.equal(pairOccurrences.get(pair.key), pair.occurrences)
      assert.equal(admittedOccurrences.get(pair.key) ?? 0, pair.admittedOccurrences)
    }
    const sourceTrains = raw ? new Map(raw.snapshots.find(d => d.date === day.date).trains.map(t => [t.id, t])) : undefined
    if (sourceTrains) {
      assert.equal(sourceTrains.size, day.trips)
      const replayCounts = new Map()
      for (const source of sourceTrains.values()) {
        const key = JSON.stringify([source.routeId, source.directionId ?? '', source.calls.map(c => [c.id, c.pickupType ?? '0', c.dropOffType ?? '0'])])
        const id = sha256(key).slice(0, 20), pattern = patterns.get(id)
        assert(pattern, 'Source pattern silently omitted')
        assert.deepEqual(source.calls.map(c => c.id), pattern.stopIds)
        assert.deepEqual(source.calls.map(c => [c.pickupType, c.dropOffType]), pattern.callRules)
        assert.equal(trains.has(source.id), pattern.admitted)
        replayCounts.set(id, (replayCounts.get(id) ?? 0) + 1)
      }
      for (const p of patterns.values()) assert.equal(replayCounts.get(p.id), p.trips)
    }
    for (const train of trains.values()) {
      const pattern = patterns.get(train.patternId); assert(pattern?.admitted)
      patternTrips.set(pattern.id, (patternTrips.get(pattern.id) ?? 0) + 1)
      assert.deepEqual(train.stops.map(([i]) => manifest.stops[i][4]), pattern.stopIds)
      assert.deepEqual(train.callRules, pattern.callRules)
      for (let i = 0; i < train.pathSegments.length; i++) assert.equal(sha256(JSON.stringify(manifest.paths[train.pathSegments[i]])), pairs.get(pattern.pairKeys[i]).geometrySha256)
      if (sourceTrains) {
        const source = sourceTrains.get(train.id); assert(source)
        assert.equal(train.sourceServiceDate, source.sourceServiceDate)
        assert.equal(train.sourceTripId, source.sourceTripId)
        assert.deepEqual(train.frequency, source.frequency)
        assert.deepEqual(train.stops.map(([i, a, d]) => [manifest.stops[i][4], a, d]), source.calls.map(c => [c.id, c.arrival, c.departure]), 'Dropped or changed source call')
        assert.deepEqual(train.sourceCallSequences, source.calls.map(c => c.sequence))
      }
    }
    for (const p of patterns.values()) assert.equal(patternTrips.get(p.id) ?? 0, p.admitted ? p.trips : 0)
    assert.equal([...trains.values()].filter(t => t.sourceServiceDate !== day.date).length, day.admittedCarryInTrips)
    assert.equal([...trains.values()].filter(t => t.frequency?.exactTimes === 0).length, day.admittedHeadwayTrips)
    summaries.push({ date: day.date, admittedTrips: trains.size, completeDirectedPatterns: day.admittedPatterns, sourceCallReplay: Boolean(raw) })
  }
  return { passed: true, annualRoutes: audit.annualRouteRecords, agencies: audit.annualAgencies, days: summaries }
}

// This review-only check uses tracked metadata, never the ignored geometry/feed
// cache. The full check above additionally replays every original source trip.
export async function checkStGallenAudit(directory = 'data/st-gallen-audit') {
  const summary = await json(join(directory, 'summary.json'))
  for (const [name, record] of Object.entries(summary.files)) assert.equal(sha256(await readFile(join(directory, name))), record.sha256, `Audit file ${name}`)
  assert.equal(sha256(await readFile('data/st-gallen-policy.json')), summary.sourceHashes.policy)
  assert.equal(sha256(await readFile('data/st-gallen-sources/sources.json')), summary.sourceHashes.catalogue)
  assert.equal(sha256(await readFile('data/st-gallen-sources/boundary.json')), summary.sourceHashes.boundary)
  const inventory = await json(join(directory, 'routes.json')), sources = await json(join(directory, 'source-lines.json'))
  assert.equal(inventory.length, summary.annualRouteRecords)
  assert.equal(new Set(inventory.map(r => r.routeId)).size, inventory.length)
  assert.equal(new Set(inventory.map(r => r.agencyId)).size, summary.annualAgencies)
  assert.equal(sum(inventory, 'annualTripRecords'), summary.scope.annualScopedTripRecords)
  assert.equal(sources.length, 226)
  const keys = new Set(sources.map(s => s.key)), routes = new Map(inventory.map(r => [r.routeId, r]))
  assert.equal(keys.size, sources.length)
  for (const source of sources) {
    assert.deepEqual(source.gtfsRoutes.sort(), inventory.filter(r => r.sourceFeatures.includes(source.key)).map(r => r.routeId).sort())
    for (const routeId of source.gtfsRoutes) {
      const route = routes.get(routeId)
      assert(source.agencyIds.includes(route.agencyId) && source.mode === route.mode && source.lines.includes(route.line))
    }
  }
  for (const route of inventory) for (const key of route.sourceFeatures) assert(keys.has(key))
  const index = await json('data/st-gallen-region/index.json')
  assert(index.localOnly && index.redistributionApproved === false)
  assert.deepEqual(index.sourceHashes, summary.sourceHashes)
  assert.equal(summary.validation.cantonMotionCoverageComplete, false)
  const results = []
  for (const expected of summary.days) {
    const day = await json(join(directory, `${expected.date}.json`))
    const { directedPatterns, directedStopPairs, routes: counts, ...rest } = day
    assert.deepEqual(rest, expected)
    assert.equal(directedPatterns.length, day.patterns)
    assert.equal(directedStopPairs.length, day.directedPairs)
    assert.equal(sum(directedPatterns, 'trips'), day.trips)
    assert.equal(sum(directedPatterns.filter(p => p.admitted), 'trips'), day.admittedTrips)
    assert.equal(directedPatterns.filter(p => p.admitted).length, day.admittedPatterns)
    assert.equal(day.excludedTrips + day.admittedTrips, day.trips)
    assert.equal(sum(directedStopPairs, 'occurrences'), day.segmentOccurrences)
    assert.equal(sum(directedStopPairs.filter(p => p.matched), 'occurrences'), day.matchedSegmentOccurrences)
    assert.equal(sum(directedStopPairs, 'scheduledOccurrences'), day.scheduledSegmentOccurrences)
    assert.equal(sum(directedStopPairs.filter(p => p.matched), 'scheduledOccurrences'), day.matchedScheduledSegmentOccurrences)
    assert.equal(sum(directedStopPairs, 'representativeHeadwayOccurrences'), day.representativeHeadwaySegmentOccurrences)
    assert.equal(day.scheduledSegmentOccurrences + day.representativeHeadwaySegmentOccurrences, day.segmentOccurrences)
    assert.equal(directedStopPairs.filter(p => p.matched).length, day.matchedDirectedPairs)
    const patterns = new Map(directedPatterns.map(p => [p.id,p])), pairs = new Map(directedStopPairs.map(p => [p.key,p]))
    assert.equal(patterns.size, day.patterns); assert.equal(pairs.size, day.directedPairs)
    const occurrences = new Map(), admittedOccurrences = new Map(), reasons = new Map()
    for (const p of patterns.values()) {
      assert.equal(sha256(JSON.stringify([p.routeId,p.directionId ?? '',p.stopIds.map((id,i)=>[id,...p.callRules[i]])])).slice(0,20),p.id)
      assert.equal(p.stopIds.length, p.pairKeys.length + 1)
      assert.equal(p.admitted, !p.reasons.length)
      const matched = p.pairKeys.filter(k => pairs.get(k)?.matched).length
      assert.equal(p.geometryPairs, matched)
      if (p.admitted) assert.equal(matched,p.totalPairs)
      const expectedReasons = new Set()
      for (let i=0;i<p.pairKeys.length;i++) {
        const key=p.pairKeys[i], pair=pairs.get(key);assert(pair)
        assert.equal(pair.key,JSON.stringify([p.routeId,p.stopIds[i],p.stopIds[i+1]]))
        assert.equal(pair.fromId,p.stopIds[i]);assert.equal(pair.toId,p.stopIds[i+1])
        assert.equal(pair.routeId,p.routeId)
        assert.equal(pair.agencyId,routes.get(p.routeId).agencyId)
        if (!pair.matched) expectedReasons.add(pair.reason)
        else { assert(/^[a-f0-9]{64}$/.test(pair.geometrySha256)); for (const source of pair.sourceFeatures) assert(keys.has(source)) }
        occurrences.set(key,(occurrences.get(key)??0)+p.trips)
        if(p.admitted) admittedOccurrences.set(key,(admittedOccurrences.get(key)??0)+p.trips)
      }
      if (p.callRules.some(r => r.some(code=>['2','3'].includes(code)))) expectedReasons.add('prior-arrangement-call')
      assert.deepEqual([...expectedReasons].sort(),[...p.reasons].sort())
      for(const reason of p.reasons) reasons.set(reason,(reasons.get(reason)??0)+p.trips)
    }
    assert.deepEqual(Object.fromEntries(reasons),day.exclusionReasons)
    for(const pair of pairs.values()) {
      assert.equal(occurrences.get(pair.key),pair.occurrences)
      assert.equal(admittedOccurrences.get(pair.key)??0,pair.admittedOccurrences)
    }
    for (const field of ['trips','admittedTrips','patterns','admittedPatterns','directedPairs','matchedDirectedPairs','segmentOccurrences','matchedSegmentOccurrences']) assert.equal(sum(day.groups,field),day[field])
    for (const route of inventory) {
      const pp=directedPatterns.filter(p=>p.routeId===route.routeId), entry=route.days.find(d=>d.date===day.date)
      assert.equal(entry.trips,sum(pp,'trips'));assert.equal(entry.admittedTrips,sum(pp.filter(p=>p.admitted),'trips'))
      assert.equal(entry.status,!entry.trips?'inactive-on-civil-day':entry.admittedTrips===entry.trips?'admitted':entry.admittedTrips?'partially-admitted':'excluded')
      assert.deepEqual(entry.reasons.sort(),[...new Set(pp.flatMap(p=>p.reasons))].sort())
    }
    assert.equal(sum(counts,'trips'),day.trips);assert.equal(sum(counts,'admittedTrips'),day.admittedTrips)
    const entry=index.days.find(d=>d.date===day.date);assert(entry)
    assert.equal(entry.trips,day.admittedTrips);assert.equal(entry.patterns,day.admittedPatterns)
    results.push({date:day.date,admittedTrips:day.admittedTrips,patterns:day.admittedPatterns})
  }
  return {passed:true,annualRoutes:inventory.length,agencies:summary.annualAgencies,days:results,sourceCallReplay:false}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(process.argv.includes('--audit-only') ? await checkStGallenAudit() : await checkStGallenRegion({ timetablePath: process.argv[2] ?? 'data/st-gallen-sources/local/timetable.json' }), null, 2))
