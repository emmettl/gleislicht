import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { rowsFromArchive, parseGtfsTime } from '@motionstudies/data/gtfs'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { applyRailGeometry, parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { applyLausanneRailGeometry } from './lausanne-rail-geometry.mjs'
import { applyRoadCache, distanceMetres } from './enrich-postbus-roads.mjs'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
import { serviceDate } from './service-date.mjs'
import { assertCompleteMbcCalls, combineRoadCaches, LAUSANNE_WEST_GROUPS, MBC_BUS_CACHES, mergeLausanneMbc } from './lausanne-mbc.mjs'

import { readMbcGeometrySource, osmSegments } from './mbc-supplement-geometry.mjs'

export const LAUSANNE_BOUNDS = '6.45,46.48,6.85,46.71'
export const LAUSANNE_AGENCY = { id: '151', name: 'Transports publics de la région lausannoise', url: 'https://www.t-l.ch', language: 'fr' }
const RAIL = new Set(['international', 'intercity', 'interregio', 'regional-express', 's-bahn', 'regional', 'other'])
const GZIP_LIMITS = { manifest: 650 * 1024, chunk: 450 * 1024, morning: 1600 * 1024 }
const gzipBytes = value => gzipSync(JSON.stringify(value)).length
async function fileHash(path) {
  const digest = createHash('sha256')
  for await (const bytes of createReadStream(path)) digest.update(bytes)
  return digest.digest('hex')
}

export function lausanneGroup(train, routes, includeMbc = false) {
  const route = routes.get(train.routeId)
  assert(route, `Unknown source route ${train.routeId}`)
  if (includeMbc && train.category === 'funicular' && route.agencyId === '344') return 'cossonay-funicular'
  if (train.category === 'bus' && route.agencyId === '151') return 'tl-bus'
  if (includeMbc && train.category === 'bus' && route.agencyId === '764') return 'mbc-bus'
  if (train.category === 'metro' && route.agencyId === '151' && ['m1', 'm2'].includes(train.route)) return train.route
  if (RAIL.has(train.category)) return route.agencyId === '55' ? 'leb' : includeMbc && route.agencyId === '29' ? 'mbc-rail' : 'rail'
  return undefined
}

// Remove out-of-scope modes and their unused topology; retain each selected
// journey's ordered platforms and times. Scope is a rectangle, not all Vaud.
export function selectLausanneSnapshot(snapshot, routes, includeMbc = false) {
  const selected = snapshot.trains.filter(train => lausanneGroup(train, routes, includeMbc))
  assert(selected.length, 'No Lausanne services in the requested day')
  const used = [...new Set(selected.flatMap(train => train.stops.map(([index]) => index)))].sort((a, b) => a - b)
  const remap = new Map(used.map((index, next) => [index, next]))
  const stops = used.map(index => snapshot.stops[index])
  const trains = selected.map(({ pathSegments: _paths, ...train }) => ({ ...train, stops: train.stops.map(([index, ...times]) => [remap.get(index), ...times]) })).sort((a, b) => a.id.localeCompare(b.id))
  assert.equal(new Set(trains.map(train => train.id)).size, trains.length, 'Duplicate source trip')
  const pairs = new Set(trains.flatMap(train => train.stops.slice(1).map(([to], index) => [train.stops[index][0], to].sort((a, b) => a - b).join(':'))))
  const edges = [...pairs].sort().map(pair => pair.split(':').map(Number))
  return { metadata: { ...snapshot.metadata, modes: includeMbc ? ['rail', 'metro', 'bus', 'funicular'] : ['rail', 'metro', 'bus'], studyScope: includeMbc ? 'Lausanne regional crop plus complete MBC rail and bus journeys through Morges, Bière and Cossonay. Includes the Cossonay funicular; lake services excluded; not canton-wide Vaud coverage.' : 'Lausanne region: tl buses, m1/m2, LEB and rail inside the study bounds; excludes lake services and funiculars. Not canton-wide Vaud coverage.' }, bounds: {
    minLongitude: Math.min(...stops.map(stop => stop[0])), maxLongitude: Math.max(...stops.map(stop => stop[0])),
    minLatitude: Math.min(...stops.map(stop => stop[1])), maxLatitude: Math.max(...stops.map(stop => stop[1])),
  }, stops, edges, trains }
}

// FOT paths are undirected. An index alone is insufficient evidence: snapping
// two métro stops to one rail node can collapse a real passenger movement.
export function assessLausannePath(path, from, to) {
  if (!path || path.length < 2) return { accepted: false, reason: 'missing-path' }
  assert(path.every(point => point.length === 2 && point.every(Number.isFinite)), 'Invalid path coordinates')
  const gap = Math.min(
    Math.max(distanceMetres(path[0], from), distanceMetres(path.at(-1), to)),
    Math.max(distanceMetres(path.at(-1), from), distanceMetres(path[0], to)),
  )
  return { accepted: gap <= 120, reason: gap <= 120 ? undefined : 'endpoint-gap', endpointGapMetres: Math.round(gap * 10) / 10 }
}

export function summarizeLausanneGeometry(snapshot, routes, includeMbc = false) {
  const groups = new Map((includeMbc ? LAUSANNE_WEST_GROUPS : ['tl-bus', 'm1', 'm2', 'leb', 'rail']).map(id => [id, { id, trips: 0, routes: new Set(), totalSegments: 0, indexedSegments: 0, acceptedSegments: 0, issues: new Map() }]))
  for (const train of snapshot.trains) {
    const group = groups.get(lausanneGroup(train, routes, includeMbc))
    assert(group, 'Unexpected mode in candidate')
    group.trips++
    group.routes.add(train.routeId)
    for (let i = 1; i < train.stops.length; i++) {
      group.totalSegments++
      const index = train.pathSegments?.[i - 1]
      if (index !== null && index !== undefined) {
        assert(Number.isInteger(index) && index >= 0 && snapshot.paths[index], 'Invalid path reference')
        group.indexedSegments++
      }
      const from = snapshot.stops[train.stops[i - 1][0]], to = snapshot.stops[train.stops[i][0]]
      const result = assessLausannePath(snapshot.paths[index], from, to)
      if (result.accepted) group.acceptedSegments++
      else {
        const key = `${train.routeId}:${from[4]}:${to[4]}:${result.reason}`
        const issue = group.issues.get(key) ?? { routeId: train.routeId, route: train.route, from: from[2], to: to[2], fromId: from[4], toId: to[4], ...result, occurrences: 0 }
        issue.occurrences++
        group.issues.set(key, issue)
      }
    }
  }
  return [...groups.values()].map(group => ({ ...group, routes: [...group.routes].sort(), issues: [...group.issues.values()], coverage: group.totalSegments ? group.acceptedSegments / group.totalSegments : 0 }))
}

export function lausanneTechnicalGate(groups, payload) {
  return [
    ...groups.filter(group => !group.trips || group.coverage < 0.95).map(group => `${group.id}: ${(group.coverage * 100).toFixed(2)}% geometry; requires services and at least 95% geometry with endpoints within 120 m`),
    ...(payload.manifestGzipBytes > GZIP_LIMITS.manifest ? ['Manifest exceeds existing regional budget'] : []),
    ...(payload.morningGzipBytes > GZIP_LIMITS.morning ? ['Morning exceeds existing regional budget'] : []),
    ...payload.chunks.filter(chunk => chunk.gzipBytes > GZIP_LIMITS.chunk).map(chunk => `${chunk.id} exceeds existing regional chunk budget`),
  ]
}

export async function auditLausanneStudy({ archive, railPath, date, output, busCachePath, busCachePaths = [], snapshotPath, prepareBusFeed = false, includeMbc = false, mbcSnapshotPath, mbcBusCachePaths = MBC_BUS_CACHES }) {
  serviceDate(date)
  const workspace = await mkdtemp(join(tmpdir(), 'gleislicht-lausanne-'))
  try {
    const rawPath = snapshotPath ?? join(workspace, 'raw.json')
    if (!snapshotPath) {
      const run = spawnSync(process.execPath, ['scripts/ingest-gtfs.mjs', '--archive', archive, '--date', date, '--civil-day', '--modes', 'all', '--bounds', LAUSANNE_BOUNDS, '--local-agencies', '151', '--window-start', '00:00', '--window-end', '24:00', '--hub-output', 'none', '--output', rawPath], { stdio: 'inherit' })
      assert.equal(run.status, 0, 'Lausanne timetable extraction failed')
    }
    let raw = JSON.parse(await readFile(rawPath, 'utf8'))
    const feed = []
    for await (const row of rowsFromArchive(archive, 'feed_info.txt')) feed.push(row)
    assert.equal(raw.metadata.feedVersion, feed[0]?.feed_version, 'Archive and snapshot feed versions differ')
    assert.equal(raw.metadata.serviceDate, date, 'Snapshot has the wrong service day')
    assert.equal(raw.metadata.windowStart, 0)
    assert.equal(raw.metadata.windowEnd, 86400)
    assert.deepEqual(raw.metadata.localAgencyIds, ['151'])
    const [west, south, east, north] = LAUSANNE_BOUNDS.split(',').map(Number)
    assert(raw.stops.every(([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north), 'Snapshot extends outside the audited Lausanne bounds')
    const routes = new Map()
    for await (const row of rowsFromArchive(archive, 'routes.txt')) routes.set(row.route_id, { agencyId: row.agency_id, name: row.route_short_name, type: Number(row.route_type) })
    const mbcPath = mbcSnapshotPath ?? join(workspace, 'mbc.json')
    if (includeMbc && !mbcSnapshotPath) {
      const run = spawnSync(process.execPath, ['scripts/ingest-gtfs.mjs', '--archive', archive, '--date', date, '--civil-day', '--modes', 'rail,bus,funicular', '--agencies', '29,764,344', '--bounds', '-180,-90,180,90', '--window-start', '00:00', '--window-end', '24:00', '--hub-output', 'none', '--output', mbcPath], { stdio: 'inherit' })
      assert.equal(run.status, 0, 'MBC timetable extraction failed')
    }
    const mbc = includeMbc ? JSON.parse(await readFile(mbcPath, 'utf8')) : undefined
    // The compact runtime importer keeps routeId only for buses. Restore rail
    // and métro identity from source trip IDs, never displayed line numbers.
    const sourceIds = new Set([...raw.trains, ...(mbc?.trains ?? [])].map(train => train.sourceTripId ?? train.frequency?.sourceTripId ?? train.id))
    const tripRoutes = new Map()
    for await (const row of rowsFromArchive(archive, 'trips.txt')) if (sourceIds.has(row.trip_id)) tripRoutes.set(row.trip_id, row.route_id)
    const restoreRoute = train => {
      const routeId = tripRoutes.get(train.sourceTripId ?? train.frequency?.sourceTripId ?? train.id)
      assert(routeId, `Trip absent from source archive: ${train.id}`)
      if (train.routeId) assert.equal(train.routeId, routeId, 'Snapshot and source route IDs differ')
      return { ...train, routeId }
    }
    raw.trains = raw.trains.map(restoreRoute)
    if (mbc) {
      mbc.trains = mbc.trains.map(restoreRoute)
      const calls = new Map(mbc.trains.map(train => [train.sourceTripId, []]))
      assert(!calls.has(undefined), 'MBC requires civil-day source identities')
      for await (const row of rowsFromArchive(archive, 'stop_times.txt')) if (calls.has(row.trip_id)) calls.get(row.trip_id).push({ id: row.stop_id, sequence: Number(row.stop_sequence), arrival: parseGtfsTime(row.arrival_time || row.departure_time), departure: parseGtfsTime(row.departure_time || row.arrival_time) })
      for (const list of calls.values()) list.sort((a, b) => a.sequence - b.sequence)
      for (const train of mbc.trains) assertCompleteMbcCalls(train, mbc.stops, calls.get(train.sourceTripId), date)
      raw = mergeLausanneMbc(raw, mbc, routes)
    }
    const snapshot = selectLausanneSnapshot(raw, routes, includeMbc)
    const rail = parseRailNetworkXtf(await readFile(railPath, 'utf8'), 10)
    const railTrains = snapshot.trains.filter(train => train.category !== 'bus' && train.category !== 'funicular')
    const railGeometry = applyLausanneRailGeometry({ ...snapshot, trains: railTrains }, rail, routes)
    const baselineRail = applyRailGeometry({ ...snapshot, trains: railTrains }, rail)
    const baselineRailGroups = summarizeLausanneGeometry({ ...snapshot, ...baselineRail }, routes, includeMbc).filter(group => !group.id.endsWith('-bus'))
    const busTrains = snapshot.trains.filter(train => train.category === 'bus')
    const cachePaths = [...(busCachePath ? [busCachePath] : []), ...busCachePaths, ...(includeMbc ? mbcBusCachePaths : [])]
    const caches = await Promise.all(cachePaths.map(async path => JSON.parse(await readFile(path, 'utf8'))))
    const cache = caches.length > 1 ? combineRoadCaches(caches) : caches[0]
    if (cache) {
      assert.equal(cache.metadata.license, 'ODbL-1.0')
      if (caches.length === 1) assert.match(cache.metadata.sourceSha256, /^[a-f0-9]{64}$/)
    }
    const busGeometry = cache ? applyRoadCache(snapshot, busTrains, cache) : { paths: [], edgePaths: snapshot.edges.map(() => null), trains: busTrains }
    const mbcSource = includeMbc ? await readMbcGeometrySource() : undefined
    const funicularTrains = snapshot.trains.filter(train => train.category === 'funicular')
    const funicularGeometry = includeMbc ? applyLausanneRailGeometry({ ...snapshot, trains: funicularTrains }, rail, routes, { rail: osmSegments(mbcSource.source).filter(s => s.tags.railway === 'funicular') }) : { paths: [], trains: [], edgePaths: snapshot.edges.map(() => null) }
    assert(!includeMbc || funicularGeometry.matchedSegments === funicularGeometry.totalSegments, 'Incomplete Cossonay track geometry')
    const offset = railGeometry.paths.length
    const updated = new Map([...railGeometry.trains, ...funicularGeometry.trains.map(train => ({ ...train, pathSegments: train.pathSegments.map(index => index === null ? null : index + offset + busGeometry.paths.length) })), ...busGeometry.trains.map(train => ({ ...train, pathSegments: train.pathSegments?.map(index => index === null ? null : index + offset) }))].map(train => [train.id, train]))
    snapshot.paths = [...railGeometry.paths, ...busGeometry.paths, ...funicularGeometry.paths]
    snapshot.trains = snapshot.trains.map(train => updated.get(train.id))
    // Only rail-used edges may receive FOT geometry; never map a bus-only edge
    // onto a nearby railway through the generic topology fallback.
    const railPairs = new Set(railTrains.flatMap(train => train.stops.slice(1).map(([to], index) => [train.stops[index][0], to].sort((a, b) => a - b).join(':'))))
    snapshot.edgePaths = snapshot.edges.map(([a, b], i) => funicularGeometry.edgePaths[i] !== null ? funicularGeometry.edgePaths[i] + offset + busGeometry.paths.length : busGeometry.edgePaths[i] !== null ? busGeometry.edgePaths[i] + offset : railPairs.has(`${a}:${b}`) ? railGeometry.edgePaths[i] : null)
    snapshot.metadata.note = 'AUDIT CANDIDATE. Scheduled motion; frequency-based services are representative. Rail and métro stops project onto their matched FOT corridors with short platform connectors. Bus paths are OSM/pfaedle inferences, not operator-verified routes. Unmatched segments retain stop interpolation. Not approved for publication.'
    const sourceHashes = { archive: await fileHash(archive), rail: await fileHash(railPath), snapshot: await fileHash(rawPath), ...(busCachePath ? { busCache: await fileHash(busCachePath) } : {}), ...Object.fromEntries(await Promise.all(busCachePaths.map(async (path, i) => [`busCacheSupplement${i}`, await fileHash(path)]))), ...(mbc ? { mbcSnapshot: await fileHash(mbcPath), ...Object.fromEntries(await Promise.all(mbcBusCachePaths.map(async (path, i) => [`mbcBusCache${i}`, await fileHash(path)]))) } : {}) }
    if (mbcSource) {
      sourceHashes.mbcSupplementGeometry = mbcSource.sha256
      snapshot.metadata.funicularGeometry = { publisher: mbcSource.source.publisher, sourceUrl: mbcSource.source.sourceUrl, license: mbcSource.source.license, sha256: mbcSource.sha256, model: 'Platform projection onto the isolated OSM Cossonay funicular track, with inferred passing-loop track selection', matchedSegments: funicularGeometry.matchedSegments, totalSegments: funicularGeometry.totalSegments, maximumSnapMetres: Math.max(...funicularGeometry.projectionAudit.snaps.map(s => s.snapMetres ?? 0)), wayIds: osmSegments(mbcSource.source).filter(s => s.tags.railway === 'funicular').map(s => s.id) }
    }
    snapshot.metadata.sourceHashes = sourceHashes
    snapshot.metadata.railGeometry = { publisher: 'Federal Office of Transport', sourceUrl: 'https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz', sha256: sourceHashes.rail, simplifyMetres: 10, model: 'platform projection onto identified FOT rail corridors; short platform connectors; inferred track selection', matchedSegments: railGeometry.matchedSegments, totalSegments: railGeometry.totalSegments, maximumSnapMetres: Math.max(0, ...railGeometry.projectionAudit.snaps.map(stop => stop.snapMetres ?? 0)), limits: railGeometry.projectionAudit.limits }
    if (cache) snapshot.metadata.geometry = { ...cache.metadata, matchedSegments: busGeometry.matched, totalSegments: busGeometry.total, missingPatterns: busGeometry.missingPatterns }
    const groups = summarizeLausanneGeometry(snapshot, routes, includeMbc)
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'lausanne-region-day-chunks')
    const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
    const payload = { manifestGzipBytes: gzipBytes(manifest), morningGzipBytes: gzipBytes(morning), chunks: chunks.map(({ descriptor, payload: chunk }) => ({ id: descriptor.id, trips: descriptor.tripCount, gzipBytes: gzipBytes(chunk) })) }
    const failures = lausanneTechnicalGate(groups, payload)
    const report = { schemaVersion: 1, metadata: { serviceDate: date, feedVersion: feed[0].feed_version, dayModel: raw.metadata.dayModel, sourceServiceDates: raw.metadata.sourceServiceDates, sourceHashes, nodeVersion: process.version }, scope: { bounds: LAUSANNE_BOUNDS, description: snapshot.metadata.studyScope, extractedTrips: raw.trains.length, candidateTrips: snapshot.trains.length, excludedTrips: raw.trains.length - snapshot.trains.length, platforms: snapshot.stops.length, namedStops: new Set(snapshot.stops.map(stop => stop[2])).size }, groups, baselineRailGroups, railProjection: railGeometry.projectionAudit, payload, gate: { passed: failures.length === 0, failures, limits: { minimumGeometryCoveragePerGroup: 0.95, maximumEndpointGapMetres: 120, gzipBytes: GZIP_LIMITS }, publicationStatus: 'Technical audit only; visual and hosted verification are recorded separately in docs/LAUSANNE-STUDY.md' } }
    if (includeMbc) {
      report.scope.baseBounds = LAUSANNE_BOUNDS
      delete report.scope.bounds
      report.scope.candidateBounds = snapshot.bounds
      report.scope.completeAgencyIds = ['29', '764', '344']
      report.metadata.lausanneScopeVersion = 3
      report.funicularProjection = funicularGeometry.projectionAudit
    }
    await mkdir(output, { recursive: true })
    for (const { descriptor, payload: chunk } of chunks) {
      const path = join(output, descriptor.path)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(chunk))
    }
    await writeFile(join(output, 'lausanne-region-day-manifest.json'), JSON.stringify(manifest))
    await writeFile(join(output, 'lausanne-region-morning.json'), JSON.stringify(morning))
    await writeFile(join(output, 'lausanne-audit.json'), JSON.stringify(report, null, 2) + '\n')
    if (prepareBusFeed) {
      const routingTimes = train => { const shift = -Math.floor(Math.min(0, ...train.stops.flatMap(stop => stop.slice(1))) / 86400) * 86400; return { ...train, stops: train.stops.map(([i, a, d]) => [i, a + shift, d + shift]) } }
      await prepareRoadFeed({ manifest: snapshot, trains: busTrains.filter(train => routes.get(train.routeId).agencyId === '151').map(routingTimes), output: join(output, 'bus-feed'), agency: LAUSANNE_AGENCY })
      if (mbc) await prepareRoadFeed({ manifest: snapshot, trains: busTrains.filter(train => routes.get(train.routeId).agencyId === '764').map(train => { const shift = -Math.floor(Math.min(0, ...train.stops.flatMap(stop => stop.slice(1))) / 86400) * 86400; return { ...train, stops: train.stops.map(([i, a, d]) => [i, a + shift, d + shift]) } }), output: join(output, 'mbc-bus-feed'), agency: { id: '764', name: 'Automobiles MBC', url: 'https://mbc.ch', language: 'fr' } })
    }
    return report
  } finally { await rm(workspace, { recursive: true, force: true }) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = name => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined
  if (process.argv.includes('--help')) console.log('Audit a Lausanne candidate outside public/data: --archive GTFS.zip --rail FOT.xtf --date YYYY-MM-DD --output-directory DIR [--bus-cache CACHE.json] [--snapshot previously-extracted.json] [--include-mbc] [--mbc-snapshot complete-MBC.json] [--prepare-bus-feed] [--check]')
  else {
    for (const name of ['archive', 'rail', 'date', 'output-directory']) assert(arg(name), `Missing --${name}`)
    const output = resolve(arg('output-directory'))
    assert(output !== resolve('public') && !output.startsWith(resolve('public') + '/'), 'Audit candidates must remain outside public/')
    const report = await auditLausanneStudy({ archive: resolve(arg('archive')), railPath: resolve(arg('rail')), date: arg('date'), output, busCachePath: arg('bus-cache'), busCachePaths: process.argv.flatMap((value, i) => value === '--bus-cache-supplement' ? [process.argv[i + 1]] : []), snapshotPath: arg('snapshot'), prepareBusFeed: process.argv.includes('--prepare-bus-feed'), includeMbc: process.argv.includes('--include-mbc'), mbcSnapshotPath: arg('mbc-snapshot') })
    console.log(JSON.stringify({ scope: report.scope, groups: report.groups.map(({ issues: _issues, routes, ...group }) => ({ ...group, routes: routes.length })), payload: report.payload, gate: report.gate }, null, 2))
    if (process.argv.includes('--check') && !report.gate.passed) process.exitCode = 1
  }
}
