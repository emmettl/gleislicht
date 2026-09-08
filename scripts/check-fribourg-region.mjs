import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { bernPatternId } from './bern-line-geometry.mjs'
import { fribourgFeatureMatch, FRIBOURG_LIMITS } from './fribourg-line-geometry.mjs'
import { validateBernSnapshot, validateBernChunks } from './build-bern-region.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const sum = (rows, fn) => rows.reduce((n, row) => n + fn(row), 0)

export async function checkFribourgRegion({ output = 'data/fribourg-region', audit = 'data/fribourg-audit', sources = 'data/fribourg-sources' } = {}) {
  const summary = await json(join(audit, 'summary.json')), routes = await json(join(audit, 'routes.json'))
  const sourceLines = await json(join(audit, 'source-lines.json'))
  const decodedBytes = await readFile(join(sources, 'decoded.json.gz')), decoded = JSON.parse(gunzipSync(decodedBytes))
  const crosswalk = await json('data/fribourg-policy.json')
  assert.equal(summary.routeCount, 207)
  assert.equal(summary.agencyCount, 17)
  assert.equal(summary.sources.publicRedistributionCleared, true)
  assert.equal(summary.sources.dataUpdated, null)
  assert.equal(sha(decodedBytes), summary.sourceHashes.source)
  assert.equal(sha(await readFile(join(sources, 'sources.json'))), summary.sourceHashes.provenance)
  decoded.metadata = await json(join(sources, 'sources.json'))
  for (const record of decoded.metadata.acquisition.sources) assert.equal(sha(await readFile(join(sources, record.file))), record.sha256)
  const item = await json(join(sources, 'ogd-catalogue-item.json')), service = await json(join(sources, 'ogd-service.json'))
  const ogd = await json(join(sources, 'ogd-lines.json'))
  assert.equal(item.id, service.serviceItemId)
  assert.equal(item.url, decoded.metadata.reuseEvidence.featureServiceUrl.replace(/\/1$/, ''))
  assert.equal(item.licenseInfo, decoded.metadata.reuseEvidence.licenseInfo)
  assert.equal(item.access, 'public')
  assert(!ogd.exceededTransferLimit && !ogd.error)
  assert.equal(ogd.features.length, decoded.lines.length)
  assert.equal(new Set(ogd.features.map(f => f.attributes.OBJECTID)).size, decoded.lines.length)
  for (const line of decoded.lines) {
    const equivalent = ogd.features.find(f => f.attributes.OBJECTID === line.properties.OBJECTID)
    assert.deepEqual(equivalent.geometry.paths, line.geometry.coordinates)
    for (const [key, value] of Object.entries(line.properties)) assert.equal(equivalent.attributes[key], value)
  }
  assert.equal(sha(await readFile('data/fribourg-policy.json')), summary.sourceHashes.crosswalk)
  for (const document of crosswalk.supportingDocuments ?? []) {
    assert.equal(sha(await readFile(join(sources, document.file))), document.sha256)
    assert.equal(sha(await readFile(join(output, document.file))), document.sha256)
  }
  assert.equal(sha(await readFile(join(sources, 'boundary.json.gz'))), decoded.metadata.boundary.snapshotSha256)
  assert.equal(routes.length, summary.routeCount); assert.equal(new Set(routes.map(r => r.id)).size, routes.length)
  assert.equal(new Set(routes.map(r => r.agencyId)).size, summary.agencyCount)
  assert.equal(sourceLines.length, 128); assert.equal(new Set(sourceLines.map(s => s.OBJECTID)).size, 128)
  assert.equal(summary.districts.length, 7)
  assert(summary.districts.every(d => d.calledPlatforms > 0 && d.routeIds.length > 0))
  for (const route of routes) {
    assert(route.allYearTripRecords > 0 && route.inCantonStops.length > 0 && route.districts.length > 0)
    assert.deepEqual(decoded.lines.filter(f => fribourgFeatureMatch(route, f, crosswalk)).map(f => String(f.properties.OBJECTID)).sort(), route.sourceLines)
    const trips = sum(route.days, d => d.trips), admitted = sum(route.days, d => d.admittedTrips)
    assert.equal(route.status, !trips ? 'inactive-on-validation-dates' : !admitted ? 'excluded' : admitted === trips ? 'admitted-all-dated-trips' : 'partially-admitted')
  }
  for (const line of sourceLines) assert.deepEqual(line.routeIds.sort(), routes.filter(r => r.sourceLines.includes(String(line.OBJECTID))).map(r => r.id).sort())
  for (const term of decoded.metadata.termsFiles) assert.deepEqual(await readFile(join(sources, term)), await readFile(join(output, term)))
  const patternSets = []
  for (const day of summary.days) {
    const report = await json(join(audit, `${day.serviceDate}.json`))
    assert.deepEqual(report.sourceHashes, summary.sourceHashes)
    assert.deepEqual(report.coverage, day.coverage)
    assert.deepEqual(report.topologyRepairEffect.repairs, crosswalk.topologyRepairs)
    assert.equal(report.topologyRepairEffect.lostAdmittedTrips, 0)
    assert.equal(report.topologyRepairEffect.newlyAdmittedTrips,
      report.topologyRepairEffect.repairedAdmittedTrips - report.topologyRepairEffect.baselineAdmittedTrips)
    assert.equal(new Set(report.patterns.map(p => p.id)).size, report.patterns.length)
    patternSets.push(new Set(report.patterns.map(p => p.id)))
    const pairCounts = new Map(), byPattern = new Map(report.patterns.map(p => [p.id, p]))
    for (const p of report.patterns) {
      assert.equal(p.segmentCount, p.stopIds.length - 1)
      assert.equal(p.matchedMask.length, p.segmentCount)
      assert.equal(p.matchedSegments, p.matchedMask.filter(Boolean).length)
      assert.equal(sum(Object.values(p.decisions), n => n), p.trips)
      assert.equal(p.decisions.admitted ?? 0, p.admittedTrips)
      if (p.admittedTrips) assert.equal(p.matchedSegments, p.segmentCount)
      for (let i = 1; i < p.stopIds.length; i++) {
        const key = JSON.stringify([p.routeId, p.stopIds[i - 1], p.stopIds[i]])
        const pair = pairCounts.get(key) ?? { occurrences: 0, admitted: 0, matched: p.matchedMask[i - 1] }
        assert.equal(pair.matched, p.matchedMask[i - 1])
        pair.occurrences += p.trips; pair.admitted += p.admittedTrips; pairCounts.set(key, pair)
      }
    }
    assert.equal(pairCounts.size, report.directedPairs.length)
    for (const p of report.directedPairs) {
      assert.deepEqual(pairCounts.get(JSON.stringify([p.routeId, p.fromId, p.toId])), { occurrences: p.occurrences, admitted: p.admittedOccurrences, matched: p.matched })
      if (!p.matched) assert(['missing-line', 'endpoint-gap', 'disconnected-line', 'implausible-detour', 'collapsed-path'].includes(p.reason))
      else {
        assert(p.maximumSnapMetres <= FRIBOURG_LIMITS[p.mode].snapMetres)
        assert(p.pathMetres >= 1 && Number.isFinite(p.pathMetres))
        if (p.projectionChoice) assert(p.projectionChoice.maximumAdditionalSnapMetres <= FRIBOURG_LIMITS[p.mode].alternativeSnapMetres)
      }
    }
    const c = report.coverage
    assert.equal(c.trips, sum(report.patterns, p => p.trips))
    assert.equal(c.admittedTrips, sum(report.patterns, p => p.admittedTrips))
    assert.equal(c.patterns, report.patterns.length)
    assert.equal(c.directedPairs, report.directedPairs.length)
    assert.equal(c.matchedDirectedPairs, report.directedPairs.filter(p => p.matched).length)
    assert.equal(c.segmentOccurrences, sum(report.patterns, p => p.trips * p.segmentCount))
    assert.equal(c.matchedSegmentOccurrences, sum(report.patterns, p => p.trips * p.matchedSegments))
    assert.equal(c.scheduledSegmentOccurrences, sum(report.patterns, p => (p.trips - p.representativeHeadwayTrips) * p.segmentCount))
    assert.equal(c.matchedScheduledSegmentOccurrences, sum(report.patterns, p => (p.trips - p.representativeHeadwayTrips) * p.matchedSegments))
    for (const field of ['trips', 'admittedTrips', 'segmentOccurrences', 'matchedSegmentOccurrences', 'directedPairs', 'patterns']) {
      assert.equal(c[field], sum(report.groups, g => g[field]), `Group mismatch ${field}`)
      assert.equal(c[field], sum(routes, r => r.days.find(d => d.date === day.serviceDate)[field]), `Route mismatch ${field}`)
    }
    const directory = join(output, day.serviceDate), manifest = await json(join(directory, 'fribourg-region-day-manifest.json'))
    assert.deepEqual(manifest.metadata.sourceHashes, summary.sourceHashes)
    assert.equal(manifest.metadata.publicRedistributionCleared, true)
    assert.equal(manifest.metadata.geometry.attribution, 'Source: Etat de Fribourg')
    assert.equal(manifest.metadata.geometry.dataUpdated, null)
    assert.equal(manifest.metadata.publisher, 'Gleislicht')
    const chunks = await Promise.all(manifest.chunks.map(async descriptor => ({ descriptor, payload: await json(join(directory, descriptor.path)) })))
    const trains = [...new Map(chunks.flatMap(c => c.payload.trains).map(t => [t.id, t])).values()]
    const snapshot = { ...manifest, trains }
    validateBernSnapshot(snapshot); validateBernChunks(snapshot, manifest, chunks)
    assert.equal(trains.length, c.admittedTrips)
    const admittedPatternTrips = new Map()
    for (const train of trains) {
      const expectedRepairs = crosswalk.topologyRepairs.filter(repair => routes.find(r => r.id === train.routeId).sourceLines.includes(String(repair.sourceId))).map(repair => repair.id)
      assert.deepEqual(train.geometryInference?.sourceTopologyRepairs ?? [], expectedRepairs)
      assert.equal(bernPatternId(train, snapshot.stops), train.patternId)
      const pattern = byPattern.get(train.patternId)
      assert(pattern?.admittedTrips && pattern.matchedMask.every(Boolean))
      assert.deepEqual(train.stops.map(([i]) => snapshot.stops[i][4]), pattern.stopIds)
      admittedPatternTrips.set(train.patternId, (admittedPatternTrips.get(train.patternId) ?? 0) + 1)
    }
    for (const p of report.patterns) assert.equal(admittedPatternTrips.get(p.id) ?? 0, p.admittedTrips)
    const morning = await json(join(directory, 'fribourg-region-morning.json'))
    validateBernSnapshot(morning)
    assert(morning.trains.every(t => trains.some(source => source.id === t.id)))
    console.log(`${day.serviceDate}: ${trains.length} journeys, ${report.patterns.length} directed patterns, 12 verified chunks`)
  }
  assert.equal(summary.weekdaySundayPatterns.shared, [...patternSets[0]].filter(id => patternSets[1].has(id)).length)
  assert.equal(summary.weekdaySundayPatterns.weekdayOnly, [...patternSets[0]].filter(id => !patternSets[1].has(id)).length)
  assert.equal(summary.weekdaySundayPatterns.sundayOnly, [...patternSets[1]].filter(id => !patternSets[0].has(id)).length)
  assert.deepEqual(summary.boundarySensitivity.routeIds, routes.filter(r => r.boundarySensitive).map(r => r.id))
  assert.deepEqual(summary.boundarySensitivity.routeIds, ['96-247-j26-1'])
  assert.equal(routes.find(r => r.id === '96-247-j26-1').status, 'excluded')
  console.log(`Fribourg audit reconciles: ${routes.length} routes, ${summary.agencyCount} agencies, all 7 districts, ${sourceLines.length} source lines`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await checkFribourgRegion()
