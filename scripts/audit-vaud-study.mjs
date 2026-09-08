import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { rowsFromArchive, transportModeForRouteType } from '@motionstudies/data/gtfs'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { applyRailGeometry, parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { applyLausanneRailGeometry } from './lausanne-rail-geometry.mjs'
import { assessLausannePath, lausanneTechnicalGate } from './audit-lausanne-study.mjs'
import { applyRoadCache } from './enrich-postbus-roads.mjs'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
import { compactBaselSnapshot } from './audit-basel-study.mjs'
import { serviceDate } from './service-date.mjs'
import { previousServiceDate } from './civil-day.mjs'

// Discovery envelope, deliberately not described as a canton or tariff polygon.
export const VAUD_BOUNDS = '5.95,46.18,7.25,47.0'
export const VAUD_BUS_CACHES = ['data/vaud-mbc-road-cache.json', 'data/vaud-mbc-sunday-road-cache.json', 'data/lausanne-road-cache.json', 'data/postbus-road-cache.json', ...['738', '741'].flatMap(id => ['weekday', 'sunday'].map(day => `data/vaud-nyon-${id}-${day}-road-cache.json`))]
export const VAUD_AGENCIES = {
  '11': 'SBB', '23': 'TPC rail', '29': 'MBC rail', '33': 'BLS',
  '42': 'MVR CEV', '53': 'TPF rail', '55': 'LEB', '64': 'MOB',
  '66': 'NStCM', '74': 'RegionAlps rail', '97': 'TRAVYS rail', '151': 'tl',
  '731': 'AVJ', '738': 'TPN', '741': 'Bus Nyon-Prangins', '764': 'MBC bus',
  '801': 'PostAuto', '814': 'RegionAlps bus', '818': 'TPC bus',
  '834': 'TPF bus', '876': 'VMCV', '895': 'TRAVYS bus', '9020': 'TRAVYS OC bus',
  '7040': 'MOB replacement', '7253': 'TPC replacement', '7254': 'TRAVYS replacement',
  '7256': 'MBC replacement', '7258': 'NStCM replacement', '7260': 'MVR replacement',
}

export function vaudAdmission(route) {
  assert(route, 'Unknown source route')
  if (!['rail', 'metro', 'bus'].includes(route.mode)) return 'deferred-mode'
  if (!VAUD_AGENCIES[route.agencyId]) return 'outside-operator-scope'
  return 'candidate'
}

// Use an ordered subsequence, not a set: loops may visit a platform twice.
// Cropping away an intermediate call must never invent a direct movement.
export function auditVaudBoundary(sourceIds, retainedIds) {
  assert(sourceIds.length >= retainedIds.length && retainedIds.length >= 2)
  const positions = []
  let cursor = 0
  for (const id of retainedIds) {
    const at = sourceIds.indexOf(id, cursor)
    assert(at >= 0, `Retained platform is absent or reordered: ${id}`)
    positions.push(at); cursor = at + 1
  }
  return {
    clippedStart: positions[0] > 0,
    clippedEnd: positions.at(-1) < sourceIds.length - 1,
    interiorGaps: positions.slice(1).flatMap((at, i) => at > positions[i] + 1 ? [i] : []),
  }
}

export function summarizeVaud(snapshot, routes) {
  const groups = new Map()
  for (const train of snapshot.trains) {
    const route = routes.get(train.routeId)
    const id = route.agencyId === '151' && route.mode === 'metro' ? `151:${route.name}` : `${route.agencyId}:${route.mode}`
    if (!groups.has(id)) groups.set(id, { id, operator: VAUD_AGENCIES[route.agencyId], agencyId: route.agencyId, mode: route.mode, trips: 0, headwayTrips: 0, previousDayTrips: 0, routes: new Set(), totalSegments: 0, acceptedSegments: 0, pairs: new Map() })
    const group = groups.get(id)
    group.trips++; group.routes.add(train.routeId)
    if (train.frequency?.exactTimes === 0) group.headwayTrips++
    if (train.sourceServiceDate && train.sourceServiceDate !== snapshot.metadata.serviceDate) group.previousDayTrips++
    for (let i = 1; i < train.stops.length; i++) {
      const from = snapshot.stops[train.stops[i - 1][0]], to = snapshot.stops[train.stops[i][0]]
      const index = train.pathSegments?.[i - 1]
      if (index != null) assert(Number.isInteger(index) && index >= 0 && snapshot.paths[index], 'Invalid Vaud path reference')
      const result = assessLausannePath(snapshot.paths[index], from, to)
      const key = `${train.routeId}:${from[4]}:${to[4]}`
      const pair = group.pairs.get(key) ?? { routeId: train.routeId, route: train.route, from: from[2], to: to[2], fromId: from[4], toId: to[4], occurrences: 0, rejectedOccurrences: 0, reasons: new Set() }
      pair.occurrences++; group.totalSegments++
      if (result.accepted) group.acceptedSegments++
      else { pair.rejectedOccurrences++; pair.reasons.add(result.reason) }
      group.pairs.set(key, pair)
    }
  }
  return [...groups.values()].map(({ pairs, routes: ids, ...group }) => ({
    ...group, routes: [...ids].sort(), coverage: group.acceptedSegments / group.totalSegments,
    directedPairs: pairs.size, acceptedDirectedPairs: [...pairs.values()].filter(pair => !pair.rejectedOccurrences).length,
    issues: [...pairs.values()].filter(pair => pair.rejectedOccurrences).map(pair => ({ ...pair, reasons: [...pair.reasons] })),
  })).sort((a, b) => a.id.localeCompare(b.id))
}

async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}
const gzipBytes = value => gzipSync(JSON.stringify(value)).length

export function validateVaudArtifacts(manifest, chunks, morning) {
  assert.equal(chunks.length, 12, 'Vaud requires twelve two-hour chunks')
  const seen = new Map()
  const validateTrains = (snapshot, trains) => {
    const validStop = index => Number.isInteger(index) && index >= 0 && index < snapshot.stops.length
    const validPath = index => index === null || Number.isInteger(index) && index >= 0 && index < snapshot.paths.length
    assert(snapshot.paths.every(path => path.length >= 2 && path.every(point => point.length === 2 && point.every(Number.isFinite))))
    assert(snapshot.edges.every(([a, b]) => validStop(a) && validStop(b)))
    assert.equal(snapshot.edgePaths.length, snapshot.edges.length)
    assert(snapshot.edgePaths.every(validPath))
    for (const train of trains) {
      assert(train.stops.length >= 2 && train.stops.every(([i, a, d]) => validStop(i) && Number.isFinite(a) && Number.isFinite(d) && a <= d))
      if (train.pathSegments) assert(train.pathSegments.length === train.stops.length - 1 && train.pathSegments.every(validPath), 'Invalid Vaud train path references')
    }
  }
  for (const [i, { descriptor, payload }] of chunks.entries()) {
    assert.deepEqual(descriptor, manifest.chunks[i])
    assert.equal(descriptor.windowStart, i * 7200); assert.equal(descriptor.windowEnd, (i + 1) * 7200)
    const bytes = Buffer.from(JSON.stringify(payload))
    assert.equal(bytes.length, descriptor.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), descriptor.sha256)
    assert.equal(payload.windowStart, descriptor.windowStart); assert.equal(payload.windowEnd, descriptor.windowEnd)
    assert.equal(payload.trains.length, descriptor.tripCount)
    validateTrains(manifest, payload.trains)
    const ids = new Set()
    for (const train of payload.trains) {
      assert(!ids.has(train.id), 'Duplicate trip inside chunk'); ids.add(train.id)
      const signature = JSON.stringify(train)
      if (seen.has(train.id)) assert.equal(signature, seen.get(train.id), 'Changed trip across chunks')
      seen.set(train.id, signature)
    }
  }
  assert.equal(seen.size, manifest.tripCount)
  validateTrains(morning, morning.trains)
}

export async function auditVaudStudy({ archive, railPath, date, output, snapshotPath, busCachePaths = VAUD_BUS_CACHES, prepareBusFeed = false }) {
  serviceDate(date)
  await mkdir(output, { recursive: true })
  const actualOutput = await realpath(output), publicPath = await realpath('public')
  assert(actualOutput !== publicPath && !actualOutput.startsWith(publicPath + '/'), 'Vaud audit candidates must remain outside public/')
  const rawPath = snapshotPath ?? join(output, 'raw.json')
  if (!snapshotPath) {
    const run = spawnSync(process.execPath, ['scripts/ingest-gtfs.mjs', '--archive', archive, '--date', date, '--civil-day', '--modes', 'all', '--bounds', VAUD_BOUNDS, '--window-start', '00:00', '--window-end', '24:00', '--hub-output', 'none', '--output', rawPath], { stdio: 'inherit' })
    assert.equal(run.status, 0, 'Vaud extraction failed')
  }
  const raw = JSON.parse(await readFile(rawPath, 'utf8'))
  assert.equal(raw.metadata.serviceDate, date)
  assert.equal(raw.metadata.dayModel, 'civil day with preceding service-day spillover')
  assert.deepEqual(raw.metadata.sourceServiceDates, [previousServiceDate(date), date])
  assert.deepEqual(new Set(raw.metadata.modes), new Set(['rail', 'tram', 'metro', 'bus', 'ferry', 'cableway', 'funicular']))
  assert.equal(raw.metadata.windowStart, 0); assert.equal(raw.metadata.windowEnd, 86400)
  assert(!raw.metadata.localAgencyIds && !raw.metadata.localRouteIds, 'Discovery must include all operators')
  const feed = []
  for await (const row of rowsFromArchive(archive, 'feed_info.txt')) feed.push(row)
  assert.equal(feed.length, 1); assert.equal(raw.metadata.feedVersion, feed[0].feed_version)
  const sourceStops = new Map()
  for await (const row of rowsFromArchive(archive, 'stops.txt')) sourceStops.set(row.stop_id, row)
  for (const stop of raw.stops) {
    const source = sourceStops.get(stop[4])
    assert(source, `Unknown source platform ${stop[4]}`)
    assert.deepEqual(stop.slice(0, 3), [Number(source.stop_lon), Number(source.stop_lat), source.stop_name], `Altered source platform ${stop[4]}`)
  }
  const routes = new Map(), agencies = new Map(), trips = new Map()
  for await (const row of rowsFromArchive(archive, 'agency.txt')) agencies.set(row.agency_id, row.agency_name)
  for await (const row of rowsFromArchive(archive, 'routes.txt')) routes.set(row.route_id, { agencyId: row.agency_id, name: row.route_short_name, mode: transportModeForRouteType(row.route_type), type: Number(row.route_type) })
  const wanted = new Set(raw.trains.map(train => train.sourceTripId ?? train.frequency?.sourceTripId ?? train.id))
  for await (const row of rowsFromArchive(archive, 'trips.txt')) if (wanted.has(row.trip_id)) trips.set(row.trip_id, { routeId: row.route_id, calls: [] })
  console.log('Auditing Vaud source platform chains and boundary clipping…')
  for await (const row of rowsFromArchive(archive, 'stop_times.txt')) {
    const trip = trips.get(row.trip_id)
    if (trip) trip.calls.push([Number(row.stop_sequence), row.stop_id])
  }
  for (const trip of trips.values()) trip.calls.sort((a, b) => a[0] - b[0])
  const [west, south, east, north] = VAUD_BOUNDS.split(',').map(Number)
  assert(raw.stops.every(([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north), 'Snapshot extends beyond the Vaud envelope')
  const inventory = new Map(), boundaries = new Map(), selected = []
  for (const train of raw.trains) {
    const source = trips.get(train.sourceTripId ?? train.frequency?.sourceTripId ?? train.id)
    assert(source, `Missing source trip ${train.id}`)
    if (train.routeId) assert.equal(train.routeId, source.routeId)
    const route = routes.get(source.routeId), admission = vaudAdmission(route)
    const key = source.routeId
    const item = inventory.get(key) ?? { routeId: key, route: route.name, agencyId: route.agencyId, agency: agencies.get(route.agencyId), mode: route.mode, admission, trips: 0 }
    item.trips++; inventory.set(key, item)
    if (admission !== 'candidate') continue
    const boundary = auditVaudBoundary(source.calls.map(call => call[1]), train.stops.map(([index]) => raw.stops[index][4]))
    const summary = boundaries.get(key) ?? { routeId: key, route: route.name, agencyId: route.agencyId, trips: 0, clippedStart: 0, clippedEnd: 0, interiorGapTrips: 0 }
    summary.trips++; summary.clippedStart += Number(boundary.clippedStart); summary.clippedEnd += Number(boundary.clippedEnd); summary.interiorGapTrips += Number(boundary.interiorGaps.length > 0)
    boundaries.set(key, summary)
    // Exclude the entire journey until contiguous pieces have their own identity.
    if (!boundary.interiorGaps.length) selected.push({ ...train, routeId: key })
  }
  assert(selected.length, 'No Vaud candidate trips')
  assert.equal(new Set(selected.map(train => train.id)).size, selected.length, 'Duplicate Vaud trip')
  const snapshot = compactBaselSnapshot({ ...raw, trains: selected })
  const rail = parseRailNetworkXtf(await readFile(railPath, 'utf8'), 10)
  const projected = train => ['151', '55', '29'].includes(routes.get(train.routeId).agencyId) && train.category !== 'bus'
  const results = [
    applyLausanneRailGeometry({ ...snapshot, trains: snapshot.trains.filter(projected) }, rail, routes),
    applyRailGeometry({ ...snapshot, trains: snapshot.trains.filter(train => routes.get(train.routeId).mode === 'rail' && !projected(train)) }, rail),
  ]
  let buses = snapshot.trains.filter(train => train.category === 'bus')
  const cacheSources = []
  for (const path of busCachePaths) {
    const cache = JSON.parse(await readFile(path, 'utf8'))
    assert.equal(cache.metadata.license, 'ODbL-1.0')
    const result = applyRoadCache(snapshot, buses, cache)
    // First usable exact pattern wins, including its explicitly rejected segments.
    // Missing or wholly rejected patterns can try the next cache.
    const matched = result.trains.filter(train => train.pathSegments.some(index => index !== null))
    results.push({ ...result, trains: matched })
    const ids = new Set(matched.map(train => train.id)); buses = buses.filter(train => !ids.has(train.id))
    cacheSources.push({ sha256: await hashFile(path), metadata: cache.metadata })
  }
  snapshot.paths = []
  const updated = new Map()
  for (const result of results) {
    const offset = snapshot.paths.length
    snapshot.paths.push(...result.paths)
    for (const train of result.trains) updated.set(train.id, { ...train, pathSegments: train.pathSegments?.map(index => index == null ? null : index + offset) })
  }
  snapshot.trains = snapshot.trains.map(train => updated.get(train.id) ?? { ...train, pathSegments: train.stops.slice(1).map(() => null) })
  // Candidate topology is unshaped; only journey-specific geometry is audited.
  snapshot.edgePaths = snapshot.edges.map(() => null)
  const sourceHashes = { archive: await hashFile(archive), rail: await hashFile(railPath), snapshot: await hashFile(rawPath) }
  snapshot.metadata = { ...snapshot.metadata, modes: ['rail', 'metro', 'bus'], sourceHashes, studyScope: 'Vaud expansion audit: selected operators inside a rectangular envelope, including neighbouring cantons. Not complete Vaud or Mobilis coverage.', note: 'AUDIT ONLY. Scheduled and representative headway movements. FOT rail geometry and inferred OSM bus paths; unmatched paths remain interpolation. Boundary-clipped termini; interior-gap journeys excluded. Not publication-ready.', geometry: { publisher: 'OpenStreetMap contributors', license: 'ODbL-1.0', sourceUrl: 'https://www.openstreetmap.org/copyright', model: 'Inferred bus paths; not operator-verified', caches: cacheSources } }
  const headwayTrips = snapshot.trains.filter(train => train.frequency?.exactTimes === 0).length
  const exactFrequencyTrips = snapshot.trains.filter(train => train.frequency?.exactTimes === 1).length
  delete snapshot.metadata.frequency
  if (headwayTrips || exactFrequencyTrips) snapshot.metadata.frequency = { headwayTrips, exactFrequencyTrips, model: 'source interval anchored grid; exact_times distinguishes headway illustration from scheduled departures' }
  snapshot.metadata.model = headwayTrips ? 'scheduled and representative headway station-to-station interpolation' : 'scheduled station-to-station interpolation'
  const groups = summarizeVaud(snapshot, routes)
  const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'vaud-region-day-chunks')
  const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
  validateVaudArtifacts(manifest, chunks, morning)
  const payload = { manifestGzipBytes: gzipBytes(manifest), morningGzipBytes: gzipBytes(morning), chunks: chunks.map(({ descriptor, payload: chunk }) => ({ id: descriptor.id, gzipBytes: gzipBytes(chunk) })) }
  const failures = lausanneTechnicalGate(groups, payload)
  const report = { schemaVersion: 1, metadata: { serviceDate: date, feedVersion: feed[0].feed_version, sourceHashes, nodeVersion: process.version }, scope: { bounds: VAUD_BOUNDS, description: snapshot.metadata.studyScope, extractedTrips: raw.trains.length, candidateTrips: snapshot.trains.length, platforms: snapshot.stops.length, namedStops: new Set(snapshot.stops.map(stop => stop[2])).size, interiorGapTripsExcluded: [...boundaries.values()].reduce((sum, item) => sum + item.interiorGapTrips, 0) }, inventory: [...inventory.values()].sort((a, b) => a.routeId.localeCompare(b.routeId)), boundaries: [...boundaries.values()].sort((a, b) => a.routeId.localeCompare(b.routeId)), groups, payload, busSources: cacheSources, gate: { passed: !failures.length, failures, publicationReady: false, pending: ['Review operator admission and a canton/Mobilis boundary; audit all clipped termini', 'Resolve geometry by operator and unique directed pair, including TPC/MOB/MVR mountain corridors', 'Audit lake, funicular and cable services independently before admission', 'Inspect inferred paths, then integrate selection, framing, translations, refresh/recovery and phone validation'] } }
  for (const { descriptor, payload: chunk } of chunks) { const path = join(output, descriptor.path); await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(chunk)) }
  await writeFile(join(output, 'vaud-region-day-manifest.json'), JSON.stringify(manifest))
  await writeFile(join(output, 'vaud-region-morning.json'), JSON.stringify(morning))
  await writeFile(join(output, 'vaud-audit.json'), JSON.stringify(report, null, 2) + '\n')
  if (prepareBusFeed) {
    for (const agencyId of new Set(snapshot.trains.filter(train => train.category === 'bus').map(train => routes.get(train.routeId).agencyId))) {
      const trains = snapshot.trains.filter(train => train.category === 'bus' && routes.get(train.routeId).agencyId === agencyId)
      // Negative overnight times are not valid matcher input. Route geometry is
      // time-independent, so shift each pattern to a nonnegative working day.
      const shifted = trains.map(train => { const shift = train.stops[0][1] < 0 ? 86400 : 0; return { ...train, stops: train.stops.map(([i, a, d]) => [i, a + shift, d + shift]) } })
      await prepareRoadFeed({ manifest: snapshot, trains: shifted, output: join(output, 'bus-feeds', agencyId), agency: { id: agencyId, name: agencies.get(agencyId), url: 'https://opentransportdata.swiss', language: 'fr' } })
    }
  }
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined
  if (process.argv.includes('--help')) console.log('Vaud audit: --archive GTFS.zip --rail FOT.xtf --date YYYY-MM-DD --output-directory DIR [--snapshot RAW.json] [--bus-caches CACHE.json,CACHE.json] [--prepare-bus-feed] [--check]')
  else {
    for (const name of ['archive', 'rail', 'date', 'output-directory']) assert(arg(name), `Missing --${name}`)
    const report = await auditVaudStudy({ archive: arg('archive'), railPath: arg('rail'), date: arg('date'), output: resolve(arg('output-directory')), snapshotPath: arg('snapshot'), busCachePaths: arg('bus-caches')?.split(','), prepareBusFeed: process.argv.includes('--prepare-bus-feed') })
    console.log(JSON.stringify({ scope: report.scope, groups: report.groups.map(({ issues: _issues, routes: _routes, ...group }) => group), payload: report.payload, gate: report.gate }, null, 2))
    if (process.argv.includes('--check') && !report.gate.passed) process.exitCode = 1
  }
}
