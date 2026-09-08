import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { readBernTimetables } from './bern-timetable.mjs'
import { compactBernFeed, bernCoverage, validateBernSnapshot, validateBernChunks } from './build-bern-region.mjs'
import { applyFribourgGeometry, fribourgFeatureIdentity, FRIBOURG_LIMITS } from './fribourg-line-geometry.mjs'
import { hashFile } from './fribourg-timetable.mjs'
import { loadFribourgRoads, applyFribourgRoads } from './fribourg-road-geometry.mjs'
import { loadFribourgRail, applyFribourgRail } from './fribourg-rail-geometry.mjs'
import { fribourgWorksInputs, assessFribourgWorks, assertFribourgWorks } from './fribourg-works-audit.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const zippedJson = async path => JSON.parse(gunzipSync(await readFile(path)))
async function writeJson(path, value, pretty = false) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(value, null, pretty ? 2 : undefined) + (pretty ? '\n' : ''))
}

export async function buildFribourgRegion({ archive, sourceDirectory = 'data/fribourg-sources', dates = ['2026-09-04', '2026-09-06'],
  output = 'data/fribourg-region', auditDirectory = 'data/fribourg-audit', timetableCache, crosswalkPath = 'data/fribourg-policy.json' }) {
  assert.deepEqual(dates, ['2026-09-04', '2026-09-06'], 'Review and update Fribourg fixture policy before changing dates')
  const source = await zippedJson(join(sourceDirectory, 'decoded.json.gz')), crosswalk = await json(crosswalkPath)
  source.metadata = await json(join(sourceDirectory, 'sources.json'))
  const hashes = { archive: await hashFile(archive), source: await hashFile(join(sourceDirectory, 'decoded.json.gz')),
    crosswalk: await hashFile(crosswalkPath), provenance: await hashFile(join(sourceDirectory, 'sources.json')) }
  assert.equal(hashes.archive, 'd325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e', 'Unreviewed GTFS fixture')
  assert.equal(hashes.source, source.metadata.sourceSnapshotSha256, 'Changed decoded geometry')
  for (const record of source.metadata.acquisition.sources) assert.equal(await hashFile(join(sourceDirectory, record.file)), record.sha256, `Changed source bytes ${record.file}`)
  for (const [file, hash] of Object.entries(source.metadata.acquisition.derivedHashes)) assert.equal(await hashFile(join(sourceDirectory, file)), hash)
  for (const document of crosswalk.supportingDocuments ?? []) {
    assert.equal(await hashFile(join(sourceDirectory, document.file)), document.sha256, `Changed corridor evidence ${document.file}`)
  }
  const census = await json('data/swiss-transit-agencies.json')
  assert.equal(census.sourceSha256, hashes.archive)
  const provenance = { ...source.metadata, crosswalkSupportingDocuments: crosswalk.supportingDocuments ?? [], timetable: { publisher: 'SBB / Open data platform mobility Switzerland',
    attribution: 'opentransportdata.swiss', sourceUrl: census.sourceUrl, feed: census.feed, sha256: hashes.archive,
    downloadUrl: 'https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip',
    termsUrl: 'https://opentransportdata.swiss/en/terms-of-use/', processedBy: 'Gleislicht',
    archivalStudy: true, refreshPolicy: 'Pinned September 2026 research fixtures; not a live or current-service feed. A new timetable or geometry release requires a complete rebuild and admission audit.' } }
  for (const [id, name] of Object.entries(crosswalk.expectedAgencyNames)) assert.equal(census.agencies.find(a => a.id === id)?.name, name, `Changed crosswalk agency ${id}`)
  let timetable
  if (timetableCache) {
    timetable = await zippedJson(timetableCache)
    assert.deepEqual(timetable.sourceHashes, { archive: hashes.archive, source: hashes.source }, 'Unverified Fribourg timetable cache')
  } else {
    timetable = await readBernTimetables(archive, dates, source, { cantonName: 'Fribourg', boundaryBounds: [2535000, 1135000, 2605000, 1210000] })
    timetable.sourceHashes = { archive: hashes.archive, source: hashes.source }
    await mkdir(auditDirectory, { recursive: true })
    await writeFile(join(auditDirectory, 'timetable-cache.json.gz'), gzipSync(JSON.stringify(timetable), { mtime: 0 }))
  }
  assert.deepEqual(timetable.snapshots.map(s => s.metadata.serviceDate), dates)
  const roads = crosswalk.roads ? await loadFribourgRoads(timetable, crosswalk.roads) : undefined
  if (roads) {
    hashes.roads = crosswalk.roads.cacheSha256
    if (roads.montCarmel) {
      hashes.montCarmel = crosswalk.roads.montCarmel.sha256
      await writeJson(join(auditDirectory, 'mont-carmel.json'), roads.montCarmel, true)
    }
    if (roads.jongny) {
      hashes.jongny = crosswalk.roads.jongny.sha256
      await writeJson(join(auditDirectory, 'jongny.json'), roads.jongny, true)
    }
    if (roads.laupen) {
      hashes.laupen = crosswalk.roads.laupen.sha256
      await writeJson(join(auditDirectory, 'laupen.json'), roads.laupen, true)
    }
    if (roads.broc) {
      hashes.broc = crosswalk.roads.broc.sha256
      await writeJson(join(auditDirectory, 'broc.json'), roads.broc, true)
    }
    provenance.roads = { ...roads.metadata, ...(roads.broc ? { broc: roads.broc.policy } : {}), ...(roads.laupen ? { laupen: roads.laupen.policy } : {}), ...(roads.jongny ? { jongny: roads.jongny.policy } : {}), ...(roads.montCarmel ? { montCarmel: roads.montCarmel.policy } : {}), policy: crosswalk.roads, completePatternsTested: roads.patterns }
  }
  const rail = crosswalk.rail ? await loadFribourgRail(timetable, crosswalk.rail) : undefined
  if (rail) {
    hashes.rail = crosswalk.rail.sourceMetadataSha256
    hashes.railInputs = crosswalk.rail.inputsSha256
    if (rail.avry) {
      hashes.avry = rail.avry.policySha256
      await writeJson(join(auditDirectory, 'avry.json'), rail.avry, true)
    }
    if (rail.bernPlatforms) {
      hashes.bernPlatforms = rail.bernPlatforms.policySha256
      await writeJson(join(auditDirectory, 'bern-platforms.json'), rail.bernPlatforms, true)
    }
    if (rail.review) {
      hashes.railReview = rail.review.policySha256
      await writeJson(join(auditDirectory, 'rail-review.json'), rail.review, true)
    }
    provenance.rail = { ...rail.source, ...(rail.avry ? { avry: rail.avry.policy } : {}), ...(rail.bernPlatforms ? { bernPlatforms: rail.bernPlatforms.policy } : {}), ...(rail.review ? { reviewedSupplement: { policySha256: rail.review.policySha256, source: rail.review.source, policy: rail.review.policy } } : {}), policy: crosswalk.rail, completePatternsTested: rail.patterns.length }
    await writeJson(join(auditDirectory, 'rail-patterns.json'), rail.patterns)
    await writeJson(join(auditDirectory, 'rail-source-segments.json'), rail.sourceInventory, true)
  }
  const worksInputs = fribourgWorksInputs(timetable), worksAssessment = assessFribourgWorks(worksInputs)
  assertFribourgWorks(worksAssessment)
  await writeJson(join(auditDirectory, 'works.json'), { sourceHashes: hashes,
    source: provenance.rail.supportingDocuments.find(d => d.file === 'tpf-verrerie-works.html'),
    window: '21:00–24:00 Europe/Zurich, 6 September 2026; Friday comparison uses the same hours',
    note: 'Full S50/S51 call chains retained, including out-of-canton calls. Checks timetable consistency with one dated notice; not a general diversion or live-operation validation.',
    inputs: worksInputs, assessment: worksAssessment }, true)
  const routes = new Map(timetable.routes.map(r => [r.id, r])), reports = [], patternSets = []
  const routeDays = new Map(timetable.routes.map(r => [r.id, []]))
  let routeCrosswalk
  for (const raw of timetable.snapshots) {
    console.log(`Matching every directed Fribourg pattern for ${raw.metadata.serviceDate}…`)
    const result = applyFribourgGeometry(raw, routes, source, crosswalk)
    const affected = result.trains.filter(t => t.geometryInference), affectedIds = new Set(affected.map(t => t.id))
    const baseline = applyFribourgGeometry({ ...raw, trains: raw.trains.filter(t => affectedIds.has(t.id)) }, routes, source, { ...crosswalk, topologyRepairs: [] })
    const previouslyAdmitted = new Set(baseline.trains.filter(t => t.admission === 'admitted').map(t => t.id))
    const topologyRepairEffect = { repairs: crosswalk.topologyRepairs ?? [], routeIds: [...new Set(affected.map(t => t.routeId))],
      baselineAdmittedTrips: previouslyAdmitted.size, repairedAdmittedTrips: affected.filter(t => t.admission === 'admitted').length,
      newlyAdmittedTrips: affected.filter(t => t.admission === 'admitted' && !previouslyAdmitted.has(t.id)).length,
      baselineFailedPairs: baseline.pairs.filter(p => p.pathIndex === null),
      lostAdmittedTrips: affected.filter(t => t.admission !== 'admitted' && previouslyAdmitted.has(t.id)).length }
    assert.equal(topologyRepairEffect.lostAdmittedTrips, 0, 'Topology repair lost a previously admitted journey')
    const officialCoverage = bernCoverage(result.trains, result.pairs, result.patterns)
    const officialAdmittedIds = new Set(result.trains.filter(t => t.admission === 'admitted').map(t => t.id))
    applyFribourgRoads(result, routes, roads)
    const roadEffect = { officialCoverage, patternsTestedAcrossBothDates: roads?.patterns ?? 0,
      newlyAdmittedTrips: result.trains.filter(t => t.admission === 'admitted' && !officialAdmittedIds.has(t.id)).length,
      lostAdmittedTrips: result.trains.filter(t => t.admission !== 'admitted' && officialAdmittedIds.has(t.id)).length,
      matchedDirectedPairs: result.pairs.filter(p => p.geometrySource === 'osm-road-inference').length,
      matchedSegmentOccurrences: result.pairs.filter(p => p.geometrySource === 'osm-road-inference').reduce((n, p) => n + p.occurrences, 0),
      admittedSegmentOccurrences: result.pairs.filter(p => p.geometrySource === 'osm-road-inference').reduce((n, p) => n + p.admittedOccurrences, 0) }
    assert.equal(roadEffect.lostAdmittedTrips, 0)
    const beforeRail = new Set(result.trains.filter(t => t.admission === 'admitted').map(t => t.id))
    if (rail) applyFribourgRail(result, rail)
    const reviewedPaths = new Set(result.pairs.filter(p => p.railFallback?.railReview && p.pathIndex !== null).map(p => JSON.stringify([p.routeId, p.pathIndex])))
    const railEffect = { patternsTestedAcrossBothDates: rail?.patterns.length ?? 0,
      newlyAdmittedTrips: result.trains.filter(t => t.admission === 'admitted' && !beforeRail.has(t.id)).length,
      lostAdmittedTrips: result.trains.filter(t => t.admission !== 'admitted' && beforeRail.has(t.id)).length,
      matchedDirectedPairs: result.pairs.filter(p => p.geometrySource === 'fot-rail-inference').length,
      matchedSegmentOccurrences: result.pairs.filter(p => p.geometrySource === 'fot-rail-inference').reduce((n, p) => n + p.occurrences, 0),
      admittedSegmentOccurrences: result.pairs.filter(p => p.geometrySource === 'fot-rail-inference').reduce((n, p) => n + p.admittedOccurrences, 0),
      reviewedPairs: result.pairs.filter(p => p.railFallback?.railReview).length,
      reviewedJourneys: result.trains.filter(t => t.admission === 'admitted' && t.pathSegments.some(i => reviewedPaths.has(JSON.stringify([t.routeId, i])))).length }
    assert.equal(railEffect.lostAdmittedTrips, 0)
    routeCrosswalk = result.routeCrosswalk
    const groups = []
    for (const key of [...new Set(result.trains.map(t => `${t.agencyId}:${routes.get(t.routeId).mode}`))].sort()) {
      const ids = new Set([...routes.values()].filter(r => `${r.agencyId}:${r.mode}` === key).map(r => r.id))
      groups.push({ id: key, agency: routes.get(result.trains.find(t => ids.has(t.routeId)).routeId).agency,
        ...bernCoverage(result.trains.filter(t => ids.has(t.routeId)), result.pairs.filter(p => ids.has(p.routeId)), result.patterns.filter(p => ids.has(p.routeId))) })
    }
    for (const route of timetable.routes) {
      const trains = result.trains.filter(t => t.routeId === route.id), pairs = result.pairs.filter(p => p.routeId === route.id), patterns = result.patterns.filter(p => p.routeId === route.id)
      routeDays.get(route.id).push({ date: raw.metadata.serviceDate, ...bernCoverage(trains, pairs, patterns),
        admittedRoadSegmentOccurrences: pairs.filter(p => p.geometrySource === 'osm-road-inference').reduce((n, p) => n + p.admittedOccurrences, 0),
        admittedRailSegmentOccurrences: pairs.filter(p => p.geometrySource === 'fot-rail-inference').reduce((n, p) => n + p.admittedOccurrences, 0),
        admittedOfficialSegmentOccurrences: pairs.filter(p => !p.geometrySource).reduce((n, p) => n + p.admittedOccurrences, 0) })
    }
    const snapshot = compactBernFeed(raw, result)
    snapshot.metadata = { ...snapshot.metadata, publisher: 'Gleislicht', timetablePublisher: 'SBB', attribution: 'opentransportdata.swiss',
      label: 'Fribourg canton — archival source-line study', releaseStatus: 'archival-study', publicRedistributionCleared: source.metadata.publicRedistributionCleared, sourceHashes: hashes, timetable: provenance.timetable,
      model: 'Scheduled interpolation along cantonal source centrelines and explicitly tagged inferred OSM road and FOT/SBB rail fallback; exactTimes=0 instances are representative headway motion, not exact departures or observed vehicles.',
      ...(rail ? { railGeometry: provenance.rail } : {}),
      ...(roads ? { roadGeometry: provenance.roads, derivedGeometryDatabaseLicense: { name: 'ODbL-1.0', url: crosswalk.roads.licenseUrl,
        attribution: 'Source: Etat de Fribourg; © OpenStreetMap contributors; © Federal Office of Transport (FOT); SBB Infrastructure / data.sbb.ch', note: 'Combined derived geometry database; timetable and boundary sources retain their separate credits and terms.' } } : {}),
      scope: timetable.census.boundaryRule, admission: 'Only complete directed patterns with every segment passing geometry limits and no reservation/on-demand call. Exclusions retained in the canton audit.',
      geometry: { ...source.metadata, transformation: 'swisstopo approximate CH1903+/WGS84 formula; original LV95 vertices, no simplification, seven-decimal output coordinates',
        crosswalkSupportingDocuments: crosswalk.supportingDocuments ?? [],
        topologyRepairs: crosswalk.topologyRepairs ?? [],
        limits: FRIBOURG_LIMITS, direction: 'Bidirectional centreline inference from ordered calls. No road one-way or rail running-track certification; no realtime/diversion verification.',
        localMetadata: '../sources.json', localTerms: source.metadata.termsFiles.map(name => '../' + name) },
    }
    validateBernSnapshot(snapshot)
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'day-chunks')
    validateBernChunks(snapshot, manifest, chunks)
    const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
    validateBernSnapshot(morning)
    const destination = join(output, raw.metadata.serviceDate)
    for (const { descriptor, payload } of chunks) await writeJson(join(destination, descriptor.path), payload)
    await writeJson(join(destination, 'fribourg-region-day-manifest.json'), manifest)
    await writeJson(join(destination, 'fribourg-region-morning.json'), morning)
    const coverage = bernCoverage(result.trains, result.pairs, result.patterns)
    const pairMap = new Map(result.pairs.map(p => [JSON.stringify([p.routeId, p.fromId, p.toId]), p]))
    const timing = { zeroDurationSegmentOccurrences: 0, zeroDurationOver100m: 0, maximumPositiveDurationSpeedKmh: 0,
      note: 'Original GTFS times retained, including minute-rounded equal timestamps. Zero-duration segments are not speed observations and no artificial travel time is invented.' }
    for (const train of snapshot.trains) for (let i = 1; i < train.stops.length; i++) {
      const a = train.stops[i - 1], b = train.stops[i]
      const pair = pairMap.get(JSON.stringify([train.routeId, snapshot.stops[a[0]][4], snapshot.stops[b[0]][4]]))
      const seconds = b[1] - a[2]
      if (!seconds) { timing.zeroDurationSegmentOccurrences++; timing.zeroDurationOver100m += Number(pair.pathMetres > 100) }
      else timing.maximumPositiveDurationSpeedKmh = Math.max(timing.maximumPositiveDurationSpeedKmh, pair.pathMetres / seconds * 3.6)
    }
    patternSets.push(new Set(result.patterns.map(p => p.id)))
    const report = { schemaVersion: 1, serviceDate: raw.metadata.serviceDate, sourceHashes: hashes, coverage, groups, timing, topologyRepairEffect, roadEffect, railEffect,
      pairFailures: Object.fromEntries([...new Set(result.pairs.filter(p => p.pathIndex === null).map(p => p.reason))].sort().map(reason => {
        const pairs = result.pairs.filter(p => p.reason === reason)
        return [reason, { directedPairs: pairs.length, segmentOccurrences: pairs.reduce((n, p) => n + p.occurrences, 0) }]
      })),
      carryInTrips: result.trains.filter(t => t.sourceServiceDate !== raw.metadata.serviceDate).length,
      admittedCarryInTrips: snapshot.trains.filter(t => t.sourceServiceDate !== raw.metadata.serviceDate).length,
      admittedOutsideCantonPlatforms: snapshot.stops.filter(s => !timetable.sourceStopInventory.some(p => p.id === s[4])).length,
      directedPatternChecks: { directionIds: [...new Set(result.patterns.map(p => p.directionId))].sort(),
        patternsRevisitingPlatforms: result.patterns.filter(p => new Set(p.stopIds).size < p.stopIds.length).length,
        admittedPatternsRevisitingPlatforms: result.patterns.filter(p => p.admittedTrips && new Set(p.stopIds).size < p.stopIds.length).length,
        nightRouteTrips: result.trains.filter(t => routes.get(t.routeId).type === 705 || /^[MN]\d/.test(t.route)).length,
        admittedNightRouteTrips: snapshot.trains.filter(t => routes.get(t.routeId).type === 705 || /^[MN]\d/.test(t.route)).length },
      patterns: result.patterns.map(({ pathSegments, ...p }) => ({ ...p, matchedMask: pathSegments.map(i => i !== null) })),
      directedPairs: result.pairs.map(({ pathIndex, ...p }) => ({ ...p, matched: pathIndex !== null })),
      payload: { manifest: { bytes: Buffer.byteLength(JSON.stringify(manifest)), gzipBytes: gzipSync(JSON.stringify(manifest)).length },
        morning: { trips: morning.trains.length, gzipBytes: gzipSync(JSON.stringify(morning)).length },
        chunks: chunks.map(({ descriptor, payload }) => ({ ...descriptor, gzipBytes: gzipSync(JSON.stringify(payload)).length })) },
      validation: { completeSourceCalls: true, directedEndpoints: true, finiteOrderedTimes: true, chunkHashesAndTripIdentity: true,
        admittedGeometryCoverage: 1, unsourcedInterpolationInFeed: false, inferredTopologyRepairs: (crosswalk.topologyRepairs ?? []).length,
        physicalDirectionCertified: false, yearRoundCoverageEstablished: false },
    }
    await writeJson(join(auditDirectory, `${raw.metadata.serviceDate}.json`), report)
    reports.push({ ...report, patterns: undefined, directedPairs: undefined })
    console.log(JSON.stringify({ date: report.serviceDate, ...coverage }))
  }
  const inventory = timetable.routes.map(route => {
    const days = routeDays.get(route.id), total = days.reduce((n, d) => n + d.trips, 0), admitted = days.reduce((n, d) => n + d.admittedTrips, 0)
    const boundarySensitive = route.inCantonStops.every(id => timetable.census.nearBoundary.some(s => s.id === id))
    return { ...route, boundarySensitive, sourceLines: routeCrosswalk.find(c => c.routeId === route.id).sourceLines, days,
      status: !total ? 'inactive-on-validation-dates' : !admitted ? 'excluded' : admitted === total ? 'admitted-all-dated-trips' : 'partially-admitted' }
  })
  const sourceLines = source.lines.map(f => {
    const id = String(f.properties.OBJECTID), routeIds = routeCrosswalk.filter(c => c.sourceLines.includes(id)).map(c => c.routeId)
    const identity = fribourgFeatureIdentity(f, crosswalk)
    const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
    const geometry = { parts: parts.length, vertices: parts.reduce((n, p) => n + p.length, 0),
      lengthMetres: parts.reduce((n, p) => n + p.slice(1).reduce((m, point, i) => m + Math.hypot(point[0] - p[i][0], point[1] - p[i][1]), 0), 0) }
    return { ...f.properties, geometry, identity, routeIds,
      admittedRouteIds: inventory.filter(r => routeIds.includes(r.id) && r.days.some(d => d.admittedOfficialSegmentOccurrences)).map(r => r.id),
      status: routeIds.length ? 'crosswalk-candidate' : 'no-canton-gtfs-crosswalk',
      exclusionReason: routeIds.length ? null : !identity.agencyIds.length ? 'unresolved-source-operator'
        : !identity.lines.length ? 'unresolved-passenger-line-identity' : 'no-matching-canton-serving-gtfs-route' }
  })
  const usedStopIds = new Set(inventory.flatMap(r => r.inCantonStops))
  const districtInventory = source.districts.map(d => ({ district: d.properties.name,
    calledPlatforms: timetable.sourceStopInventory.filter(s => s.district === d.properties.name && usedStopIds.has(s.id)).length,
    routeIds: inventory.filter(r => r.districts.includes(d.properties.name)).map(r => r.id) }))
  const summary = { schemaVersion: 1, sourceHashes: hashes, sources: provenance, census: timetable.census,
    boundarySensitivity: { routeIds: inventory.filter(r => r.boundarySensitive).map(r => r.id),
      note: 'Metre-level WGS84/LV95 approximation; platforms within 10 m of the boundary are flagged on both sides. Routes supported only by those platforms are provisional geographic members. No polygon buffer applied.' },
    routeCount: inventory.length, agencyCount: new Set(inventory.map(r => r.agencyId)).size,
    weekdaySundayPatterns: { shared: [...patternSets[0]].filter(id => patternSets[1].has(id)).length,
      weekdayOnly: [...patternSets[0]].filter(id => !patternSets[1].has(id)).length,
      sundayOnly: [...patternSets[1]].filter(id => !patternSets[0].has(id)).length,
      key: 'GTFS route identity + direction_id + full ordered original platform IDs, including repeats and out-of-canton calls' },
    routesByStatus: Object.fromEntries([...new Set(inventory.map(r => r.status))].map(status => [status, inventory.filter(r => r.status === status).length])),
    districts: districtInventory, days: reports,
    scopeLimits: ['GTFS fixed-stop archive and all cantonal line records inventoried; services absent from both sources and GTFS-Flex service areas are not a verified census of every real-world service.',
      'Two September civil days do not establish holiday, winter or year-round pattern coverage.',
      'Cross-boundary journeys keep all calls. Entire patterns still failing any segment after the audited road and rail fallback are excluded; a source extent alone never truncates a trip.',
      'Geometry combines cantonal line, inferred OSM road and inferred FOT/SBB rail paths; not observed movement, legal one-way validation, running-track selection or temporary diversion confirmation.'],
  }
  await writeJson(join(auditDirectory, 'summary.json'), summary, true)
  await writeJson(join(auditDirectory, 'routes.json'), inventory, true)
  await writeJson(join(auditDirectory, 'source-lines.json'), sourceLines, true)
  await writeJson(join(auditDirectory, 'stops.json'), timetable.sourceStopInventory, false)
  await writeJson(join(output, 'sources.json'), provenance, true)
  for (const name of source.metadata.termsFiles) await copyFile(join(sourceDirectory, name), join(output, name))
  for (const document of crosswalk.supportingDocuments ?? []) await copyFile(join(sourceDirectory, document.file), join(output, document.file))
  await writeJson(join(output, 'index.json'), { label: 'Fribourg canton local archival regional feed', publicRedistributionCleared: source.metadata.publicRedistributionCleared,
    ...(roads ? { derivedGeometryDatabaseLicense: 'ODbL-1.0', licenseUrl: crosswalk.roads.licenseUrl,
      attribution: 'opentransportdata.swiss; Source: Etat de Fribourg; © OpenStreetMap contributors; © Federal Office of Transport (FOT); SBB Infrastructure / data.sbb.ch; © swisstopo' } : {}), sourceHashes: hashes, dates: dates.map(date => ({ date,
    manifest: `${date}/fribourg-region-day-manifest.json`, morning: `${date}/fribourg-region-morning.json` })), admission: 'Complete geometry patterns only; see docs/FRIBOURG-STUDY.md and data/fribourg-audit for exclusions.' }, true)
  return summary
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined
  assert(arg('archive'), 'Missing --archive')
  const summary = await buildFribourgRegion({ archive: arg('archive'), sourceDirectory: arg('sources'), output: arg('output-directory'),
    auditDirectory: arg('audit-directory'), timetableCache: arg('timetable-cache') })
  console.log(JSON.stringify({ routes: summary.routeCount, agencies: summary.agencyCount, status: summary.routesByStatus }))
}
