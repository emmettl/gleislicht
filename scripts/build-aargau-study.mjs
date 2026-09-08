import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { AARGAU_LIMITS, identityKey, lineIndex, matchAargauPattern } from './aargau-line-geometry.mjs'
import { hashFile } from './inventory-aargau.mjs'

const digest = value => createHash('sha256').update(value).digest('hex')
const gzipBytes = value => gzipSync(JSON.stringify(value)).length
const category = (name, mode) => mode !== 'rail' ? mode : /^(EC|ICE|TGV|RJ|NJ|EN)/.test(name) ? 'international' : /^IC/.test(name) ? 'intercity' : /^IR/.test(name) ? 'interregio' : /^RE/.test(name) ? 'regional-express' : /^S[N]?\d/.test(name) ? 's-bahn' : 'regional'

export function applyAargauGeometry(raw, index, cantonStopIds) {
  const inside = new Set(cantonStopIds), stops = raw.stops, stopIndices = new Map(stops.map((s, i) => [s[4], i]))
  const patterns = new Map(), paths = [], pathIds = new Map(), pairs = new Map(), groups = new Map(), routeStats = new Map(), edges = new Map()
  const trains = raw.trains.map(train => {
    const key = JSON.stringify([train.routeId, train.directionId, train.calls.map(c => c[0])])
    if (!patterns.has(key)) {
      const match = matchAargauPattern(index.get(identityKey(train.agencyId, train.category, train.route)), train.calls.map(c => stops[stopIndices.get(c[0])]))
      const segments = match.segments.map((segment, i) => {
        const { path, ...assessment } = segment
        let pathIndex = null
        if (path) {
          assert.deepEqual(path[0], stops[stopIndices.get(train.calls[i][0])].slice(0, 2))
          assert.deepEqual(path.at(-1), stops[stopIndices.get(train.calls[i + 1][0])].slice(0, 2))
          const signature = JSON.stringify(path)
          if (!pathIds.has(signature)) { pathIds.set(signature, paths.length); paths.push(path) }
          pathIndex = pathIds.get(signature)
        }
        return { fromId: train.calls[i][0], toId: train.calls[i + 1][0], pathIndex, ...assessment }
      })
      const { segments: _segments, ...source } = match
      patterns.set(key, { id: digest(key).slice(0, 20), routeId: train.routeId, agencyId: train.agencyId, line: train.route, mode: train.category, gtfsDirectionId: train.directionId, stopIds: train.calls.map(c => c[0]), source, occurrences: 0, segments, completeGeometry: segments.every(s => s.pathIndex !== null) })
    }
    const pattern = patterns.get(key); pattern.occurrences++
    const groupKey = `${train.agencyId}:${train.category}`
    const counter = (map, key, labels) => {
      if (!map.has(key)) map.set(key, { ...labels, trips: 0, matched: 0, total: 0, cantonAdjacentMatched: 0, cantonAdjacentTotal: 0, requestStopTrips: 0, frequencyTrips: 0 })
      return map.get(key)
    }
    const group = counter(groups, groupKey, { agencyId: train.agencyId, mode: train.category })
    const route = counter(routeStats, train.routeId, { routeId: train.routeId, agencyId: train.agencyId, line: train.route, mode: train.category })
    for (const count of [group, route]) {
      count.trips++
      if (train.calls.some(c => ['2', '3'].includes(c[3]) || ['2', '3'].includes(c[4]))) count.requestStopTrips++
      if (train.frequency) count.frequencyTrips++
    }
    const indexedStops = train.calls.map(([id, a, d]) => [stopIndices.get(id), a, d])
    for (const [i, segment] of pattern.segments.entries()) {
      const pairKey = `${train.routeId}:${segment.fromId}:${segment.toId}`
      if (!pairs.has(pairKey)) pairs.set(pairKey, { routeId: train.routeId, agencyId: train.agencyId, mode: train.category, line: train.route, fromId: segment.fromId, toId: segment.toId, from: stops[stopIndices.get(segment.fromId)][2], to: stops[stopIndices.get(segment.toId)][2], occurrences: 0, matched: 0, reasons: new Set() })
      const pair = pairs.get(pairKey); pair.occurrences++
      const matched = segment.pathIndex !== null, adjacent = inside.has(segment.fromId) || inside.has(segment.toId)
      if (matched) pair.matched++
      else pair.reasons.add(segment.reason)
      for (const count of [group, route]) { count.total++; if (matched) count.matched++; if (adjacent) { count.cantonAdjacentTotal++; if (matched) count.cantonAdjacentMatched++ } }
      const a = indexedStops[i][0], b = indexedStops[i + 1][0], edgeKey = [a, b].sort((a, b) => a - b).join(':')
      const edge = edges.get(edgeKey) ?? { pair: [a, b].sort((a, b) => a - b), paths: new Set(), missing: false }
      if (matched) edge.paths.add(segment.pathIndex)
      else edge.missing = true
      edges.set(edgeKey, edge)
    }
    const { calls, category: mode, ...identity } = train
    return { ...identity, category: category(train.route, mode), mode, geometryPatternId: pattern.id, stops: indexedStops, pathSegments: pattern.segments.map(s => s.pathIndex), ...(calls.some(c => c[3] !== '0' || c[4] !== '0') ? { boardingRules: calls.map(c => c.slice(3)) } : {}) }
  })
  // Do not choose one directional geometry for an ambiguous shared static edge.
  const edgeList = [...edges.values()].sort((a, b) => a.pair[0] - b.pair[0] || a.pair[1] - b.pair[1])
  const snapshot = { metadata: { publisher: raw.metadata.feed.feed_publisher_name, feedVersion: raw.metadata.feed.feed_version, serviceDate: raw.metadata.serviceDate, windowStart: 0, windowEnd: 86400, focusTime: 27900, dayModel: raw.metadata.dayModel,
    model: 'scheduled interpolation on AGIS normal timetable line geometry; unmatched pathSegments are null',
    note: 'Aargau calling services with complete border-crossing stop chains. Directed stop order is validated on one source part; coordinate orientation is inferred, not a certified running direction or live vehicle position. Temporary diversions are absent. Missing paths remain explicit and may render straight stop interpolation. Two dates do not establish year-round coverage.',
    sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020', attribution: ['Timetable: opentransportdata.swiss', 'Daten des Kantons Aargau', '© swisstopo'], archiveSha256: raw.metadata.archiveSha256, modes: [...new Set(raw.trains.map(t => t.category))].sort() },
    stops, trains, paths, edges: edgeList.map(e => e.pair), edgePaths: edgeList.map(e => !e.missing && e.paths.size === 1 ? [...e.paths][0] : null),
    bounds: { minLongitude: Math.min(...stops.map(s => s[0])), minLatitude: Math.min(...stops.map(s => s[1])), maxLongitude: Math.max(...stops.map(s => s[0])), maxLatitude: Math.max(...stops.map(s => s[1])) } }
  const serializeCounters = map => [...map.values()].map(c => ({ ...c, coverage: c.total ? c.matched / c.total : null, cantonAdjacentCoverage: c.cantonAdjacentTotal ? c.cantonAdjacentMatched / c.cantonAdjacentTotal : null }))
  return { snapshot, patterns: [...patterns.values()], pairs: [...pairs.values()].map(p => ({ ...p, reasons: [...p.reasons] })), groups: serializeCounters(groups), routes: serializeCounters(routeStats) }
}

export function validateAargauFeed(snapshot, raw, manifest, chunks) {
  assert.equal(new Set(snapshot.trains.map(t => t.id)).size, raw.trains.length)
  const source = new Map(raw.trains.map(t => [t.id, t]))
  for (const train of snapshot.trains) {
    const original = source.get(train.id)
    assert(original && original.routeId === train.routeId)
    for (const field of ['agencyId', 'directionId', 'headsign', 'shortName', 'sourceTripId', 'sourceServiceDate']) assert.equal(train[field], original[field])
    if (original.calls.some(c => c[3] !== '0' || c[4] !== '0')) assert.deepEqual(train.boardingRules, original.calls.map(c => c.slice(3)))
    assert.deepEqual(train.stops.map(([i, a, d]) => [snapshot.stops[i][4], a, d]), original.calls.map(c => c.slice(0, 3)), `Altered complete stop chain: ${train.id}`)
    assert.equal(train.pathSegments.length, train.stops.length - 1)
    assert.equal(train.start, original.start); assert.equal(train.end, original.end)
    train.pathSegments.forEach((path, i) => {
      if (path === null) return
      assert(Number.isInteger(path) && snapshot.paths[path]?.length >= 2)
      assert.deepEqual(snapshot.paths[path][0], snapshot.stops[train.stops[i][0]].slice(0, 2))
      assert.deepEqual(snapshot.paths[path].at(-1), snapshot.stops[train.stops[i + 1][0]].slice(0, 2))
    })
  }
  assert.equal(chunks.length, 12)
  assert.equal(manifest.tripCount, snapshot.trains.length)
  const recovered = new Map()
  for (const { descriptor, payload } of chunks) {
    assert.equal(digest(JSON.stringify(payload)), descriptor.sha256)
    assert.equal(Buffer.byteLength(JSON.stringify(payload)), descriptor.bytes)
    for (const train of payload.trains) {
      assert(train.start <= payload.windowEnd && train.end >= payload.windowStart)
      if (recovered.has(train.id)) assert.deepEqual(recovered.get(train.id), train)
      recovered.set(train.id, train)
    }
  }
  assert.deepEqual(new Set(recovered.keys()), new Set(source.keys()))
  for (const train of snapshot.trains) assert.deepEqual(recovered.get(train.id), train)
  return { completeSourceStopChains: true, exactPathEndpoints: true, chunkHashesAndReconstruction: true }
}

export async function buildAargauStudy({ sources, inventoryDirectory, date, output, stem = 'aargau-region', crosswalkPath }) {
  const catalogue = JSON.parse(await readFile(join(sources, 'sources.json'), 'utf8'))
  for (const [name, record] of Object.entries(catalogue.files)) assert.equal(await hashFile(join(sources, name)), record.sha256)
  const inventory = JSON.parse(await readFile(join(inventoryDirectory, 'inventory.json'), 'utf8'))
  assert.equal(inventory.metadata.sourceCatalogueSha256, await hashFile(join(sources, 'sources.json')))
  const raw = JSON.parse(gunzipSync(await readFile(join(inventoryDirectory, `${date}-timetable.json.gz`))))
  assert.equal(raw.metadata.serviceDate, date)
  assert.equal(raw.metadata.archiveSha256, inventory.metadata.archiveSha256)
  const collection = JSON.parse(gunzipSync(await readFile(join(sources, 'lines.json.gz'))))
  assert.equal(collection.features.length, catalogue.lines.features)
  const crosswalk = crosswalkPath ? JSON.parse(await readFile(crosswalkPath, 'utf8')) : { mappings: [] }
  const index = lineIndex(collection, crosswalk.mappings)
  console.log(`Matching ${date}: ${raw.trains.length} complete journeys…`)
  const geometry = applyAargauGeometry(raw, index, inventory.cantonStopIds)
  geometry.snapshot.metadata.geometry = { dataDate: catalogue.lines.dataDate, retrievedAt: catalogue.lines.retrievedAt, sourceUrl: catalogue.lines.url, attribution: catalogue.lines.attribution, limits: AARGAU_LIMITS, sourceCatalogueSha256: inventory.metadata.sourceCatalogueSha256, ...(crosswalkPath ? { crosswalkSha256: await hashFile(crosswalkPath) } : {}) }
  const { manifest, chunks } = chunkNetworkSnapshot(geometry.snapshot, 7200, `${stem}-day-chunks`)
  const morning = extractNetworkWindow(geometry.snapshot, 24300, 31500, 27900)
  const checks = validateAargauFeed(geometry.snapshot, raw, manifest, chunks)
  let sourceVerification
  try { sourceVerification = JSON.parse(await readFile(join(inventoryDirectory, 'source-verification.json'), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (sourceVerification) {
    assert(sourceVerification.passed)
    assert.equal(sourceVerification.archiveSha256, raw.metadata.archiveSha256)
    assert.equal(sourceVerification.inventorySha256, await hashFile(join(inventoryDirectory, 'inventory.json')))
    assert.equal(sourceVerification.fixtures[`${date}-timetable.json.gz`], await hashFile(join(inventoryDirectory, `${date}-timetable.json.gz`)))
  }
  checks.independentSourceArchiveVerification = Boolean(sourceVerification)
  const routeMap = new Map(inventory.routes.map(r => [r.routeId, r]))
  for (const group of geometry.groups) group.operator = inventory.agencies.find(a => a.agency_id === group.agencyId).agency_name
  const sourcesInventory = collection.features.map(feature => {
    const p = feature.properties
    const keys = [...index].filter(([, parts]) => parts.some(part => part.featureId === feature.id)).map(([key]) => key)
    const matches = inventory.routes.filter(r => keys.includes(identityKey(r.agencyId, r.mode, r.line)))
    const patterns = geometry.patterns.filter(p => p.source.featureId === feature.id)
    return { featureId: feature.id, ...p, parts: feature.geometry.coordinates.length, vertices: feature.geometry.coordinates.reduce((sum, line) => sum + line.length, 0), matchingRouteIds: matches.map(r => r.routeId), cantonRouteIds: matches.filter(r => r.cantonSourceTrips).map(r => r.routeId), usedPatterns: patterns.length, acceptedOccurrences: patterns.reduce((sum, p) => sum + p.occurrences * p.segments.filter(s => s.pathIndex !== null).length, 0), status: patterns.some(p => p.segments.some(s => s.pathIndex !== null)) ? 'geometry-admitted' : !matches.length ? 'excluded-no-exact-identity-crosswalk' : !matches.some(r => r.cantonSourceTrips) ? 'excluded-no-canton-route-for-source-identity' : 'unused-inactive-or-pattern-mismatch' }
  })
  const totals = geometry.groups.reduce((sum, g) => { for (const key of ['trips', 'matched', 'total', 'cantonAdjacentMatched', 'cantonAdjacentTotal']) sum[key] = (sum[key] ?? 0) + g[key]; return sum }, {})
  const night = geometry.patterns.filter(p => /^(N|SN)\d/.test(p.line) || routeMap.get(p.routeId).routeType === 705)
  const controls = Object.entries({ Aarau: 'Aarau', 'Baden/Wettingen': 'Baden', Brugg: 'Brugg AG', Lenzburg: 'Lenzburg', Freiamt: 'Muri AG', Fricktal: 'Frick', Zurzibiet: 'Koblenz' }).map(([area, name]) => {
    const ids = new Set(raw.stops.filter(s => s[2] === name || s[2].startsWith(`${name},`)).map(s => s[4]))
    return { area, anchor: name, platforms: ids.size, trips: raw.trains.filter(t => t.calls.some(c => ids.has(c[0]))).length }
  })
  assert(controls.every(c => c.trips > 0), 'An Aargau review-area control is missing')
  const report = { schemaVersion: 1, metadata: { ...raw.metadata, timetableFixtureSha256: await hashFile(join(inventoryDirectory, `${date}-timetable.json.gz`)), inventorySha256: await hashFile(join(inventoryDirectory, 'inventory.json')), geometrySources: catalogue, crosswalk, sourceVerification }, scope: inventory.scope, checks,
    coverageDefinitions: { occurrence: 'Every adjacent stop pair in every retained complete journey, including calls outside the civil window and outside Aargau; not a count of live observations.', cantonAdjacent: 'An occurrence with at least one endpoint inside the canton polygon. This is not a clipped path-length coverage measure.', directedPattern: 'Exact GTFS route_id, direction_id and complete ordered platform-ID chain. A full match requires every segment; partial patterns retain all rejected segments.', directedPair: 'Exact route_id, from platform and to platform; fully matched only if all occurrences across all patterns match.', direction: 'Monotone projection on one source feature part, either coordinate orientation, at most one lap of an exactly closed part. RICHTUNG is retained, never equated to direction_id. This is ordered-path validation, not certified lane or track direction.' },
    reviewAreas: controls,
    nightService: { definition: 'N/SN line prefix or GTFS night-bus type 705', trips: night.reduce((s,p)=>s+p.occurrences,0), routes: [...new Set(night.map(p=>p.routeId))], patterns: night.length, total: night.reduce((s,p)=>s+p.occurrences*p.segments.length,0), matched: night.reduce((s,p)=>s+p.occurrences*p.segments.filter(s=>s.pathIndex!==null).length,0) },
    totals: { ...totals, coverage: totals.matched / totals.total, cantonAdjacentCoverage: totals.cantonAdjacentMatched / totals.cantonAdjacentTotal, platforms: raw.stops.length, routes: geometry.routes.length, operators: new Set(geometry.routes.map(r => r.agencyId)).size, directedPatterns: geometry.patterns.length, fullyMatchedPatterns: geometry.patterns.filter(p => p.completeGeometry).length, directedRouteStopPairs: geometry.pairs.length, fullyMatchedDirectedRouteStopPairs: geometry.pairs.filter(p => p.matched === p.occurrences).length, paths: geometry.snapshot.paths.length },
    groups: geometry.groups, routes: geometry.routes.map(r => ({ ...r, operator: routeMap.get(r.routeId).operator })), patterns: geometry.patterns, pairs: geometry.pairs, sourceRecords: sourcesInventory,
    exclusions: inventory.routes.filter(r => r.cantonSourceTrips && !r.days.find(d => d.date === date)?.trips).map(r => ({ routeId: r.routeId, agencyId: r.agencyId, line: r.line, mode: r.mode, reason: r.admission === 'excluded-unsupported-mode' ? r.admission : 'no-eligible-service-on-date', day: r.days.find(d => d.date === date) })),
    payload: { manifestGzipBytes: gzipBytes(manifest), morningGzipBytes: gzipBytes(morning), chunks: chunks.map(c => ({ id: c.descriptor.id, gzipBytes: gzipBytes(c.payload) })) },
    readiness: { publicationReady: false, reason: 'Regional audit feed with explicit geometry gaps. Automated directed stop-order validation is not directional road/track certification. Temporary diversions and additional seasonal dates remain unvalidated.' } }
  await mkdir(output, { recursive: true })
  for (const { descriptor, payload } of chunks) { await mkdir(dirname(join(output, descriptor.path)), { recursive: true }); await writeFile(join(output, descriptor.path), JSON.stringify(payload)) }
  await writeFile(join(output, `${stem}-day-manifest.json`), JSON.stringify(manifest))
  await writeFile(join(output, `${stem}-morning.json`), JSON.stringify(morning))
  await writeFile(join(output, 'audit.json'), JSON.stringify(report, null, 2)+'\n')
  console.log(JSON.stringify({ totals: report.totals, groups: report.groups, checks, payload: report.payload }, null, 2))
  return report
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => process.argv[process.argv.indexOf(`--${name}`) + 1]
  for (const name of ['sources', 'inventory', 'date', 'output']) assert(process.argv.includes(`--${name}`), `Missing --${name}`)
  await buildAargauStudy({ sources: arg('sources'), inventoryDirectory: arg('inventory'), date: arg('date'), output: arg('output'), crosswalkPath: process.argv.includes('--crosswalk') ? arg('crosswalk') : undefined })
}
