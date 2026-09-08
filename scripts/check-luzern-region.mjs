import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sha256, validateLuzernDownload } from './download-luzern-sources.mjs'
import { validateLuzernSnapshot } from './build-luzern-region.mjs'
import { validatedLuzernRepairs } from './luzern-line-geometry.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const sum = (items, key) => items.reduce((n, item) => n + item[key], 0)

export async function checkLuzernRegion({ auditPath = 'data/luzern-study-audit.json', sourceDirectory = 'data/luzern-sources', timetablePath } = {}) {
  const audit = await json(auditPath), catalogue = await json(join(sourceDirectory, 'sources.json'))
  assert.equal(sha256(await readFile(join(sourceDirectory, 'sources.json'))), audit.sourceHashes.catalogue)
  assert.equal(sha256(await readFile('data/luzern-policy.json')), audit.sourceHashes.policy)
  for (const source of catalogue.sources) assert.equal(sha256(await readFile(join(sourceDirectory, source.file))), source.sha256, `Source hash: ${source.file}`)
  for (const layer of ['bus', 'rail', 'boat', 'stops']) validateLuzernDownload(await json(join(sourceDirectory, `${layer}.geojson`)), (await json(join(sourceDirectory, `${layer}-ids.json`))).objectIds)
  assert.equal(audit.sourceInventory.length, 144)
  assert.equal(new Set(audit.inventory.map(r => r.routeId)).size, audit.annualRouteRecords)
  assert.equal(new Set(audit.inventory.map(r => r.agencyId)).size, audit.annualAgencies)
  assert.equal(sum(audit.inventory, 'annualTripRecords'), audit.scope.annualScopedTripRecords)
  const sourceKeys = new Set(audit.sourceInventory.map(s => s.key))
  const repairs = validatedLuzernRepairs({ bus: await json(join(sourceDirectory, 'bus.geojson')) }, audit.policy)
  const repairIds = new Set(repairs.map(r => r.id))
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
    const manifest = await json(join(day.artifacts.directory, 'luzern-region-day-manifest.json')), trains = new Map()
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
    validateLuzernSnapshot(snapshot)
    assert.deepEqual(manifest.metadata.sourceHashes, audit.sourceHashes)
    const morning = await json(join(day.artifacts.directory, 'luzern-region-morning.json'))
    assert.deepEqual(morning.trains.map(t => t.id).sort(), [...trains.values()].filter(t => t.start <= 31500 && t.end >= 24300).map(t => t.id).sort())
    const patterns = new Map(day.directedPatterns.map(p => [p.id, p])), pairs = new Map(day.directedStopPairs.map(p => [p.key, p]))
    assert.equal(day.directedStopPairs.filter(p => p.geometryRepairIds?.length).length, day.repairedDirectedPairs)
    assert.equal(sum(day.directedPatterns.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometryRepairIds?.length)), 'trips'), day.admittedTripsUsingRepair)
    for (const p of pairs.values()) for (const id of p.geometryRepairIds ?? []) assert(repairIds.has(id), 'Unknown geometry repair')
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(await checkLuzernRegion({ timetablePath: process.argv[2] }), null, 2))
