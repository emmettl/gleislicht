import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'
import { prepareRoadFeed, roadPatternId } from './prepare-postbus-road-feed.mjs'
import { importRoadShapes } from './enrich-postbus-roads.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
import { bernGraph, BERN_LIMITS, bernAdmission } from './bern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'

export const BERN_ROAD_LIMITS = { snapMetres: 80, maxDetourRatio: 4.5, detourAllowanceMetres: 1200, simplifyMetres: 0 }
export const BERN_URBAN_DATES = ['2026-09-04', '2026-09-06']
export const BERN_URBAN_ROUTES = ['92-7A-j26-1', '92-8A-j26-1', '92-2-D-j26-1', '92-3-F-j26-1', '92-6-F-j26-1', '92-1-H-j26-1', '92-2-F-j26-1']
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const json = async path => JSON.parse(await readFile(path, 'utf8'))
const files = ['patterns.json', 'matching.log', 'shapes.txt', 'trips.txt', 'stop_times.txt', 'routing-run.json']
export const BERN_ROAD_SOURCE = {
  description: 'Geofabrik Switzerland 2026-09-02 plus OSM border extract retrieved 2026-09-08',
  sourceUrl: 'https://download.geofabrik.de/europe/switzerland.html', swissDate: '2026-09-02', borderRetrieved: '2026-09-08',
  osmSha256: 'd5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b',
  matcherCommit: '99f2cd466696ecc6bdb73b2b3bb9008557fcb84a', attribution: '© OpenStreetMap contributors',
  license: 'ODbL-1.0', licenseUrl: 'https://www.openstreetmap.org/copyright',
}

export function bernUrbanInputs(raw, scope = BERN_URBAN_ROUTES) {
  assert.deepEqual(raw.snapshots.map(s => s.metadata.serviceDate), BERN_URBAN_DATES)
  const stops = [], index = new Map(), agencies = new Map()
  for (const snapshot of raw.snapshots) for (const t of snapshot.trains) {
    if (!scope.includes(t.routeId)) continue
    const shift = Math.max(0, Math.ceil(-t.start / 86400) * 86400), trains = agencies.get(t.agencyId) ?? []
    trains.push({ ...t, id: `${snapshot.metadata.serviceDate}:${t.id}`, stops: t.stops.map(([i, a, d]) => {
      const stop = snapshot.stops[i], key = JSON.stringify(stop)
      if (!index.has(key)) { index.set(key, stops.length); stops.push(stop) }
      return [index.get(key), a + shift, d + shift]
    }) })
    agencies.set(t.agencyId, trains)
  }
  return { stops, agencies, metadata: { ...raw.snapshots[0].metadata, sourceHashes: raw.sourceHashes,
    dates: BERN_URBAN_DATES, scope } }
}

export async function prepareBernUrban(raw, output, scope = BERN_URBAN_ROUTES) {
  const { stops, agencies, metadata } = bernUrbanInputs(raw, scope)
  await mkdir(output, { recursive: true })
  for (const [id, trains] of agencies) await prepareRoadFeed({ manifest: { stops, metadata }, trains, output: join(output, id),
    agency: { id, name: raw.routes.find(r => r.agencyId === id).agency, url: 'https://data.opentransportdata.swiss/' } })
  await writeFile(join(output, 'index.json'), JSON.stringify({ metadata, agencies: [...agencies.keys()] }))
}

export async function importBernUrban(prepared, matched, { cachePath = 'data/bern-urban-cache.json', evidenceDirectory = 'data/bern-urban-evidence' } = {}) {
  const input = await json(join(prepared, 'index.json')), agencies = {}
  await mkdir(evidenceDirectory, { recursive: true })
  for (const agencyId of input.agencies) {
    const directory = join(matched, agencyId), patterns = await json(join(directory, 'patterns.json'))
    assert.deepEqual(patterns.metadata, input.metadata)
    const cache = await importRoadShapes(directory, BERN_ROAD_SOURCE.description, BERN_ROAD_LIMITS)
    assert.equal(cache.metadata.sourceSha256, BERN_ROAD_SOURCE.osmSha256)
    const evidence = Object.fromEntries(await Promise.all(files.map(async name => [name, await readFile(join(directory, name), 'utf8')])))
    const bytes = gzipSync(JSON.stringify(evidence)), file = join(evidenceDirectory, `${agencyId}.json.gz`)
    await writeFile(file, bytes)
    agencies[agencyId] = { evidence: { file, sha256: sha(bytes) }, patternsSha256: sha(evidence['patterns.json']),
      identities: Object.fromEntries(patterns.patterns.map(p => [p.id, { routeId: p.routeId, stops: p.stops.map(([i]) => patterns.stops[i]) }])), cache }
  }
  const result = { schemaVersion: 1, metadata: input.metadata, agencies }
  await writeFile(cachePath, JSON.stringify(result) + '\n')
  return result
}

export async function loadBernUrban(raw, { cachePath = 'data/bern-urban-cache.json', policyPath = 'data/bern-urban-policy.json', scope = BERN_URBAN_ROUTES } = {}) {
  const bytes = await readFile(cachePath), cache = JSON.parse(bytes)
  const policyBytes = await readFile(policyPath), policy = JSON.parse(policyBytes)
  assert.deepEqual(policy.dates, BERN_URBAN_DATES)
  assert.deepEqual(cache.metadata.dates, policy.dates)
  assert.deepEqual(cache.metadata.scope, scope)
  assert.deepEqual(policy.roadSource, BERN_ROAD_SOURCE)
  for (const document of policy.documents) assert.equal(sha(await readFile(`data/bern-sources/${document.file}`)), document.sha256)
  if (raw) {
    const { stops, agencies, metadata } = bernUrbanInputs(raw, scope)
    assert.deepEqual(cache.metadata, metadata)
    assert.deepEqual(Object.keys(cache.agencies).sort(), [...agencies.keys()].sort())
    for (const [id, trains] of agencies) {
      const expected = Object.fromEntries(trains.map(t => [roadPatternId(t, stops), { routeId: t.routeId, stops: t.stops.map(([i]) => stops[i]) }]))
      assert.deepEqual(cache.agencies[id].identities, expected, 'Every full pattern on both dates must be retained, including failures')
    }
  }
  const temporary = await mkdtemp(join(tmpdir(), 'bern-urban-check-'))
  try {
    for (const [id, agency] of Object.entries(cache.agencies)) {
      const evidenceBytes = await readFile(agency.evidence.file)
      assert.equal(sha(evidenceBytes), agency.evidence.sha256)
      const evidence = JSON.parse(gunzipSync(evidenceBytes)), directory = join(temporary, id)
      assert.deepEqual(Object.keys(evidence).sort(), [...files].sort())
      await mkdir(directory)
      for (const name of files) await writeFile(join(directory, name), evidence[name])
      assert.deepEqual(await importRoadShapes(directory, BERN_ROAD_SOURCE.description, BERN_ROAD_LIMITS), agency.cache)
      assert.equal(sha(evidence['patterns.json']), agency.patternsSha256)
      const input = JSON.parse(evidence['patterns.json'])
      assert.deepEqual(agency.identities, Object.fromEntries(input.patterns.map(p => [p.id, { routeId: p.routeId, stops: p.stops.map(([i]) => input.stops[i]) }])))
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
  return { policy, cache, roads: roadConsensus(cache, BERN_LIMITS.bus), metadata: { policy,
    cacheSha256: sha(bytes), policySha256: sha(policyBytes), model: 'Missing-pair supplements only. OSM paths are inferred, not operator-certified; tram station approaches use separately identified cantonal line 30_003.' } }
}

export function applyBernUrban(raw, result, source, urban) {
  // Dated construction evidence and complete-context road inference never leak
  // into seasonal fixtures. The original source stops and successful paths stay intact.
  if (!urban.policy.dates.includes(raw.metadata.serviceDate)) return result
  const signatures = new Map(result.paths.map((p, i) => [JSON.stringify(p), i]))
  const stops = new Map(raw.stops.map(s => [s[4], s])), changes = new Map()
  const graph = bernGraph(source.lines.filter(f => f.properties.liniencode === '30_003'))
  for (const pair of result.pairs) {
    if (pair.pathIndex !== null) continue
    const key = JSON.stringify([pair.routeId, pair.fromId, pair.toId])
    let match
    if (urban.policy.roadRouteIds.includes(pair.routeId)) {
      const road = urban.roads.get(key)
      if (road?.path) match = { ...road, sourceKind: 'osm-road-inference', sourceId: urban.policy.sourceId ?? 'bern-urban-osm-20260902' }
      else if (road) pair.supplementRejection = road.reason
    }
    if (urban.policy.tramPairs.some(p => JSON.stringify(p) === key)) {
      const candidate = matchBaselSegment(graph, stops.get(pair.fromId), stops.get(pair.toId), BERN_LIMITS.tram)
      if (candidate.path) match = { ...candidate, sourceKind: 'dated-cantonal-tram-corridor', sourceId: '30_003' }
    }
    if (!match?.path) continue
    const { path, ...assessment } = match, signature = JSON.stringify(path)
    if (!signatures.has(signature)) { signatures.set(signature, result.paths.length); result.paths.push(path) }
    const { pathIndex: _index, occurrences: _occurrences, admittedOccurrences: _admitted, ...original } = pair
    Object.assign(pair, assessment, { originalAssessment: original, pathIndex: signatures.get(signature) })
    delete pair.reason
    changes.set(key, pair)
  }
  for (const p of result.patterns) {
    p.pathSegments = p.pathSegments.map((index, i) => changes.get(JSON.stringify([p.routeId, p.stopIds[i], p.stopIds[i + 1]]))?.pathIndex ?? index)
    p.matchedSegments = p.pathSegments.filter(i => i !== null).length
    const supplements = p.stopIds.slice(1).map((id, i) => changes.get(JSON.stringify([p.routeId, p.stopIds[i], id]))?.sourceId).filter(Boolean)
    if (supplements.length) p.supplementalSources = [...new Set(supplements)].sort()
    p.admittedTrips = 0; p.decisions = {}
  }
  const patterns = new Map(result.patterns.map(p => [p.id, p])), pairs = new Map(result.pairs.map(p => [JSON.stringify([p.routeId, p.fromId, p.toId]), p]))
  for (const pair of result.pairs) pair.admittedOccurrences = 0
  for (const t of result.trains) {
    const p = patterns.get(t.patternId)
    t.pathSegments = p.pathSegments; t.admission = bernAdmission(t, p)
    p.decisions[t.admission] = (p.decisions[t.admission] ?? 0) + 1
    if (t.admission === 'admitted') {
      p.admittedTrips++
      for (let i = 1; i < p.stopIds.length; i++) pairs.get(JSON.stringify([p.routeId, p.stopIds[i - 1], p.stopIds[i]])).admittedOccurrences++
    }
  }
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, a, b] = process.argv.slice(2)
  if (command === 'prepare') await prepareBernUrban(JSON.parse(gunzipSync(await readFile(a))), b)
  else if (command === 'import') await importBernUrban(a, b)
  else assert.fail('Usage: prepare TIMETABLE_CACHE DIRECTORY | import PREPARED MATCHED')
}
