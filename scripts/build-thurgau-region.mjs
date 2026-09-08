import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { readThurgauTimetables } from './thurgau-timetable.mjs'
import { applyThurgauGeometry, THURGAU_LIMITS, thurgauLineTokens } from './thurgau-line-geometry.mjs'
import { thurgauCrosswalk } from './crosswalk-thurgau.mjs'
import { compactBernFeed, bernCoverage, validateBernSnapshot, validateBernChunks } from './build-bern-region.mjs'
import { THURGAU_REGIONAL_BUS_AGENCIES } from './thurgau-regional-roads.mjs'
import { loadThurgauRail } from './thurgau-rail-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

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

// Unlike a route-pair union, full road patterns can match a segment in one
// context and reject it in another. Count occurrences from their own paths.
export function thurgauCoverage(trains, pairs, patterns) {
  return { ...bernCoverage(trains, pairs, patterns),
    matchedSegmentOccurrences: trains.reduce((n, t) => n + t.pathSegments.filter(i => i !== null).length, 0) }
}

export function thurgauTimingDiagnostics(raw, result, routes) {
  const pathLengths = result.paths.map(path => path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0))
  const zero = [], maxima = new Map()
  for (const t of result.trains) for (let i = 1; i < t.stops.length; i++) {
    const seconds = t.stops[i][1] - t.stops[i - 1][2]
    const record = { tripId: t.id, routeId: t.routeId, line: t.route, mode: routes.get(t.routeId).mode,
      fromId: raw.stops[t.stops[i - 1][0]][4], toId: raw.stops[t.stops[i][0]][4], admitted: t.admission === 'admitted' }
    if (!seconds) zero.push(record)
    else if (record.admitted) {
      const pathMetres = pathLengths[t.pathSegments[i - 1]], kilometresPerHour = pathMetres / seconds * 3.6
      if (!maxima.has(record.mode) || kilometresPerHour > maxima.get(record.mode).kilometresPerHour) maxima.set(record.mode, { ...record, seconds, pathMetres, kilometresPerHour })
    }
  }
  return { zeroDurationSegmentOccurrences: zero.length, admittedZeroDurationSegmentOccurrences: zero.filter(r => r.admitted).length,
    admittedJourneysWithZeroDurationSegments: new Set(zero.filter(r => r.admitted).map(r => r.tripId)).size,
    maximumPositiveDurationSegmentByMode: [...maxima.values()],
    policy: 'Original GTFS times retained, including coincident minute-resolution calls. Geometry admission does not certify speed or timing precision; no artificial seconds inserted. Zero-duration segments have no finite implied speed.' }
}

export async function buildThurgauRegion({ archive, sourceDirectory = 'data/thurgau-sources', dates = ['2026-09-04', '2026-09-06'],
  output = 'public/data/thurgau-region', auditDirectory = 'data/thurgau-audit', timetableCache, crosswalkPath = 'data/thurgau-line-crosswalk.json' }) {
  assert.deepEqual(dates, ['2026-09-04', '2026-09-06'], 'Review and update Thurgau fixture policy before changing dates')
  const source = await zippedJson(join(sourceDirectory, 'decoded.json.gz')), crosswalk = await json(crosswalkPath)
  const cityRoads = await zippedJson('data/thurgau-city-roads/cache.json.gz')
  const regionalRoads = await zippedJson('data/thurgau-regional-roads/cache.json.gz')
  const hashes = { archive: await hashFile(archive), source: await hashFile(join(sourceDirectory, 'decoded.json.gz')),
    crosswalk: await hashFile(crosswalkPath), requests: await hashFile(join(sourceDirectory, 'requests.json')),
    cityRoads: await hashFile('data/thurgau-city-roads/cache.json.gz'),
    regionalRoads: await hashFile('data/thurgau-regional-roads/cache.json.gz') }
  assert.equal(hashes.archive, 'd325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e', 'Unreviewed GTFS fixture')
  const census = await json('data/swiss-transit-agencies.json')
  assert.equal(census.sourceSha256, hashes.archive)
  const provenance = { ...source.metadata, cityRoads: cityRoads.metadata, regionalRoads: regionalRoads.metadata, timetable: { publisher: 'SBB / Open data platform mobility Switzerland',
    attribution: 'opentransportdata.swiss', sourceUrl: census.sourceUrl, feed: census.feed, sha256: hashes.archive,
    downloadUrl: 'https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip',
    termsUrl: 'https://opentransportdata.swiss/en/terms-of-use/', processedBy: 'Gleislicht',
    archivalStudy: true, refreshPolicy: 'Pinned September 2026 research fixtures; not a live or current-service feed. A new timetable or geometry release requires a complete rebuild and admission audit.' } }
  for (const [id, name] of Object.entries(crosswalk.expectedAgencyNames)) assert.equal(census.agencies.find(a => a.id === id)?.name, name, `Changed crosswalk agency ${id}`)
  let timetable
  if (timetableCache) {
    timetable = await zippedJson(timetableCache)
    assert.deepEqual(timetable.sourceHashes, { archive: hashes.archive, source: hashes.source }, 'Unverified Thurgau timetable cache')
  } else {
    timetable = await readThurgauTimetables(archive, dates, source)
    timetable.sourceHashes = { archive: hashes.archive, source: hashes.source }
  }
  const rail = await loadThurgauRail(timetable)
  hashes.railPolicy = rail.policySha256
  hashes.railSourceMetadata = rail.policy.sourceMetadataSha256
  provenance.rail = { ...rail.source, limits: rail.policy.limits, policy: rail.policy.scope }
  await writeJson(join(auditDirectory, 'rail-source-segments.json'), rail.sourceInventory, true)
  assert.deepEqual(timetable.snapshots.map(s => s.metadata.serviceDate), dates)
  assert.deepEqual(thurgauCrosswalk(timetable, source), crosswalk, 'Crosswalk evidence does not reproduce')
  await mkdir(auditDirectory, { recursive: true })
  await writeFile(join(auditDirectory, 'timetable-cache.json.gz'), gzipSync(JSON.stringify(timetable), { mtime: 0 }))
  hashes.timetableCache = await hashFile(join(auditDirectory, 'timetable-cache.json.gz'))
  const routes = new Map(timetable.routes.map(r => [r.id, r])), reports = [], patternSets = []
  const routeDays = new Map(timetable.routes.map(r => [r.id, []]))
  let routeCrosswalk
  for (const raw of timetable.snapshots) {
    console.log(`Matching every directed Thurgau pattern for ${raw.metadata.serviceDate}…`)
    const result = applyThurgauGeometry(raw, routes, source, crosswalk, cityRoads, regionalRoads, rail)
    routeCrosswalk = result.routeCrosswalk
    const groups = []
    for (const key of [...new Set(result.trains.map(t => `${t.agencyId}:${routes.get(t.routeId).mode}`))].sort()) {
      const ids = new Set([...routes.values()].filter(r => `${r.agencyId}:${r.mode}` === key).map(r => r.id))
      groups.push({ id: key, agency: routes.get(result.trains.find(t => ids.has(t.routeId)).routeId).agency,
        ...thurgauCoverage(result.trains.filter(t => ids.has(t.routeId)), result.pairs.filter(p => ids.has(p.routeId)), result.patterns.filter(p => ids.has(p.routeId))) })
    }
    for (const route of timetable.routes) {
      const trains = result.trains.filter(t => t.routeId === route.id), pairs = result.pairs.filter(p => p.routeId === route.id), patterns = result.patterns.filter(p => p.routeId === route.id)
      routeDays.get(route.id).push({ date: raw.metadata.serviceDate, ...thurgauCoverage(trains, pairs, patterns) })
    }
    const snapshot = compactBernFeed(raw, result)
    snapshot.metadata = { ...snapshot.metadata, publisher: 'Gleislicht', timetablePublisher: 'SBB', attribution: 'opentransportdata.swiss',
      label: 'Thurgau canton — cantonal geometry, inferred bus roads and federal rail', sourceHashes: hashes, timetable: provenance.timetable,
      model: 'Scheduled interpolation along cantonal centrelines, OSM-inferred bus roads and FOT rail infrastructure, with bounded stop-access connectors; not observed vehicles.',
      cityRoads: { ...cityRoads.metadata, localPathDatabase: '../city-road-paths.json' },
      regionalRoads: { ...regionalRoads.metadata, localPathDatabase: '../regional-road-paths.json' },
      rail: { ...provenance.rail, localSourceMetadata: '../rail-sources/source.json' },
      scope: timetable.census.boundaryRule, admission: 'Only complete directed patterns with every segment passing geometry limits and no reservation/on-demand call. Exclusions retained in the canton audit.',
      geometry: { ...source.metadata, transformation: 'swisstopo approximate CH1903+/WGS84 formula; original LV95 vertices, no simplification, seven-decimal output coordinates',
        modifications: 'Gleislicht: line selection, route graphs, shortest source paths between ordered stop projections, inferred stop-access connectors bounded by snapMetres, conversion to WGS84 and output rounding.',
        limits: THURGAU_LIMITS, direction: 'Bidirectional centreline inference from ordered calls. No road one-way or rail running-track certification; no realtime/diversion verification.',
        localMetadata: '../sources.json', localTerms: ['../terms.pdf', '../catalogue.json'] },
    }
    validateBernSnapshot(snapshot)
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'day-chunks')
    validateBernChunks(snapshot, manifest, chunks)
    const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
    validateBernSnapshot(morning)
    const destination = join(output, raw.metadata.serviceDate)
    for (const { descriptor, payload } of chunks) await writeJson(join(destination, descriptor.path), payload)
    await writeJson(join(destination, 'thurgau-region-day-manifest.json'), manifest)
    await writeJson(join(destination, 'thurgau-region-morning.json'), morning)
    const coverage = thurgauCoverage(result.trains, result.pairs, result.patterns)
    patternSets.push(new Set(result.patterns.map(p => p.id)))
    const report = { schemaVersion: 1, serviceDate: raw.metadata.serviceDate, sourceHashes: hashes, coverage, groups,
      cityRoadCoverage: { trips: snapshot.trains.filter(t => t.geometrySource === 'osm-city-road').length,
        patterns: result.patterns.filter(p => p.geometrySource === 'osm-city-road').length,
        directedPairs: result.pairs.filter(p => p.geometrySource === 'osm-city-road').length,
        scheduledSegmentOccurrences: snapshot.trains.filter(t => t.geometrySource === 'osm-city-road').reduce((n, t) => n + t.pathSegments.length, 0),
        pairsWithMultiplePatternPaths: result.pairs.filter(p => p.geometrySource === 'osm-city-road' && p.pathVariantCount > 1).length },
      regionalRoadCoverage: { trips: snapshot.trains.filter(t => t.geometrySource === 'osm-regional-road').length,
        patterns: result.patterns.filter(p => p.geometrySource === 'osm-regional-road').length,
        directedPairs: result.pairs.filter(p => p.geometrySources?.includes('osm-regional-road')).length,
        rejectedPatterns: result.patterns.filter(p => p.roadSupplement?.status === 'rejected-incomplete-pattern').length,
        scheduledSegmentOccurrences: snapshot.trains.filter(t => t.geometrySource === 'osm-regional-road').reduce((n, t) => n + t.pathSegments.length, 0) },
      railCoverage: { trips: snapshot.trains.filter(t => t.geometrySource === 'fot-rail-inference').length,
        patterns: result.patterns.filter(p => p.geometrySource === 'fot-rail-inference').length,
        rejectedPatterns: result.patterns.filter(p => p.railSupplement?.status === 'rejected-incomplete-pattern').length,
        directedPairs: result.pairs.filter(p => p.geometrySources?.includes('fot-rail-inference')).length,
        scheduledSegmentOccurrences: snapshot.trains.filter(t => t.geometrySource === 'fot-rail-inference').reduce((n, t) => n + t.pathSegments.length, 0) },
      timing: thurgauTimingDiagnostics(raw, result, routes),
      carryInTrips: result.trains.filter(t => t.sourceServiceDate !== raw.metadata.serviceDate).length,
      admittedCarryInTrips: snapshot.trains.filter(t => t.sourceServiceDate !== raw.metadata.serviceDate).length,
      admittedOutsideCantonPlatforms: snapshot.stops.filter(s => !timetable.sourceStopInventory.some(p => p.id === s[4])).length,
      directedPatternChecks: { directionIds: [...new Set(result.patterns.map(p => p.directionId))].sort(),
        patternsRevisitingPlatforms: result.patterns.filter(p => new Set(p.stopIds).size < p.stopIds.length).length,
        admittedPatternsRevisitingPlatforms: result.patterns.filter(p => p.admittedTrips && new Set(p.stopIds).size < p.stopIds.length).length,
        nightRouteTrips: result.trains.filter(t => routes.get(t.routeId).type === 705 || /^(?:SN|BN|N|M)\d|^NT$/.test(t.route)).length,
        admittedNightRouteTrips: snapshot.trains.filter(t => routes.get(t.routeId).type === 705 || /^(?:SN|BN|N|M)\d|^NT$/.test(t.route)).length },
      patterns: result.patterns.map(({ pathSegments, ...p }) => ({ ...p, matchedMask: pathSegments.map(i => i !== null) })),
      directedPairs: result.pairs.map(({ pathIndex, ...p }) => ({ ...p, matched: pathIndex !== null })),
      payload: { manifest: { bytes: Buffer.byteLength(JSON.stringify(manifest)), gzipBytes: gzipSync(JSON.stringify(manifest)).length },
        morning: { trips: morning.trains.length, gzipBytes: gzipSync(JSON.stringify(morning)).length },
        chunks: chunks.map(({ descriptor, payload }) => ({ ...descriptor, gzipBytes: gzipSync(JSON.stringify(payload)).length })) },
      validation: { completeSourceCalls: true, directedEndpoints: true, finiteOrderedTimes: true, chunkHashesAndTripIdentity: true,
        admittedGeometryCoverage: 1, unsourcedWholeSegmentsInFeed: false, shortInferredStopAccessConnectors: true,
        physicalDirectionCertified: false, yearRoundCoverageEstablished: false },
    }
    await writeJson(join(auditDirectory, `${raw.metadata.serviceDate}.json`), report)
    reports.push({ ...report, patterns: undefined, directedPairs: undefined })
    console.log(JSON.stringify({ date: report.serviceDate, ...coverage }))
  }
  const inventory = timetable.routes.map(route => {
    const days = routeDays.get(route.id), total = days.reduce((n, d) => n + d.trips, 0), admitted = days.reduce((n, d) => n + d.admittedTrips, 0)
    return { ...route, sourceLines: routeCrosswalk.find(c => c.routeId === route.id).sourceLines,
      roadSupplement: ['727', '797'].includes(route.agencyId) && route.name !== 'NT' ? 'osm-city-road; full ordered pattern and coordinates required'
        : THURGAU_REGIONAL_BUS_AGENCIES.includes(route.agencyId) && route.mode === 'bus' && route.type !== 715 ? 'osm-regional-road; complete official patterns take priority; complete road patterns only' : null,
      railSupplement: rail.policy.routes.some(r => r.routeId === route.id) ? 'fot-rail-inference; complete official patterns preserved, exact operating points and full ordered patterns required' : null,
      crosswalk: crosswalk.routes.find(c => c.routeId === route.id), days,
      status: !total ? 'inactive-on-validation-dates' : !admitted ? 'excluded' : admitted === total ? 'admitted-all-dated-trips' : 'partially-admitted' }
  })
  const sourceLines = source.lines.map(f => ({ ...f.properties, liniencode: f.id,
    vertexCount: f.geometry.coordinates.length,
    tokens: f.id.startsWith('buslinie.') ? thurgauLineTokens(f.properties.liniennr_1) : [],
    routeIds: routeCrosswalk.filter(c => c.sourceLines.includes(f.id)).map(c => c.routeId),
    status: routeCrosswalk.some(c => c.sourceLines.includes(f.id)) ? 'crosswalk-candidate' : 'no-canton-gtfs-crosswalk',
    ...(routeCrosswalk.some(c => c.sourceLines.includes(f.id)) ? {} : {
      exclusionReason: 'No verified route crosswalk; may be outside the canton, absent from GTFS, renamed or an unresolved source identifier. Not silently treated as timetable coverage.' }),
  }))
  const usedStopIds = new Set(inventory.flatMap(r => r.inCantonStops))
  const districtInventory = source.districts.map(d => ({ district: d.properties.name,
    calledPlatforms: timetable.sourceStopInventory.filter(s => s.district === d.properties.name && usedStopIds.has(s.id)).length,
    routeIds: inventory.filter(r => r.districts.includes(d.properties.name)).map(r => r.id) }))
  const capabilities = gunzipSync(await readFile(join(sourceDirectory, 'capabilities.xml.gz'))).toString()
  for (const layer of ['dist_bahn', 'dist_bus']) assert(capabilities.includes(`ms:${layer}`))
  const sourceStops = source.layers.bushalte.map(f => ({ id: f.id, ...f.properties,
    gtfsPlatformIds: timetable.sourceStopInventory.filter(s => s.didok === f.properties.id_didok).map(s => s.id),
    crosswalkRouteIds: crosswalk.routes.filter(r => r.evidenceStopIds?.includes(f.id)).map(r => r.routeId) }))
  const summary = { schemaVersion: 1, sourceHashes: hashes, sources: provenance, census: timetable.census,
    routeCount: inventory.length, agencyCount: new Set(inventory.map(r => r.agencyId)).size,
    weekdaySundayPatterns: { shared: [...patternSets[0]].filter(id => patternSets[1].has(id)).length,
      weekdayOnly: [...patternSets[0]].filter(id => !patternSets[1].has(id)).length,
      sundayOnly: [...patternSets[1]].filter(id => !patternSets[0].has(id)).length,
      key: 'GTFS route identity + direction_id + full ordered original platform IDs, including repeats and out-of-canton calls' },
    routesByStatus: Object.fromEntries([...new Set(inventory.map(r => r.status))].map(status => [status, inventory.filter(r => r.status === status).length])),
    districts: districtInventory, days: reports,
    sourceLayerInventory: source.metadata.layers,
    auxiliaryLayers: ['dist_bahn', 'dist_bus'].map(id => ({ id, status: 'advertised-in-pinned-WFS-capabilities; not downloaded', reason: 'Accessibility distance surfaces, not vehicle route geometry' })),
    demandResponsiveAreas: source.layers.sammeltaxi.map(f => ({ id: f.id, ...f.properties, status: 'excluded-service-area-not-fixed-vehicle-path' })),
    scopeLimits: ['GTFS fixed-stop archive and all Thurgau WFS transit layers inventoried; services absent from both sources and GTFS-Flex service areas are not a verified census of every real-world service.',
      'Two September civil days do not establish holiday, winter or year-round pattern coverage.',
      'Cross-boundary journeys keep all calls. Entire patterns failing any segment are excluded, including source extents shorter than their timetable journeys.',
      'Geometry combines official-line centreline inference, OSM bus-road matching and FOT rail infrastructure, not observed movement, legal one-way validation, running-track selection or temporary diversion confirmation.'],
  }
  await writeJson(join(auditDirectory, 'summary.json'), summary, true)
  await writeJson(join(auditDirectory, 'routes.json'), inventory, true)
  await writeJson(join(auditDirectory, 'source-lines.json'), sourceLines, true)
  await writeJson(join(auditDirectory, 'source-stops.json'), sourceStops, true)
  await writeJson(join(auditDirectory, 'stops.json'), timetable.sourceStopInventory, false)
  await writeJson(join(output, 'sources.json'), provenance, true)
  await writeJson(join(output, 'city-road-paths.json'), cityRoads)
  await writeJson(join(output, 'regional-road-paths.json'), regionalRoads)
  await mkdir(join(output, 'rail-sources'), { recursive: true })
  for (const file of ['source.json', 'catalogue.json', 'collection.json']) await writeFile(join(output, 'rail-sources', file), await readFile(join('data/thurgau-rail-sources', file)))
  for (const name of source.metadata.termsFiles) await writeFile(join(output, name), gunzipSync(await readFile(join(sourceDirectory, name + '.gz'))))
  await writeJson(join(output, 'index.json'), { label: 'Thurgau canton regional feed', sourceHashes: hashes, dates: dates.map(date => ({ date,
    manifest: `${date}/thurgau-region-day-manifest.json`, morning: `${date}/thurgau-region-morning.json` })), admission: 'Complete geometry patterns only; see docs/THURGAU-STUDY.md and data/thurgau-audit for exclusions.' }, true)
  return summary
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined
  assert(arg('archive'), 'Missing --archive')
  const summary = await buildThurgauRegion({ archive: arg('archive'), sourceDirectory: arg('sources'), output: arg('output-directory'),
    auditDirectory: arg('audit-directory'), timetableCache: arg('timetable-cache') })
  console.log(JSON.stringify({ routes: summary.routeCount, agencies: summary.agencyCount, status: summary.routesByStatus }))
}
