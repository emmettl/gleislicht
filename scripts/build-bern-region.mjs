import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { readBernTimetables } from './bern-timetable.mjs'
import { applyBernGeometry, BERN_LIMITS } from './bern-line-geometry.mjs'
import { loadBernUrban, applyBernUrban } from './bern-urban-geometry.mjs'
import { loadBernRegionalRoads, applyBernRegionalRoads } from './bern-regional-roads.mjs'
import { loadBernMountains, applyBernMountains } from './bern-mountain-geometry.mjs'
import { loadBernRail, applyBernRail } from './bern-rail-geometry.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}
const json = async path => JSON.parse(await readFile(path, 'utf8'))
const zippedJson = async path => JSON.parse(gunzipSync(await readFile(path)))
async function writeJson(path, value, pretty = false) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(value, null, pretty ? 2 : undefined) + (pretty ? '\n' : ''))
}

export function compactBernFeed(raw, result) {
  const trains = result.trains.filter(t => t.admission === 'admitted')
  assert(trains.length, 'No admitted Bern journeys')
  const usedStops = [...new Set(trains.flatMap(t => t.stops.map(([i]) => i)))].sort((a, b) => a - b)
  const usedPaths = [...new Set(trains.flatMap(t => t.pathSegments))].sort((a, b) => a - b)
  assert(usedPaths.every(i => i !== null), 'Missing path in admitted journey')
  const stopsMap = new Map(usedStops.map((i, j) => [i, j])), pathsMap = new Map(usedPaths.map((i, j) => [i, j]))
  const stops = usedStops.map(i => raw.stops[i]), paths = usedPaths.map(i => result.paths[i])
  const remapped = trains.map(t => ({ ...t, stops: t.stops.map(([i, ...times]) => [stopsMap.get(i), ...times]), pathSegments: t.pathSegments.map(i => pathsMap.get(i)) }))
  const edges = new Map()
  for (const t of remapped) for (let i = 1; i < t.stops.length; i++) {
    const a = t.stops[i - 1][0], b = t.stops[i][0], key = [a, b].sort((a, b) => a - b).join(':')
    if (!edges.has(key)) edges.set(key, [a, b, t.pathSegments[i - 1]])
  }
  return { metadata: raw.metadata, stops, paths, trains: remapped,
    edges: [...edges.values()].map(([a, b]) => [a, b]), edgePaths: [...edges.values()].map(([, , i]) => i),
    bounds: { minLongitude: Math.min(...stops.map(s => s[0])), maxLongitude: Math.max(...stops.map(s => s[0])),
      minLatitude: Math.min(...stops.map(s => s[1])), maxLatitude: Math.max(...stops.map(s => s[1])) } }
}

export function bernCoverage(trains, pairs, patterns) {
  const exact = trains.filter(t => t.frequency?.exactTimes !== 0)
  const sum = (items, fn) => items.reduce((n, item) => n + fn(item), 0)
  return { trips: trains.length, admittedTrips: trains.filter(t => t.admission === 'admitted').length,
    scheduledTrips: exact.length, representativeHeadwayTrips: trains.length - exact.length,
    admittedScheduledTrips: exact.filter(t => t.admission === 'admitted').length,
    admittedRepresentativeHeadwayTrips: trains.filter(t => t.admission === 'admitted' && t.frequency?.exactTimes === 0).length,
    scheduledSegmentOccurrences: sum(exact, t => t.pathSegments.length),
    matchedScheduledSegmentOccurrences: sum(exact, t => t.pathSegments.filter(i => i !== null).length),
    segmentOccurrences: sum(pairs, p => p.occurrences), matchedSegmentOccurrences: sum(pairs.filter(p => p.pathIndex !== null), p => p.occurrences),
    admittedSegmentOccurrences: sum(pairs, p => p.admittedOccurrences),
    directedPairs: pairs.length, matchedDirectedPairs: pairs.filter(p => p.pathIndex !== null).length,
    patterns: patterns.length, completePatterns: patterns.filter(p => p.matchedSegments === p.segmentCount).length,
    admittedPatterns: patterns.filter(p => p.admittedTrips > 0).length,
    excludedTrips: Object.fromEntries([...new Set(trains.map(t => t.admission))].filter(s => s !== 'admitted').sort().map(s => [s, trains.filter(t => t.admission === s).length])) }
}

export function validateBernSnapshot(snapshot) {
  assert(snapshot.trains.length && snapshot.paths.length)
  assert(new Set(snapshot.trains.map(t => t.id)).size === snapshot.trains.length)
  for (const path of snapshot.paths) assert(path.length >= 2 && path.every(p => p.length === 2 && p.every(Number.isFinite)))
  for (const train of snapshot.trains) {
    assert.equal(train.admission, 'admitted'); assert.equal(train.sourceCallCount, train.stops.length)
    assert(!train.reservationRequired); assert.equal(train.callPermissions.length, train.stops.length)
    assert.equal(train.pathSegments.length, train.stops.length - 1)
    for (let i = 0; i < train.stops.length; i++) {
      const [index, arrival, departure] = train.stops[i]
      assert(Number.isInteger(index) && snapshot.stops[index] && Number.isFinite(arrival) && Number.isFinite(departure) && arrival <= departure)
      if (!i) continue
      assert(arrival >= train.stops[i - 1][2])
      const pathIndex = train.pathSegments[i - 1]
      assert(Number.isInteger(pathIndex) && snapshot.paths[pathIndex], 'Invalid admitted path')
      const path = snapshot.paths[pathIndex]
      assert(path[0].every((v, axis) => Math.abs(v - snapshot.stops[train.stops[i - 1][0]][axis]) < 0.00000006), 'Reversed or misplaced path start')
      assert(path.at(-1).every((v, axis) => Math.abs(v - snapshot.stops[index][axis]) < 0.00000006), 'Reversed or misplaced path end')
    }
  }
  assert.equal(snapshot.edges.length, snapshot.edgePaths.length)
  snapshot.edges.forEach(([a, b], i) => {
    assert(snapshot.stops[a] && snapshot.stops[b])
    const path = snapshot.paths[snapshot.edgePaths[i]]
    assert(path && path[0].every((v, axis) => Math.abs(v - snapshot.stops[a][axis]) < 0.00000006))
    assert(path.at(-1).every((v, axis) => Math.abs(v - snapshot.stops[b][axis]) < 0.00000006))
  })
}

export function validateBernChunks(snapshot, manifest, chunks) {
  assert.equal(chunks.length, 12)
  const seen = new Map()
  chunks.forEach(({ descriptor, payload }, i) => {
    assert.deepEqual(descriptor, manifest.chunks[i])
    assert.equal(descriptor.windowStart, i * 7200); assert.equal(descriptor.windowEnd, (i + 1) * 7200)
    const bytes = Buffer.from(JSON.stringify(payload))
    assert.equal(descriptor.bytes, bytes.length); assert.equal(descriptor.sha256, sha(bytes))
    assert.equal(descriptor.tripCount, payload.trains.length)
    assert.equal(payload.windowStart, descriptor.windowStart); assert.equal(payload.windowEnd, descriptor.windowEnd)
    const ids = new Set()
    for (const train of payload.trains) {
      assert(!ids.has(train.id), 'Duplicate trip in chunk'); ids.add(train.id)
      const signature = JSON.stringify(train)
      if (seen.has(train.id)) assert.equal(seen.get(train.id), signature)
      seen.set(train.id, signature)
    }
  })
  assert.equal(seen.size, snapshot.trains.length); assert.equal(manifest.tripCount, snapshot.trains.length)
  for (const train of snapshot.trains) assert.equal(seen.get(train.id), JSON.stringify(train))
}

export async function buildBernRegion({ archive, sourceDirectory = 'data/bern-sources', dates = ['2026-09-04', '2026-09-06'],
  output = 'public/data/bern-region', auditDirectory = 'data/bern-audit', timetableCache, crosswalkPath = 'data/bern-operator-crosswalk.json' }) {
  assert.deepEqual(dates, ['2026-09-04', '2026-09-06'], 'Review and update Bern fixture policy before changing dates')
  const source = await zippedJson(join(sourceDirectory, 'decoded.json.gz')), crosswalk = await json(crosswalkPath)
  const hashes = { archive: await hashFile(archive), source: await hashFile(join(sourceDirectory, 'decoded.json.gz')),
    crosswalk: await hashFile(crosswalkPath), geometryArchive: await hashFile(join(sourceDirectory, 'oevtp.gpkg.zip')) }
  assert.equal(hashes.archive, 'd325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e', 'Unreviewed GTFS fixture')
  assert.equal(hashes.geometryArchive, source.metadata.archiveSha256)
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
    assert.deepEqual(timetable.sourceHashes, { archive: hashes.archive, source: hashes.source }, 'Unverified Bern timetable cache')
  } else {
    timetable = await readBernTimetables(archive, dates, source)
    timetable.sourceHashes = { archive: hashes.archive, source: hashes.source }
    await mkdir(auditDirectory, { recursive: true })
    await writeFile(join(auditDirectory, 'timetable-cache.json.gz'), gzipSync(JSON.stringify(timetable), { mtime: 0 }))
  }
  assert.deepEqual(timetable.snapshots.map(s => s.metadata.serviceDate), dates)
  const urban = await loadBernUrban(timetable)
  const regionalRoads = await loadBernRegionalRoads(timetable)
  hashes.regionalRoadCache = regionalRoads.metadata.cacheSha256
  hashes.regionalRoadPolicy = regionalRoads.metadata.policySha256
  provenance.regionalRoadSupplement = regionalRoads.metadata
  const mountain = await loadBernMountains()
  hashes.mountainPolicy = mountain.metadata.policySha256
  provenance.mountainSupplement = mountain.metadata
  const rail = await loadBernRail()
  hashes.railPolicy = rail.metadata.policySha256
  provenance.railSupplement = rail.metadata
  hashes.urbanCache = urban.metadata.cacheSha256
  hashes.urbanPolicy = urban.metadata.policySha256
  provenance.urbanSupplement = urban.metadata
  const routes = new Map(timetable.routes.map(r => [r.id, r])), reports = [], patternSets = []
  const routeDays = new Map(timetable.routes.map(r => [r.id, []]))
  let routeCrosswalk
  for (const raw of timetable.snapshots) {
    console.log(`Matching every directed Bern pattern for ${raw.metadata.serviceDate}…`)
    const base = applyBernUrban(raw, applyBernGeometry(raw, routes, source, crosswalk), source, urban)
    const result = applyBernRail(raw, applyBernMountains(raw, applyBernRegionalRoads(raw, base, source, regionalRoads), routes, mountain), routes, rail)
    routeCrosswalk = result.routeCrosswalk
    const groups = []
    for (const key of [...new Set(result.trains.map(t => `${t.agencyId}:${routes.get(t.routeId).mode}`))].sort()) {
      const ids = new Set([...routes.values()].filter(r => `${r.agencyId}:${r.mode}` === key).map(r => r.id))
      groups.push({ id: key, agency: routes.get(result.trains.find(t => ids.has(t.routeId)).routeId).agency,
        ...bernCoverage(result.trains.filter(t => ids.has(t.routeId)), result.pairs.filter(p => ids.has(p.routeId)), result.patterns.filter(p => ids.has(p.routeId))) })
    }
    for (const route of timetable.routes) {
      const trains = result.trains.filter(t => t.routeId === route.id), pairs = result.pairs.filter(p => p.routeId === route.id), patterns = result.patterns.filter(p => p.routeId === route.id)
      routeDays.get(route.id).push({ date: raw.metadata.serviceDate, ...bernCoverage(trains, pairs, patterns) })
    }
    const snapshot = compactBernFeed(raw, result)
    snapshot.metadata = { ...snapshot.metadata, publisher: 'Gleislicht', timetablePublisher: 'SBB', attribution: 'opentransportdata.swiss',
      label: 'Bern canton — audited directed patterns', sourceHashes: hashes, timetable: provenance.timetable,
      model: 'Scheduled interpolation along cantonal centrelines, audited OSM road supplements and identified FOT cableway/rail geometry; exactTimes=0 instances are representative headway motion, not exact departures or observed vehicles.',
      scope: timetable.census.boundaryRule, admission: 'Only complete directed patterns with every segment passing geometry limits and no reservation/on-demand call. Exclusions retained in the canton audit.',
      geometry: { ...source.metadata, transformation: 'Cantonal geometry: swisstopo approximate CH1903+/WGS84 formula, original LV95 vertices, no simplification, seven-decimal output. Federal rail transformation is recorded separately in railSupplement.source.',
        crosswalkSupportingDocuments: crosswalk.supportingDocuments ?? [],
        urbanSupplement: urban.metadata,
        regionalRoadSupplement: regionalRoads.metadata,
        mountainSupplement: mountain.metadata,
        railSupplement: rail.metadata,
        limits: BERN_LIMITS, direction: 'Centreline inference from ordered calls. No road one-way or rail running-track certification. Only the explicitly scoped tram 6 station approach has dated diversion evidence; no realtime verification.',
        localMetadata: '../sources.json', localTerms: ['../terms_of_use_de.pdf', '../terms_of_use_fr.pdf'] },
    }
    validateBernSnapshot(snapshot)
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'day-chunks')
    validateBernChunks(snapshot, manifest, chunks)
    const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
    validateBernSnapshot(morning)
    const destination = join(output, raw.metadata.serviceDate)
    for (const { descriptor, payload } of chunks) await writeJson(join(destination, descriptor.path), payload)
    await writeJson(join(destination, 'bern-region-day-manifest.json'), manifest)
    await writeJson(join(destination, 'bern-region-morning.json'), morning)
    const coverage = bernCoverage(result.trains, result.pairs, result.patterns)
    patternSets.push(new Set(result.patterns.map(p => p.id)))
    const report = { schemaVersion: 1, serviceDate: raw.metadata.serviceDate, sourceHashes: hashes, coverage, groups,
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
        admittedGeometryCoverage: 1, unsourcedInterpolationInFeed: false, physicalDirectionCertified: false, yearRoundCoverageEstablished: false },
    }
    await writeJson(join(auditDirectory, `${raw.metadata.serviceDate}.json`), report)
    reports.push({ ...report, patterns: undefined, directedPairs: undefined })
    console.log(JSON.stringify({ date: report.serviceDate, ...coverage }))
  }
  const inventory = timetable.routes.map(route => {
    const days = routeDays.get(route.id), total = days.reduce((n, d) => n + d.trips, 0), admitted = days.reduce((n, d) => n + d.admittedTrips, 0)
    return { ...route, sourceLines: routeCrosswalk.find(c => c.routeId === route.id).sourceLines, days,
      status: !total ? 'inactive-on-validation-dates' : !admitted ? 'excluded' : admitted === total ? 'admitted-all-dated-trips' : 'partially-admitted' }
  })
  const sourceLines = source.lines.map(f => ({ ...f.properties,
    routeIds: routeCrosswalk.filter(c => c.sourceLines.includes(f.properties.liniencode)).map(c => c.routeId),
    status: routeCrosswalk.some(c => c.sourceLines.includes(f.properties.liniencode)) ? 'crosswalk-candidate' : 'no-canton-gtfs-crosswalk',
    ...(routeCrosswalk.some(c => c.sourceLines.includes(f.properties.liniencode)) ? {} : {
      exclusionReason: crosswalk.unresolvedOperators[f.properties.tucode] ?? 'No exact reviewed operator/mode/line combination among the 705 canton-serving GTFS route records; may be outside the canton, absent from GTFS, renamed or an unresolved source identifier. Not silently treated as timetable coverage.' }),
  }))
  const usedStopIds = new Set(inventory.flatMap(r => r.inCantonStops))
  const districtInventory = source.districts.map(d => ({ district: d.properties.name,
    calledPlatforms: timetable.sourceStopInventory.filter(s => s.district === d.properties.name && usedStopIds.has(s.id)).length,
    routeIds: inventory.filter(r => r.districts.includes(d.properties.name)).map(r => r.id) }))
  const summary = { schemaVersion: 1, sourceHashes: hashes, sources: provenance, census: timetable.census,
    routeCount: inventory.length, agencyCount: new Set(inventory.map(r => r.agencyId)).size,
    weekdaySundayPatterns: { shared: [...patternSets[0]].filter(id => patternSets[1].has(id)).length,
      weekdayOnly: [...patternSets[0]].filter(id => !patternSets[1].has(id)).length,
      sundayOnly: [...patternSets[1]].filter(id => !patternSets[0].has(id)).length,
      key: 'GTFS route identity + direction_id + full ordered original platform IDs, including repeats and out-of-canton calls' },
    routesByStatus: Object.fromEntries([...new Set(inventory.map(r => r.status))].map(status => [status, inventory.filter(r => r.status === status).length])),
    districts: districtInventory, days: reports,
    scopeLimits: ['GTFS fixed-stop archive and all OEVTP line records inventoried; services absent from both sources and GTFS-Flex service areas are not a verified census of every real-world service.',
      'Two September civil days do not establish holiday, winter or year-round pattern coverage.',
      'Cross-boundary journeys keep all calls. Entire patterns failing any segment are excluded, including source extents shorter than their timetable journeys.',
      'Geometry uses official-line centrelines plus identified OSM road and FOT rail/cableway supplements; not observed movement, legal one-way validation or running-track selection. Dated diversion evidence is limited to the reviewed tram 6 station approach.'],
  }
  await writeJson(join(auditDirectory, 'summary.json'), summary, true)
  await writeJson(join(auditDirectory, 'routes.json'), inventory, true)
  await writeJson(join(auditDirectory, 'source-lines.json'), sourceLines, true)
  await writeJson(join(auditDirectory, 'stops.json'), timetable.sourceStopInventory, false)
  await writeJson(join(output, 'sources.json'), provenance, true)
  for (const name of [...source.metadata.termsFiles, 'metadata_oevtp_linie_de.pdf']) await copyFile(join(sourceDirectory, name), join(output, name))
  for (const document of crosswalk.supportingDocuments ?? []) await copyFile(join(sourceDirectory, document.file), join(output, document.file))
  for (const document of urban.policy.documents) await copyFile(join(sourceDirectory, document.file), join(output, document.file))
  await mkdir(join(output, 'fot-cableways'), { recursive: true })
  for (const file of ['source.json', ...Object.keys(mountain.metadata.source.files)]) await copyFile(join(mountain.policy.sourceDirectory, file), join(output, 'fot-cableways', file))
  await mkdir(join(output, 'fot-rail'), { recursive: true })
  for (const file of ['source.json', ...Object.keys(rail.metadata.source.files)]) await copyFile(join(rail.policy.sourceDirectory, file), join(output, 'fot-rail', file))
  await writeJson(join(output, 'index.json'), { label: 'Bern canton regional feed', sourceHashes: hashes, dates: dates.map(date => ({ date,
    manifest: `${date}/bern-region-day-manifest.json`, morning: `${date}/bern-region-morning.json` })), admission: 'Complete geometry patterns only; see docs/BERN-STUDY.md and data/bern-audit for exclusions.' }, true)
  return summary
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined
  assert(arg('archive'), 'Missing --archive')
  const summary = await buildBernRegion({ archive: arg('archive'), sourceDirectory: arg('sources'), output: arg('output-directory'),
    auditDirectory: arg('audit-directory'), timetableCache: arg('timetable-cache') })
  console.log(JSON.stringify({ routes: summary.routeCount, agencies: summary.agencyCount, status: summary.routesByStatus }))
}
