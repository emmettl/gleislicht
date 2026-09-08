import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { parseCsvLine } from '@motionstudies/data/gtfs'
import { sha256 } from './download-luzern-sources.mjs'
import { prepareRoadFeed, roadPatternId } from './prepare-postbus-road-feed.mjs'
import { luzernRoadInputs, roadConsensus, importLuzernRoads, verifyLuzernRoadEvidence } from './luzern-road-geometry.mjs'
import { sliceShape, distanceMetres } from './enrich-postbus-roads.mjs'

const root = 'data/st-gallen-sources/local/road-pilot'
const policyPath = 'data/st-gallen-road-pilot-policy.json', reportPath = 'data/st-gallen-road-pilot-review.json'
const timetablePath = 'data/st-gallen-sources/local/timetable.json'
const endpointPath = 'data/st-gallen-endpoint-review.json', followupPath = 'data/st-gallen-endpoint-followup.json'
const json = async p => JSON.parse(await readFile(p, 'utf8'))
const digest = async p => sha256(await readFile(p))
const save = (p, v) => writeFile(p, JSON.stringify(v, null, 2) + '\n')
const scopeText = 'St. Gallen lines 150 and 631; all complete patterns across both civil-day fixtures, including cross-canton calls; diagnostic only'
const diagramPath = 'docs/assets/st-gallen-road-pilot.svg'

export function stGallenRoadScope(raw, policy) {
  assert.deepEqual(raw.dates, policy.dates)
  assert.equal(policy.admissionEnabled, false, 'This pilot cannot admit geometry')
  assert.equal(new Set(policy.routes.map(r => r.routeId)).size, policy.routes.length)
  for (const expected of policy.routes) {
    const route = raw.inventory.find(r => r.routeId === expected.routeId)
    assert(route, 'Missing reviewed road route')
    assert.equal(route.mode, 'bus')
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(route[key], value, 'Changed reviewed route identity: ' + key)
  }
  const ids = new Set(policy.routes.map(r => r.routeId))
  return { ...raw, snapshots: raw.snapshots.map(day => ({ ...day, trains: day.trains.filter(t => ids.has(t.routeId)) })) }
}

export function validateStGallenRoadScope(raw, cache, policy) {
  const scoped = stGallenRoadScope(raw, policy), { stops, agencies } = luzernRoadInputs(scoped)
  assert.deepEqual(cache.metadata.dates, raw.dates)
  assert.equal(cache.metadata.feedVersion, raw.feed.feed_version)
  assert.equal(cache.metadata.timetableSha256, policy.timetableSha256)
  assert.deepEqual(cache.metadata.source, policy.source)
  assert.equal(cache.metadata.attribution, '© OpenStreetMap contributors')
  assert.equal(cache.metadata.license, 'ODbL-1.0')
  assert.deepEqual(Object.keys(cache.agencies).sort(), [...agencies.keys()].sort())
  for (const [id, agency] of agencies) {
    const expected = [...new Set(agency.trains.map(t => roadPatternId(t, stops)))].sort()
    assert.deepEqual(Object.keys(cache.agencies[id].identities).sort(), expected, 'Missing or additional full road pattern')
    const run = cache.agencies[id].cache.metadata.matcher
    assert.equal(run.osmSha256, policy.source.osmSha256)
    assert.equal(run.binarySha256, policy.binarySha256)
    assert.equal(run.configSha256, policy.config.sha256)
  }
  return { scoped, stops, agencies }
}

export async function prepareStGallenRoadPilot(output = join(root, 'prepared')) {
  const bytes = await readFile(timetablePath), policy = await json(policyPath)
  assert.equal(sha256(bytes), policy.timetableSha256)
  const raw = stGallenRoadScope(JSON.parse(bytes), policy), { stops, agencies } = luzernRoadInputs(raw)
  const metadata = { serviceDate: raw.dates[0], dates: raw.dates, feedVersion: raw.feed.feed_version,
    timetableSha256: sha256(bytes), sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020', scope: scopeText }
  const summaries = []
  for (const agency of agencies.values()) summaries.push({ agencyId: agency.id, ...await prepareRoadFeed({
    manifest: { stops, metadata }, trains: agency.trains, output: join(output, agency.id),
    agency: { id: agency.id, name: agency.name, url: metadata.sourceUrl },
  }) })
  await save(join(output, 'index.json'), { metadata, agencies: summaries })
  return summaries
}

// Read the unsimplified shape-distance slices as well as the accepted path.
// A passing 120 m snap must not conceal a long off-road platform connector.
export function roadConnectorEvidence(evidence, identities, selectedKeys) {
  const csv = name => {
    const [headers, ...rows] = evidence[name].trim().split('\n').map(parseCsvLine)
    return rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])))
  }
  const trips = new Map(csv('trips.txt').map(t => [t.trip_id, t])), times = new Map(), shapes = new Map()
  for (const t of csv('stop_times.txt')) { const rows = times.get(t.trip_id) ?? []; rows.push(t); times.set(t.trip_id, rows) }
  for (const s of csv('shapes.txt')) { const rows = shapes.get(s.shape_id) ?? []; rows.push(s); shapes.set(s.shape_id, rows) }
  for (const rows of times.values()) rows.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence))
  for (const [id, rows] of shapes) shapes.set(id, rows.sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence))
    .map(s => [Number(s.shape_pt_lon), Number(s.shape_pt_lat), Number(s.shape_dist_traveled)]))
  const result = new Map()
  for (const [patternId, identity] of Object.entries(identities)) for (let i = 1; i < identity.stops.length; i++) {
    const from = identity.stops[i - 1], to = identity.stops[i], key = JSON.stringify([identity.routeId, from[4], to[4]])
    if (!selectedKeys.has(key)) continue
    const calls = times.get(patternId), trip = trips.get(patternId)
    assert.equal(trip?.route_id, identity.routeId)
    assert.deepEqual(calls.map(c => c.stop_id), identity.stops.map(s => s[4]))
    const path = sliceShape(shapes.get(trip.shape_id), Number(calls[i - 1].shape_dist_traveled), Number(calls[i].shape_dist_traveled))
    assert(path, 'Missing reviewed raw shape slice')
    const contexts = result.get(key) ?? []
    contexts.push({ patternId, segment: i - 1, rawShapeSha256: sha256(JSON.stringify(path)),
      fromCoordinate: from.slice(0, 2), toCoordinate: to.slice(0, 2),
      roadFrom: path[0], roadTo: path.at(-1),
      fromSnapMetres: distanceMetres(path[0], from), toSnapMetres: distanceMetres(path.at(-1), to) })
    result.set(key, contexts)
  }
  return result
}

// This check needs tracked files only. The source replay below additionally
// reconstructs the cache from every original matcher warning and shape slice.
export function validateStGallenRoadReview(report, endpoints, index, policy, followup) {
  assert.equal(report.schemaVersion, 1)
  assert.deepEqual(report.sourceHashes, endpoints.sourceHashes)
  assert.deepEqual(report.sourceHashes, index.sourceHashes)
  assert.deepEqual(report.source, policy.source)
  assert.deepEqual(report.cache, policy.cache)
  assert.deepEqual(report.config, policy.config)
  assert.equal(report.binarySha256, policy.binarySha256)
  assert.deepEqual(report.limits, policy.limits)
  assert.equal(report.reviewedOn, policy.reviewedOn)
  assert.equal(policy.admissionEnabled, false)
  assert.deepEqual(report.routes.map(r => r.identity), policy.routes)
  assert.deepEqual(report.routes, policy.expectedRouteCoverage)
  assert.equal(report.attribution, '© OpenStreetMap contributors')
  assert.equal(report.license, 'ODbL-1.0')
  assert.equal(report.licenseUrl, 'https://www.openstreetmap.org/copyright')
  const routes = new Set(policy.routes.map(r => r.routeId))
  assert.deepEqual(report.pairs.map(p => p.key), endpoints.pairs.filter(p => routes.has(p.routeId)).map(p => p.key))
  assert.deepEqual(report.pairs.map(p => ({ key: p.key, geometrySha256: p.geometrySha256, decision: p.decision,
    evidenceId: p.evidenceId, connectorEvidenceSha256: p.connectorEvidenceSha256 })), policy.pairs)
  for (const p of report.pairs) {
    const original = endpoints.pairs.find(e => e.key === p.key)
    assert.deepEqual(p.endpoint, original)
    assert.deepEqual(p.supportingEvents, followup.cases.find(c => c.routeId === original.routeId).events)
    assert.equal(p.geometrySource, 'osm-road-inference')
    assert(p.numericalConsensus && p.contexts.length > 0)
    assert.equal(sha256(JSON.stringify(p.contexts)), p.connectorEvidenceSha256, 'Changed raw road connector evidence')
    assert.deepEqual([...new Set(p.contexts.map(c => c.patternId))].sort(), p.roadPatternIds)
    assert.equal(p.contexts.length, p.roadContextOccurrences)
    assert(p.lengthMetres <= Math.max(policy.limits.detourFloorMetres, p.directMetres * policy.limits.detourRatio))
    for (const c of p.contexts) {
      assert(/^[a-f0-9]{64}$/.test(c.rawShapeSha256))
      for (const [coordinate, road, snap] of [[c.fromCoordinate, c.roadFrom, c.fromSnapMetres], [c.toCoordinate, c.roadTo, c.toSnapMetres]]) {
        assert.equal(distanceMetres(coordinate, road), snap)
        assert(snap <= policy.limits.snapMetres)
      }
    }
  }
  assert.deepEqual(report.feedDays, index.days.map(d => ({ date: d.date, trips: d.trips, patterns: d.patterns, manifestSha256: d.manifestSha256, morningSha256: d.morningSha256 })))
  assert.deepEqual(report.validation, { passed: true, fullPatternInputs: true, matcherWarningsReplayed: true,
    originalStopCoordinates: true, feedChanged: false, admissionPolicyChanged: false, roadGeometryAdmitted: false, directionCertified: false })
}

export async function reviewStGallenRoadPilot() {
  const policy = await json(policyPath), cache = await json(policy.cache.file), endpoints = await json(endpointPath)
  const index = await json('data/st-gallen-region/index.json'), followup = await json(followupPath)
  assert.equal(await digest(policy.cache.file), policy.cache.sha256)
  assert.equal(await digest(policy.config.file), policy.config.sha256)
  assert.equal(await digest(timetablePath), policy.timetableSha256)
  assert.equal(await digest('data/st-gallen-policy.json'), endpoints.sourceHashes.policy)
  assert.deepEqual(policy.limits, (await json('data/st-gallen-policy.json')).limits)
  assert.equal(endpoints.sourceHashes.timetable, policy.timetableSha256)
  const raw = await json(timetablePath), { scoped, stops, agencies } = validateStGallenRoadScope(raw, cache, policy)
  await verifyLuzernRoadEvidence(cache, policy.source.description)
  const roads = roadConsensus(cache, policy.limits, policy.source.osmSha256)
  const keys = new Set(policy.pairs.map(p => p.key)), connectors = new Map(), matcherEvidence = []
  for (const [agencyId, agency] of Object.entries(cache.agencies)) {
    const bytes = await readFile(agency.evidence.file), evidence = JSON.parse(gunzipSync(bytes))
    for (const [key, contexts] of roadConnectorEvidence(evidence, agency.identities, keys)) connectors.set(key, contexts)
    const input = JSON.parse(evidence['patterns.json']), expected = agencies.get(agencyId)
    assert.equal(input.patterns.reduce((n, p) => n + p.tripCount, 0), expected.trains.length)
    for (const p of input.patterns) assert.equal(p.tripCount, expected.trains.filter(t => roadPatternId(t, stops) === p.id).length)
    matcherEvidence.push({ agencyId, evidence: agency.evidence, patternsSha256: agency.patternsSha256,
      run: agency.cache.metadata.matcher, report: agency.cache.report })
  }
  const pairs = policy.pairs.map(p => {
    const road = roads.get(p.key); assert(road?.path, 'Reviewed road no longer has full-pattern consensus')
    const endpoint = endpoints.pairs.find(e => e.key === p.key); assert(endpoint)
    return { ...p, endpoint, numericalConsensus: true, geometrySource: road.geometrySource,
      geometrySha256: sha256(JSON.stringify(road.path)), lengthMetres: road.lengthMetres, directMetres: road.directMetres,
      roadPatternIds: road.roadPatternIds, roadContextOccurrences: road.roadContextOccurrences,
      contexts: connectors.get(p.key), supportingEvents: followup.cases.find(c => c.routeId === endpoint.routeId).events }
  })
  const routes = policy.routes.map(identity => ({ identity,
    days: scoped.snapshots.map(day => {
      const trains = day.trains.filter(t => t.routeId === identity.routeId)
      const agencyTrains = agencies.get(identity.agencyId).trains.filter(t => t.routeId === identity.routeId && t.id.startsWith(day.date + ':'))
      return { date: day.date, trips: trains.length, fullRoadPatterns: new Set(agencyTrains.map(t => roadPatternId(t, stops))).size }
    }), fullRoadPatterns: Object.values(cache.agencies[identity.agencyId].identities).filter(p => p.routeId === identity.routeId).length }))
  const feedDays = []
  for (const d of index.days) {
    const directory = join('data/st-gallen-region', 'local', d.date)
    const manifestPath = join(directory, 'st-gallen-region-day-manifest.json'), manifest = await json(manifestPath)
    assert.equal(await digest(manifestPath), d.manifestSha256)
    assert.equal(await digest(join(directory, 'st-gallen-region-morning.json')), d.morningSha256)
    for (const chunk of manifest.chunks) assert.equal(await digest(join(directory, chunk.path)), chunk.sha256)
    feedDays.push({ date: d.date, trips: d.trips, patterns: d.patterns, manifestSha256: d.manifestSha256, morningSha256: d.morningSha256 })
  }
  const report = { schemaVersion: 1, reviewedOn: policy.reviewedOn, sourceHashes: endpoints.sourceHashes,
    policySha256: await digest(policyPath), endpointReviewSha256: await digest(endpointPath), followupReviewSha256: await digest(followupPath),
    source: policy.source, attribution: cache.metadata.attribution, license: cache.metadata.license, licenseUrl: cache.metadata.licenseUrl,
    cache: policy.cache, config: policy.config, binarySha256: policy.binarySha256, limits: policy.limits,
    routes, matcherEvidence, pairs, feedDays,
    validation: { passed: true, fullPatternInputs: true, matcherWarningsReplayed: true, originalStopCoordinates: true,
      feedChanged: false, admissionPolicyChanged: false, roadGeometryAdmitted: false, directionCertified: false } }
  validateStGallenRoadReview(report, endpoints, index, policy, followup)
  return report
}

export function stGallenRoadPilotDiagram(cache, report) {
  const roads = roadConsensus(cache, report.limits, report.source.osmSha256)
  const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1560" height="760" viewBox="0 0 1560 760"><rect width="1560" height="760" fill="#f7f8fa"/><g font-family="Arial,sans-serif" fill="#172534">'
  svg += '<text x="30" y="38" font-size="25" font-weight="bold">St. Gallen road pilot — candidates only; no feed admissions</text>'
  svg += '<text x="30" y="66" font-size="16">Arrows follow timetable call order. Red dashed strokes mark raw-shape-to-platform connectors. No basemap.</text>'
  for (const [n, route] of report.routes.entries()) {
    const pairs = report.pairs.filter(p => p.endpoint.routeId === route.identity.routeId)
    const paths = pairs.map(p => roads.get(p.key).path), all = paths.flat()
    const centre = all.reduce((sum, p) => sum + p[1], 0) / all.length, scaleX = Math.cos(centre * Math.PI / 180)
    const xs = all.map(p => p[0] * scaleX), ys = all.map(p => p[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    const scale = Math.min(620 / (maxX - minX), 420 / (maxY - minY)), left = 30 + n * 770
    const project = p => [left + 50 + (620 - (maxX - minX) * scale) / 2 + (p[0] * scaleX - minX) * scale,
      180 + (420 - (maxY - minY) * scale) / 2 + (maxY - p[1]) * scale]
    const points = path => path.map(p => project(p).map(n => n.toFixed(2)).join(',')).join(' ')
    svg += `<rect x="${left}" y="95" width="730" height="585" rx="8" fill="white" stroke="#d4dbe2"/><text x="${left + 22}" y="126" font-size="21" font-weight="bold">${route.identity.line} · ${n ? 'Rüti diversion' : 'Gossau Sommerau extension'}</text>`
    svg += `<text x="${left + 22}" y="151" font-size="15">${n ? '605.52 m + 799.52 m; largest connector 5.56 m' : 'Inbound 719.48 m / outbound 1,001.18 m; largest connector 92.42 m'}</text>`
    const stops = new Map()
    for (const [i, pair] of pairs.entries()) {
      const path = paths[i], colour = i ? '#007899' : '#7551ba'
      svg += `<polyline points="${points(path)}" fill="none" stroke="${colour}" stroke-width="4" stroke-linejoin="round"/>`
      for (let j = 1; j < path.length; j++) {
        const a = project(path[j - 1]), b = project(path[j])
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 28) continue
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI
        svg += `<path d="M -8 -5 L 0 0 L -8 5" fill="none" stroke="${colour}" stroke-width="2.5" transform="translate(${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2}) rotate(${angle})"/>`
      }
      const context = pair.contexts[0]
      for (const [platform, road] of [[context.fromCoordinate, context.roadFrom], [context.toCoordinate, context.roadTo]])
        svg += `<polyline points="${points([platform, road])}" fill="none" stroke="#d02e3e" stroke-width="5" stroke-dasharray="7 5"/>`
      stops.set(pair.endpoint.from, context.fromCoordinate); stops.set(pair.endpoint.to, context.toCoordinate)
    }
    for (const [name, point] of stops) {
      const [x, y] = project(point), right = x > left + 530
      svg += `<circle cx="${x}" cy="${y}" r="5" fill="#172534"/><text x="${x + (right ? -10 : 10)}" y="${y - 12}" text-anchor="${right ? 'end' : 'start'}" font-size="16">${escape(name.split(', ').at(-1))}</text>`
    }
    svg += `<text x="${left + 22}" y="639" font-size="16">${n ? 'Numerical consensus in all three affected full patterns.' : 'Inbound connector crosses a gap without mapped road support.'}</text>`
    svg += `<text x="${left + 22}" y="663" font-size="16">${n ? 'Retained exclusion: dated road/turn alignment review pending.' : 'Retained exclusion: outbound success does not validate inbound.'}</text>`
  }
  svg += '<text x="30" y="714" font-size="15">© OpenStreetMap contributors · ODbL 1.0 · Swiss extract 2026-09-02 + border extract retrieved 2026-09-08</text>'
  svg += '<text x="30" y="738" font-size="15">Stops: SBB / opentransportdata.swiss, GTFS 20260902 · pfaedle 99f2cd4 · Reviewed 2026-09-09 · Inferred paths, not certified routes</text></g></svg>\n'
  return svg
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const command = process.argv[2] ?? 'review'
  if (command === 'prepare') console.log(await prepareStGallenRoadPilot(process.argv[3]))
  else if (command === 'import') {
    const policy = await json(policyPath)
    console.log(await importLuzernRoads(join(root, 'prepared'), join(root, 'matched'), policy.cache.file, join(root, 'evidence'), policy.source))
  } else {
    assert(['review', '--check'].includes(command), 'Usage: prepare [DIRECTORY] | import | review | --check')
    const report = await reviewStGallenRoadPilot()
    const diagram = stGallenRoadPilotDiagram(await json(report.cache.file), report)
    if (command === '--check') {
      assert.deepEqual(await json(reportPath), report, 'Stale St. Gallen road pilot review')
      assert.equal(await readFile(diagramPath, 'utf8'), diagram, 'Stale road pilot diagram')
    } else { await save(reportPath, report); await writeFile(diagramPath, diagram) }
    console.log({ passed: true, routes: report.routes.length, fullPatterns: report.routes.reduce((n, r) => n + r.fullRoadPatterns, 0),
      reviewedPairs: report.pairs.length, admittedRoadPairs: 0 })
  }
}
