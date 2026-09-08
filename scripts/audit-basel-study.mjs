import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { activeServices, rowsFromArchive, parseGtfsTime } from '@motionstudies/data/gtfs'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { baselGraphs, applyBaselGeometry, BASEL_AGENCIES, BASEL_PATH_LIMITS } from './basel-line-geometry.mjs'
import { validateBaselDownload } from './download-basel-sources.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { baselTram19Graph, BASEL_RAIL_SOURCE } from './basel-rail-geometry.mjs'
import { applyBaselRoadFallback } from './basel-road-geometry.mjs'
import { baselTramDiversions } from './basel-tram-diversions.mjs'

const GZIP_LIMITS = { manifest: 650 * 1024, chunk: 450 * 1024, morning: 1600 * 1024 }
const gzipBytes = value => gzipSync(JSON.stringify(value)).length
async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}

export function compactBaselSnapshot(snapshot) {
  const used = [...new Set(snapshot.trains.flatMap(train => train.stops.map(([i]) => i)))].sort((a, b) => a - b)
  const remap = new Map(used.map((i, next) => [i, next]))
  const stops = used.map(i => snapshot.stops[i])
  const trains = snapshot.trains.map(train => ({ ...train, stops: train.stops.map(([i, ...times]) => [remap.get(i), ...times]) }))
  const pairs = new Set(trains.flatMap(train => train.stops.slice(1).map(([to], i) => [train.stops[i][0], to].sort((a, b) => a - b).join(':'))))
  return { ...snapshot, stops, trains, edges: [...pairs].sort().map(key => key.split(':').map(Number)), bounds: {
    minLongitude: Math.min(...stops.map(stop => stop[0])), maxLongitude: Math.max(...stops.map(stop => stop[0])),
    minLatitude: Math.min(...stops.map(stop => stop[1])), maxLatitude: Math.max(...stops.map(stop => stop[1])),
  } }
}

export function baselGate(groups, payload) {
  return [
    ...['BVB-tram', 'BVB-bus', 'BLT-tram', 'BLT-bus'].flatMap(id => {
      const group = groups.find(item => item.id === id)
      return !group?.trips || group.coverage < 0.95 ? [`${id}: requires trips and at least 95% accepted geometry`] : []
    }),
    ...(payload.manifestGzipBytes > GZIP_LIMITS.manifest ? ['Manifest exceeds existing regional budget'] : []),
    ...(payload.morningGzipBytes > GZIP_LIMITS.morning ? ['Morning exceeds existing regional budget'] : []),
    ...payload.chunks.filter(chunk => chunk.gzipBytes > GZIP_LIMITS.chunk).map(chunk => `${chunk.id} exceeds existing regional chunk budget`),
  ]
}

export async function auditBaselStudy({ archive, sourceDirectory, date, output, snapshotPath, railPath, busCachePath, diversionPolicyPath }) {
  const work = await mkdtemp(join(tmpdir(), 'gleislicht-basel-'))
  try {
    const rawPath = snapshotPath ?? join(work, 'raw.json')
    if (!snapshotPath) {
      const run = spawnSync(process.execPath, ['scripts/ingest-gtfs.mjs', '--archive', archive, '--date', date, '--modes', 'tram,bus', '--bounds', '-180,-90,180,90', '--local-agencies', '823,37', '--window-start', '00:00', '--window-end', '24:00', '--hub-output', 'none', '--output', rawPath], { stdio: 'inherit' })
      assert.equal(run.status, 0, 'Basel timetable extraction failed')
    }
    let raw = JSON.parse(await readFile(rawPath, 'utf8'))
    const feed = []
    for await (const row of rowsFromArchive(archive, 'feed_info.txt')) feed.push(row)
    assert.equal(raw.metadata.feedVersion, feed[0]?.feed_version)
    assert.equal(raw.metadata.serviceDate, date)
    assert.equal(raw.metadata.windowStart, 0); assert.equal(raw.metadata.windowEnd, 86400)
    assert.deepEqual(raw.metadata.localAgencyIds, ['823', '37'])
    const sourceStops = new Map()
    for await (const row of rowsFromArchive(archive, 'stops.txt')) sourceStops.set(row.stop_id, row)
    for (const stop of raw.stops) {
      const source = sourceStops.get(stop[4])
      assert(source, `Unknown source platform ${stop[4]}`)
      assert.deepEqual(stop.slice(0, 3), [Number(source.stop_lon), Number(source.stop_lat), source.stop_name], `Altered source platform ${stop[4]}`)
    }
    const routes = new Map()
    for await (const row of rowsFromArchive(archive, 'routes.txt')) {
      if (BASEL_AGENCIES[row.agency_id] && ['700', '702', '705', '900'].includes(row.route_type)) routes.set(row.route_id, { agencyId: row.agency_id, name: row.route_short_name, type: Number(row.route_type) })
    }
    const active = await activeServices(archive, date), sourceTrips = new Map()
    for await (const row of rowsFromArchive(archive, 'trips.txt')) {
      if (active.has(row.service_id) && routes.has(row.route_id)) sourceTrips.set(row.trip_id, { routeId: row.route_id, calls: [] })
    }
    // Guard source completeness rather than silently reducing a newly
    // frequency-based service to one template. Current Basel feeds have none.
    for await (const row of rowsFromArchive(archive, 'frequencies.txt')) assert(!sourceTrips.has(row.trip_id), 'Active Basel frequency template: extend the source-completeness audit before proceeding')
    console.log('Verifying complete Basel source stop chains…')
    for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
      const trip = sourceTrips.get(row.trip_id)
      if (trip) trip.calls.push({ id: row.stop_id, sequence: Number(row.stop_sequence), arrival: parseGtfsTime(row.arrival_time || row.departure_time), departure: parseGtfsTime(row.departure_time || row.arrival_time) })
    }
    for (const trip of sourceTrips.values()) trip.calls.sort((a, b) => a.sequence - b.sequence)
    const eligible = new Set([...sourceTrips].filter(([, trip]) => trip.calls.length >= 2 && trip.calls[0].departure < 86400 && trip.calls.at(-1).arrival >= 0).map(([id]) => id))
    raw.trains = raw.trains.filter(train => train.start < 86400).map(train => {
      const source = sourceTrips.get(train.id)
      assert(source, `Unexpected or inactive source trip ${train.id}`)
      const route = routes.get(source.routeId)
      assert.equal(train.route, route.name, 'Changed source line name')
      assert.equal(train.category, route.type === 900 ? 'tram' : 'bus', 'Changed source transport mode')
      assert.equal(train.start, source.calls[0].departure, 'Changed trip start')
      assert.equal(train.end, source.calls.at(-1).arrival, 'Changed trip end')
      assert.deepEqual(train.stops.map(([i, arrival, departure]) => [raw.stops[i][4], arrival, departure]), source.calls.map(call => [call.id, call.arrival, call.departure]), `Clipped or altered stop chain: ${train.id}`)
      if (train.routeId) assert.equal(train.routeId, source.routeId)
      return { ...train, routeId: source.routeId }
    })
    assert.equal(new Set(raw.trains.map(train => train.id)).size, raw.trains.length, 'Duplicate candidate trip')
    assert.deepEqual(new Set(raw.trains.map(train => train.id)), eligible, 'Missing Basel source journeys')
    raw = compactBaselSnapshot(raw)
    const catalogue = JSON.parse(await readFile(join(sourceDirectory, 'sources.json'), 'utf8'))
    assert.deepEqual(catalogue.sources.map(source => source.layer).sort(), ['LN_Buslinie', 'LN_Tramlinie'])
    const collections = []
    for (const source of catalogue.sources) {
      const path = join(sourceDirectory, `${source.layer}.geojson`)
      assert.equal(await hashFile(path), source.sha256, 'Basel source hash differs from catalogue')
      const collection = JSON.parse(await readFile(path, 'utf8'))
      validateBaselDownload(collection, source.features); collections.push(collection)
    }
    console.log('Matching Basel local lines…')
    const graphs = baselGraphs(collections), supplementalSources = []
    if (railPath) {
      const { graph, corridor } = baselTram19Graph(parseRailNetworkXtf(await readFile(railPath, 'utf8'), BASEL_RAIL_SOURCE.simplificationMetres))
      assert(!graphs.has('37:tram:19'), 'Official BS source now supplies tram 19; review source priority')
      graphs.set('37:tram:19', graph)
      supplementalSources.push({ ...corridor, sha256: await hashFile(railPath), validOn: null })
    }
    const diversions = diversionPolicyPath ? baselTramDiversions(collections, JSON.parse(await readFile(diversionPolicyPath, 'utf8')), date) : undefined
    const official = applyBaselGeometry(raw, routes, graphs, diversions)
    const busCache = busCachePath ? JSON.parse(await readFile(busCachePath, 'utf8')) : undefined
    const geometry = busCache ? applyBaselRoadFallback(raw, official, routes, busCache) : official
    const sourceHashes = { archive: await hashFile(archive), snapshot: await hashFile(rawPath), catalogue: await hashFile(join(sourceDirectory, 'sources.json')) }
    if (busCachePath) sourceHashes.busCache = await hashFile(busCachePath)
    if (diversionPolicyPath) sourceHashes.diversionPolicy = await hashFile(diversionPolicyPath)
    const snapshot = { ...raw, paths: geometry.paths, trains: geometry.trains, edgePaths: geometry.edgePaths, metadata: { ...raw.metadata,
      model: 'scheduled interpolation on official Basel-Stadt lines, optional FOT tram 19 infrastructure and optional OSM bus paths',
      note: 'AUDIT CANDIDATE. Complete BVB/BLT bus and tram source journeys, including foreign stops. No regional rail or other TNW operators. Official line graphs are undirected. OSM bus fallback uses exact route/platform patterns and is not operator-verified. Directions and source-date alignment need review. Unmatched movements use stop interpolation.',
      sourceHashes, geometry: { publisher: 'Kanton Basel-Stadt', sourceUrl: 'https://wfs.geo.bs.ch/', retrievedAt: catalogue.retrievedAt, validOn: null, inference: 'operator/mode/line graph; bounded source-part alternatives; undirected shortest paths; optional per-pattern OSM bus fallback', limits: BASEL_PATH_LIMITS, sources: catalogue.sources, supplementalSources,
        ...(geometry.roadFallback ? { roadSources: geometry.roadFallback.sources, roadAddedMovements: geometry.roadFallback.addedMovements } : {}),
        ...(diversions ? { tramDiversions: diversions.provenance } : {}),
      },
    } }
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'basel-local-day-chunks')
    const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
    const payload = { manifestGzipBytes: gzipBytes(manifest), morningGzipBytes: gzipBytes(morning), chunks: chunks.map(({ descriptor, payload: chunk }) => ({ id: descriptor.id, trips: descriptor.tripCount, gzipBytes: gzipBytes(chunk) })) }
    const failures = baselGate(geometry.groups, payload)
    const matched = geometry.segments.filter(segment => segment.pathIndex !== null)
    const officialMatched = official.segments.filter(segment => segment.pathIndex !== null)
    const controls = ['St-Louis, Gare de Saint-Louis', 'Weil am Rhein, Bahnhof/Zentrum', 'Leymen, Station (F)'].map(name => {
      const indices = new Set(snapshot.stops.flatMap((stop, i) => stop[2] === name ? [i] : []))
      const stopIds = new Set([...indices].map(i => snapshot.stops[i][4]))
      const segments = geometry.segments.filter(segment => stopIds.has(segment.fromId) || stopIds.has(segment.toId))
      return { name, platforms: indices.size, trips: snapshot.trains.filter(train => train.stops.some(([i]) => indices.has(i))).length,
        matchedAdjacentMovements: segments.reduce((sum, segment) => sum + (segment.matchedOccurrences ?? (segment.pathIndex !== null ? segment.occurrences : 0)), 0),
        totalAdjacentMovements: segments.reduce((sum, segment) => sum + segment.occurrences, 0) }
    })
    assert(controls.every(control => control.trips > 0), 'A cross-border control is missing from the candidate')
    const report = { schemaVersion: 2, metadata: { serviceDate: date, feedVersion: feed[0].feed_version, nodeVersion: process.version, sourceHashes, geometrySources: catalogue, supplementalSources },
      scope: { agencyIds: Object.keys(BASEL_AGENCIES), modes: ['tram', 'bus'], description: 'Complete BVB/BLT local source journeys starting before 24:00 on the selected service day; after-midnight calls retained. Previous service-day carry-in is not imported. Excludes rail, other TNW operators and frequency templates (fail closed if introduced).', trips: snapshot.trains.length, platforms: snapshot.stops.length, bounds: snapshot.bounds, completeSourceStopChainsVerified: true, crossBorderControls: controls },
      groups: geometry.groups, routes: geometry.routes.sort((a, b) => a.agencyId.localeCompare(b.agencyId) || a.mode.localeCompare(b.mode) || a.line.localeCompare(b.line, undefined, { numeric: true })),
      geometry: { graphCount: graphs.size, paths: snapshot.paths.length, uniqueDirectedRouteStopPairs: geometry.segments.length, matchedUniqueDirectedRouteStopPairs: matched.length, uniquePairCoverage: matched.length / geometry.segments.length,
        pairCoverageDefinition: 'A directed route/platform pair is matched only when every scheduled occurrence matches. Report pathIndex is representative; train paths retain exact full-pattern identity.',
        maximumAcceptedOfficialSnapMetres: Math.max(...officialMatched.map(segment => segment.maximumSnapMetres)), projectionAlternatives: officialMatched.filter(segment => segment.projectionChoice), worstAcceptedOfficialSnaps: [...officialMatched].sort((a, b) => b.maximumSnapMetres - a.maximumSnapMetres).slice(0, 30), issues: geometry.segments.filter(segment => segment.pathIndex === null),
        ...(diversions ? { tramDiversions: { ...diversions.provenance, matches: officialMatched.filter(segment => segment.diversionRule) } } : {}),
        ...(geometry.roadFallback ? { officialOnlyGroups: official.groups, roadFallback: geometry.roadFallback } : {}),
      },
      payload, gate: { passed: failures.length === 0, failures, minimumPerGroupCoverage: 0.95, limits: BASEL_PATH_LIMITS, gzipLimits: GZIP_LIMITS, publicationReady: false, pending: ['Resolve missing BLT/BVB lines and inspect failed stop pairs', 'Establish geometry validity against dated diversions; review directions, loops and foreign branches', 'Add scoped regional rail and audit wider TNW membership', 'Integrate study UI, translations, sharing, refresh/recovery and phone verification'] } }
    await mkdir(output, { recursive: true })
    for (const { descriptor, payload: chunk } of chunks) { const path = join(output, descriptor.path); await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(chunk)) }
    await writeFile(join(output, 'basel-local-day-manifest.json'), JSON.stringify(manifest))
    await writeFile(join(output, 'basel-local-morning.json'), JSON.stringify(morning))
    await writeFile(join(output, 'basel-audit.json'), `${JSON.stringify(report, null, 2)}\n`)
    return report
  } finally { await rm(work, { recursive: true, force: true }) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined
  for (const name of ['archive', 'sources', 'date', 'output-directory']) assert(arg(name), `Missing --${name}`)
  const output = resolve(arg('output-directory'))
  assert(output !== resolve('public') && !output.startsWith(`${resolve('public')}/`), 'Audit candidates must remain outside public/')
  const report = await auditBaselStudy({ archive: resolve(arg('archive')), sourceDirectory: resolve(arg('sources')), date: arg('date'), output, snapshotPath: arg('snapshot'), railPath: arg('rail-geometry'), busCachePath: arg('bus-cache'), diversionPolicyPath: arg('tram-diversions') })
  console.log(JSON.stringify({ scope: report.scope, groups: report.groups, payload: report.payload, gate: report.gate }, null, 2))
  if (process.argv.includes('--check') && !report.gate.passed) process.exitCode = 1
}
