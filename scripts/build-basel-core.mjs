import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { readBaselCoreTimetables } from './basel-core-timetable.mjs'
import { baselGraphs, applyBaselGeometry, BASEL_AGENCIES } from './basel-line-geometry.mjs'
import { baselTram19Graph } from './basel-rail-geometry.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { baselTramDiversions, BASEL_DIVERSION_LIMITS } from './basel-tram-diversions.mjs'
import { applyBaselRoadFallback } from './basel-road-geometry.mjs'
import { coreInfrastructure, coreGeometryMatcher, coreEdgePaths, BASEL_CORE_RAIL_LIMITS } from './basel-core-geometry.mjs'
import { validateBaselDownload } from './download-basel-sources.mjs'
import { baselGate } from './audit-basel-study.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { applyReviewedBaselGeometry } from './basel-reviewed-geometry.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const gzipBytes = value => gzipSync(JSON.stringify(value)).length
const json = async path => JSON.parse(await readFile(path, 'utf8'))

export function reviewedCoreRoadCache(snapshot, routes, bundle, policy) {
  assert(policy.serviceDates.includes(snapshot.metadata.serviceDate), 'Unreviewed road-cache date')
  const reviewed = structuredClone(bundle), seen = new Set()
  for (const train of snapshot.trains) {
    if (train.category !== 'bus') continue
    const agencyId = routes.get(train.routeId).agencyId, pattern = roadPatternId(train, snapshot.stops)
    const cache = reviewed.agencyCaches[agencyId]
    if (!cache?.patterns[pattern] || seen.has(`${agencyId}:${pattern}`)) continue
    seen.add(`${agencyId}:${pattern}`)
    train.stops.slice(1).forEach(([to], i) => {
      const a = snapshot.stops[train.stops[i][0]], b = snapshot.stops[to]
      const exclusion = policy.roadExclusions.find(rule => rule.agencyId === agencyId && rule.line === train.route && rule.fromId === a[4] && rule.toId === b[4])
      if (!exclusion || cache.patterns[pattern][i] === null) return
      cache.patterns[pattern][i] = null
      cache.report.issues.push({ pattern, segment: i, routeId: train.routeId, reason: exclusion.reason, sourceUrl: exclusion.sourceUrl })
    })
  }
  for (const cache of Object.values(reviewed.agencyCaches)) cache.metadata.coreReview = { serviceDate: snapshot.metadata.serviceDate, exclusions: policy.roadExclusions,
    note: 'Raw matcher report coverage precedes these explicit exclusions; final application counts are measured separately.' }
  return reviewed
}

export function coreCoverage(snapshot, routes) {
  const groups = new Map(), lines = new Map()
  for (const train of snapshot.trains) {
    const route = routes.get(train.routeId)
    const group = route.mode === 'rail' ? 'regional-rail' : `${BASEL_AGENCIES[route.agencyId]}-${route.mode}`
    for (const [map, key] of [[groups, group], [lines, train.routeId]]) {
      const entry = map.get(key) ?? { id: key, agencyId: route.agencyId, mode: route.mode, line: route.name, trips: 0, matched: 0, total: 0, carryInTrips: 0 }
      entry.trips++; entry.matched += train.pathSegments.filter(index => index !== null).length
      entry.total += train.pathSegments.length; entry.carryInTrips += Number(train.sourceServiceDate !== snapshot.metadata.serviceDate)
      map.set(key, entry)
    }
  }
  const finish = map => [...map.values()].map(entry => ({ ...entry, coverage: entry.matched / entry.total })).sort((a, b) => a.id.localeCompare(b.id))
  return { groups: finish(groups).map(({ agencyId: _agencyId, line: _line, ...group }) => group), routes: finish(lines) }
}

export function enrichBaselCore(raw, routes, { collections, graphs, infrastructure, busCache, supplementalBusCache, diversionPolicy, policy }) {
  assert(raw.metadata.sourceServiceDates.every(date => policy.geometryServiceDates.includes(date)), 'Unreviewed carry-in geometry date')
  const local = { ...raw, trains: raw.trains.filter(train => routes.get(train.routeId).mode !== 'rail') }
  const diversions = baselTramDiversions(collections, { ...diversionPolicy, serviceDates: policy.geometryServiceDates }, raw.metadata.serviceDate)
  const official = applyBaselGeometry(local, routes, graphs, diversions)
  const initialRoads = applyBaselRoadFallback(local, official, routes, busCache)
  const roads = supplementalBusCache ? applyBaselRoadFallback(local, initialRoads, routes, reviewedCoreRoadCache(local, routes, supplementalBusCache, policy)) : initialRoads
  const paths = [...roads.paths], updated = new Map(roads.trains.map(train => [train.id, train]))
  const pathIndices = new Map(paths.map((path, i) => [JSON.stringify(path), i]))
  const railTrains = raw.trains.filter(train => routes.get(train.routeId).mode === 'rail')
  const railMatch = coreGeometryMatcher(infrastructure.rail, raw.stops, [...new Set(railTrains.flatMap(train => train.stops.map(([i]) => i)))], BASEL_CORE_RAIL_LIMITS)
  const tramTrains = roads.trains.filter(train => train.category === 'tram')
  const tramMatch = coreGeometryMatcher(infrastructure.tram, raw.stops, [...new Set(tramTrains.flatMap(train => train.stops.map(([i]) => i)))], BASEL_DIVERSION_LIMITS)
  const decisions = new Map()
  for (const train of [...railTrains, ...tramTrains]) {
    const rail = routes.get(train.routeId).mode === 'rail'
    const pathSegments = train.stops.slice(1).map(([to], i) => {
      if (!rail && train.pathSegments[i] !== null) return train.pathSegments[i]
      const from = train.stops[i][0]
      const rule = rail ? undefined : diversions.match(routes.get(train.routeId), train, raw.stops[from], raw.stops[to])?.diversionRule
      if (!rail && !rule) return null
      const result = (rail ? railMatch : tramMatch)(from, to)
      const key = JSON.stringify([train.routeId, from, to])
      const decision = decisions.get(key) ?? { routeId: train.routeId, line: train.route, mode: rail ? 'rail' : 'tram', fromId: raw.stops[from][4], toId: raw.stops[to][4], from: raw.stops[from][2], to: raw.stops[to][2],
        ...result, points: undefined, accepted: result.points !== null, occurrences: 0, ...(rule ? { diversionRule: rule } : {}) }
      decision.occurrences++; decisions.set(key, decision)
      if (!result.points) return null
      const signature = JSON.stringify(result.points)
      if (!pathIndices.has(signature)) { pathIndices.set(signature, paths.length); paths.push(result.points) }
      return pathIndices.get(signature)
    })
    updated.set(train.id, { ...train, pathSegments })
  }
  const snapshot = { ...raw, paths, trains: raw.trains.map(train => updated.get(train.id)) }
  snapshot.edgePaths = coreEdgePaths(snapshot)
  return { snapshot, decisions: [...decisions.values()], roads, initialRoads, official }
}

export async function buildBaselCore({ archive, sourceDirectory, railPath, busCachePath, supplementalBusCachePath, diversionPolicyPath, policyPath, dates, output, reviewedGeometryPath = 'data/basel-reviewed-geometry.json' }) {
  output = resolve(output)
  assert(output !== resolve('public') && !output.startsWith(`${resolve('public')}/`), 'Basel core candidates must remain outside public/')
  const policy = await json(policyPath), catalogue = await json(join(sourceDirectory, 'sources.json'))
  assert.deepEqual(catalogue.sources.map(source => source.layer).sort(), ['LN_Buslinie', 'LN_Tramlinie'])
  const collections = []
  for (const source of catalogue.sources) {
    const bytes = await readFile(join(sourceDirectory, `${source.layer}.geojson`))
    assert.equal(sha(bytes), source.sha256, 'Changed Basel line source')
    const collection = JSON.parse(bytes); validateBaselDownload(collection, source.features); collections.push(collection)
  }
  const network = parseRailNetworkXtf(await readFile(railPath, 'utf8'), 2)
  const infrastructure = coreInfrastructure(network, policy), graphs = baselGraphs(collections)
  assert(!graphs.has('37:tram:19'), 'Review newly available official tram 19 geometry')
  graphs.set('37:tram:19', baselTram19Graph(network).graph)
  const busCache = await json(busCachePath), diversionPolicy = await json(diversionPolicyPath)
  const supplementalBusCache = supplementalBusCachePath ? await json(supplementalBusCachePath) : undefined
  const reviewedGeometry = reviewedGeometryPath ? await json(reviewedGeometryPath) : undefined
  const sourceHashes = Object.fromEntries(await Promise.all(Object.entries({ archive, rail: railPath, busCache: busCachePath,
    ...(supplementalBusCachePath ? { supplementalBusCache: supplementalBusCachePath } : {}),
    ...(reviewedGeometryPath ? { reviewedGeometry: reviewedGeometryPath } : {}),
    diversionPolicy: diversionPolicyPath, policy: policyPath, catalogue: join(sourceDirectory, 'sources.json') }).map(async ([key, path]) => [key, sha(await readFile(path))])))
  const { routes, snapshots } = await readBaselCoreTimetables(archive, dates, policy)
  const reports = []
  for (const raw of snapshots) {
    const { snapshot: original, decisions, roads, initialRoads } = enrichBaselCore(raw, routes, { collections, graphs, infrastructure, busCache, supplementalBusCache, diversionPolicy, policy })
    const { snapshot, review } = reviewedGeometry ? applyReviewedBaselGeometry(original, routes, reviewedGeometry) : { snapshot: original }
    snapshot.metadata = { ...snapshot.metadata, label: policy.label, sourceHashes, model: 'scheduled interpolation along inferred physical centrelines',
      note: 'Basel core integration candidate. Complete BVB/BLT local journeys and explicitly bounded Swiss-side regional rail. Includes preceding service-day carry-in. Rail sourceCallRange identifies contiguous retained calls. Paths represent physical corridors, not specific running tracks. Missing paths retain stop interpolation.',
      geometry: { sources: catalogue, rail: { publisher: 'Federal Office of Transport', sourceUrl: 'https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf', sha256: sourceHashes.rail, validOn: null, simplificationMetres: 2 },
        roadSources: [...initialRoads.roadFallback.sources, ...(supplementalBusCache ? roads.roadFallback.sources : [])], tramDiversions: { policy: diversionPolicy, reviewedSourceServiceDates: policy.geometryServiceDates },
        railLimits: BASEL_CORE_RAIL_LIMITS, tramInfrastructureLimits: BASEL_DIVERSION_LIMITS,
        ...(review ? { reviewedRepairs: { reviewedOn: review.reviewedOn, sources: review.sources, addedMovements: review.addedMovements, maximumSnapMetres: Math.max(...review.decisions.map(item => item.maximumSnapMetres)) } } : {}) },
      scope: policy,
    }
    const coverage = coreCoverage(snapshot, routes)
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'basel-core-day-chunks')
    const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
    const payload = { manifestGzipBytes: gzipBytes(manifest), morningGzipBytes: gzipBytes(morning), chunks: chunks.map(({ descriptor, payload }) => ({ id: descriptor.id, trips: descriptor.tripCount, gzipBytes: gzipBytes(payload) })) }
    const failures = baselGate(coverage.groups, payload)
    const rail = coverage.groups.find(group => group.id === 'regional-rail')
    if (!rail?.trips || rail.coverage < 0.95) failures.push('Regional rail requires trips and at least 95% geometry')
    const missing = new Map()
    for (const train of snapshot.trains) train.pathSegments.forEach((path, i) => {
      if (path !== null) return
      const a = snapshot.stops[train.stops[i][0]], b = snapshot.stops[train.stops[i + 1][0]], key = JSON.stringify([train.routeId, a[4], b[4]])
      const item = missing.get(key) ?? { routeId: train.routeId, line: train.route, mode: routes.get(train.routeId).mode, fromId: a[4], toId: b[4], from: a[2], to: b[2], occurrences: 0 }
      item.occurrences++; missing.set(key, item)
    })
    const report = { schemaVersion: 1, serviceDate: raw.metadata.serviceDate, feedVersion: raw.metadata.feedVersion, sourceHashes,
      scope: { policy, trips: snapshot.trains.length, platforms: snapshot.stops.length, carryInTrips: snapshot.trains.filter(train => train.sourceServiceDate !== raw.metadata.serviceDate).length,
        clippedRailTrips: snapshot.trains.filter(train => train.clippedToCore).length, sourceCallSemantics: 'Every local source call retained; rail keeps contiguous in-scope source calls only, with zero-based half-open sourceCallRange and full sourceCallCount. No calendar or coordinate clipping hides intermediate calls.' },
      ...coverage, infrastructure: { ...infrastructure.provenance, decisions },
      ...(review ? { reviewedGeometry: review } : {}),
      remainingGeometry: [...missing.values()].sort((a, b) => b.occurrences - a.occurrences), roadFallback: { initial: initialRoads.roadFallback, ...(supplementalBusCache ? { supplemental: roads.roadFallback } : {}) }, payload,
      gate: { passed: !failures.length, failures, integrationCandidateReady: !failures.length, publicationReady: false,
        reviewBoundary: 'Dated service corridors and topology reviewed for a schematic centreline display. No certification of one-way streets or individual running tracks; remaining unmatched movements are explicit.',
        pending: ['Validate the application release separately from this data candidate', 'Resolve remaining replacement-bus and tram paths; acquire foreign rail geometry before extending the boundary'] },
    }
    const destination = join(output, raw.metadata.serviceDate)
    await mkdir(destination, { recursive: true })
    for (const { descriptor, payload } of chunks) { const path = join(destination, descriptor.path); await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(payload)) }
    await writeFile(join(destination, 'basel-core-day-manifest.json'), JSON.stringify(manifest))
    await writeFile(join(destination, 'basel-core-morning.json'), JSON.stringify(morning))
    await writeFile(join(destination, 'basel-core-audit.json'), `${JSON.stringify(report, null, 2)}\n`)
    reports.push(report)
  }
  return reports
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined
  for (const name of ['archive', 'sources', 'rail-geometry', 'output-directory']) assert(arg(name), `Missing --${name}`)
  const reports = await buildBaselCore({ archive: arg('archive'), sourceDirectory: arg('sources'), railPath: arg('rail-geometry'),
    supplementalBusCachePath: arg('supplemental-bus-cache') === 'none' ? undefined : arg('supplemental-bus-cache') ?? 'data/basel-core-road-cache.json',
    busCachePath: arg('bus-cache') ?? 'data/basel-road-cache.json', diversionPolicyPath: arg('tram-diversions') ?? 'data/basel-tram-diversions.json',
    policyPath: arg('policy') ?? 'data/basel-core-policy.json', dates: (arg('dates') ?? '2026-09-08,2026-09-13').split(','), output: arg('output-directory') })
  console.log(JSON.stringify(reports.map(report => ({ date: report.serviceDate, scope: { trips: report.scope.trips, carryInTrips: report.scope.carryInTrips }, groups: report.groups, gate: report.gate })), null, 2))
  if (process.argv.includes('--check') && reports.some(report => !report.gate.passed)) process.exitCode = 1
}
