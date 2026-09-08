import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { gzipSync, gunzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { prepareRoadFeed, roadPatternId } from './prepare-postbus-road-feed.mjs'
import { importRoadShapes, distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { luzernMode } from './luzern-timetable.mjs'

export const LUZERN_ROAD_SOURCE = {
  description: 'Geofabrik Switzerland 2026-09-02 plus OSM border extract retrieved 2026-09-08',
  swissDate: '2026-09-02', borderRetrieved: '2026-09-08',
  sourceUrl: 'https://download.geofabrik.de/europe/switzerland.html',
  osmSha256: 'd5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b',
  matcherCommit: '99f2cd466696ecc6bdb73b2b3bb9008557fcb84a',
}
const json = async path => JSON.parse(await readFile(path, 'utf8'))
const save = (path, value) => writeFile(path, JSON.stringify(value) + '\n')

export function luzernRoadInputs(raw) {
  const stops = raw.stops.map(s => [Number(s.stop_lon), Number(s.stop_lat), s.stop_name, s.platform_code, s.stop_id])
  const indices = new Map(stops.map((s, i) => [s[4], i])), routes = new Map(raw.inventory.map(r => [r.routeId, r]))
  const agencies = new Map()
  for (const day of raw.snapshots) for (const train of day.trains) {
    const route = routes.get(train.routeId)
    if (luzernMode(route.routeType) !== 'bus') continue
    const agency = agencies.get(route.agencyId) ?? { id: route.agencyId, name: route.agency, trains: [] }
    // Routing-only GTFS needs nonnegative times. The delivered feed always uses
    // the untouched source calls, including preceding-service-day carry-in.
    const shift = Math.max(0, Math.ceil(-train.calls[0].arrival / 86400) * 86400)
    agency.trains.push({ id: `${day.date}:${train.id}`, routeId: train.routeId, route: route.line, headsign: train.headsign,
      stops: train.calls.map(c => [indices.get(c.id), c.arrival + shift, c.departure + shift]) })
    agencies.set(agency.id, agency)
  }
  return { stops, agencies }
}

export async function prepareLuzernRoads(timetablePath, output) {
  const bytes = await readFile(timetablePath), raw = JSON.parse(bytes), { stops, agencies } = luzernRoadInputs(raw)
  const metadata = { serviceDate: raw.dates[0], dates: raw.dates, feedVersion: raw.feed.feed_version,
    sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020', timetableSha256: sha256(bytes),
    scope: 'All bus patterns across both Luzern civil-day fixtures; complete cross-canton calls' }
  await mkdir(output, { recursive: true })
  const summaries = []
  for (const agency of agencies.values()) summaries.push({ agencyId: agency.id, ...await prepareRoadFeed({
    manifest: { stops, metadata }, trains: agency.trains, output: join(output, agency.id),
    agency: { id: agency.id, name: agency.name, url: metadata.sourceUrl },
  }) })
  await save(join(output, 'index.json'), { metadata, agencies: summaries })
  return summaries
}

// A route-specific pair is reusable only when ALL complete input patterns
// containing it have a valid, byte-identical road path. Never select a successful
// branch while hiding another branch's failed or differently routed occurrence.
export function roadConsensus(cache, limits) {
  assert.equal(cache.schemaVersion, 1)
  const candidates = new Map()
  for (const [agencyId, agency] of Object.entries(cache.agencies)) {
    assert.equal(agency.cache.metadata.sourceSha256, LUZERN_ROAD_SOURCE.osmSha256)
    assert.equal(agency.cache.metadata.matcher.patternsSha256, agency.patternsSha256)
    assert.deepEqual(Object.keys(agency.identities).sort(), Object.keys(agency.cache.patterns).sort())
    for (const [patternId, identity] of Object.entries(agency.identities)) {
      const segments = agency.cache.patterns[patternId], stops = identity.stops
      const train = { routeId: identity.routeId, stops: stops.map((_, i) => [i]) }
      assert.equal(roadPatternId(train, stops), patternId, 'Road pattern identity changed')
      assert.equal(segments.length, stops.length - 1)
      for (let i = 0; i < segments.length; i++) {
        const key = JSON.stringify([identity.routeId, stops[i][4], stops[i + 1][4]])
        const candidate = candidates.get(key) ?? { key, agencyId, patternIds: new Set(), signatures: new Map(), failures: new Set(), occurrences: 0 }
        assert.equal(candidate.agencyId, agencyId)
        candidate.patternIds.add(patternId); candidate.occurrences++
        const index = segments[i]
        if (index === null) candidate.failures.add('road-matcher-rejected')
        else {
          assert(Number.isInteger(index) && index >= 0 && agency.cache.paths[index]?.length >= 2, 'Invalid road path reference')
          const original = agency.cache.paths[index]
          assert(original.every(p => p.length === 2 && p.every(Number.isFinite)), 'Invalid road coordinate')
          assert(distanceMetres(original[0], stops[i]) < 0.2 && distanceMetres(original.at(-1), stops[i + 1]) < 0.2, 'Changed road endpoints')
          const path = original.map(p => [...p])
          path[0] = stops[i].slice(0, 2).map(n => Number(n.toFixed(7)))
          path[path.length - 1] = stops[i + 1].slice(0, 2).map(n => Number(n.toFixed(7)))
          const length = path.slice(1).reduce((sum, p, j) => sum + distanceMetres(path[j], p), 0), direct = distanceMetres(stops[i], stops[i + 1])
          if (length > Math.max(limits.detourFloorMetres, direct * limits.detourRatio)) candidate.failures.add('road-excessive-detour')
          else if (length < 1 || (direct > 150 && length < direct * 0.5)) candidate.failures.add('road-collapsed-path')
          else candidate.signatures.set(sha256(JSON.stringify(path)), { path, lengthMetres: length, directMetres: direct })
        }
        candidates.set(key, candidate)
      }
    }
  }
  return new Map([...candidates].map(([key, c]) => {
    const reasons = [...c.failures, ...(c.signatures.size > 1 ? ['road-pattern-dependent-path'] : [])]
    const accepted = !reasons.length && c.signatures.size === 1
    return [key, { ...(accepted ? [...c.signatures.values()][0] : {}), agencyId: c.agencyId,
      geometrySource: 'osm-road-inference', roadPatternIds: [...c.patternIds].sort(), roadContextOccurrences: c.occurrences,
      ...(!accepted ? { reason: reasons.join(';') || 'road-no-path' } : {}), sourceFeatures: [] }]
  }))
}

export function validateLuzernRoadScope(raw, cache) {
  assert.deepEqual(raw.dates, cache.metadata.dates)
  const { stops, agencies } = luzernRoadInputs(raw)
  assert.deepEqual([...agencies.keys()].sort(), Object.keys(cache.agencies).sort())
  for (const [id, agency] of agencies) {
    const expected = [...new Set(agency.trains.map(t => roadPatternId(t, stops)))].sort()
    assert.deepEqual(Object.keys(cache.agencies[id].identities).sort(), expected, 'Road cache must cover every full bus pattern on both dates')
  }
}

export async function importLuzernRoads(prepared, matched, output, evidenceDirectory = 'data/luzern-road-evidence') {
  const input = await json(join(prepared, 'index.json')), agencies = {}
  await mkdir(evidenceDirectory, { recursive: true })
  for (const { agencyId } of input.agencies) {
    const bytes = await readFile(join(prepared, agencyId, 'patterns.json')), patterns = JSON.parse(bytes)
    const cache = await importRoadShapes(join(matched, agencyId), LUZERN_ROAD_SOURCE.description)
    assert.equal(cache.metadata.matcher.patternsSha256, sha256(bytes), 'Matcher did not use prepared feed')
    assert.deepEqual(patterns.metadata, input.metadata)
    const evidence = {}
    for (const name of ['patterns.json', 'matching.log', 'shapes.txt', 'trips.txt', 'stop_times.txt', 'routing-run.json']) evidence[name] = await readFile(join(matched, agencyId, name), 'utf8')
    const evidenceBytes = gzipSync(JSON.stringify(evidence)), file = join(evidenceDirectory, `${agencyId}.json.gz`)
    await writeFile(file, evidenceBytes)
    agencies[agencyId] = { evidence: { file, sha256: sha256(evidenceBytes) }, patternsSha256: sha256(bytes), identities: Object.fromEntries(patterns.patterns.map(p => [p.id, {
      routeId: p.routeId, stops: p.stops.map(([i]) => patterns.stops[i]),
    }])), cache }
  }
  const result = { schemaVersion: 1, metadata: { ...input.metadata, source: LUZERN_ROAD_SOURCE,
    attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', licenseUrl: 'https://www.openstreetmap.org/copyright',
    model: 'Inferred bus road paths; complete-pattern consensus fallback only; not operator-verified' }, agencies }
  await save(output, result)
  return { agencies: Object.keys(agencies).length, patterns: Object.values(agencies).reduce((n, a) => n + Object.keys(a.identities).length, 0) }
}

export async function verifyLuzernRoadEvidence(cache) {
  const temporary = await mkdtemp(join(tmpdir(), 'luzern-road-check-'))
  try {
    for (const [agencyId, agency] of Object.entries(cache.agencies)) {
      const bytes = await readFile(agency.evidence.file)
      assert.equal(sha256(bytes), agency.evidence.sha256, 'Road evidence changed')
      const evidence = JSON.parse(gunzipSync(bytes)), directory = join(temporary, agencyId)
      await mkdir(directory)
      assert.deepEqual(Object.keys(evidence).sort(), ['patterns.json', 'matching.log', 'shapes.txt', 'trips.txt', 'stop_times.txt', 'routing-run.json'].sort())
      for (const [name, contents] of Object.entries(evidence)) await writeFile(join(directory, name), contents)
      assert.deepEqual(await importRoadShapes(directory, LUZERN_ROAD_SOURCE.description), agency.cache, 'Road cache does not reproduce from retained matcher output')
      const input = JSON.parse(evidence['patterns.json'])
      assert.deepEqual(agency.identities, Object.fromEntries(input.patterns.map(p => [p.id, { routeId: p.routeId, stops: p.stops.map(([i]) => input.stops[i]) }])))
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, ...args] = process.argv.slice(2)
  assert(['prepare', 'import'].includes(command), 'Usage: prepare TIMETABLE DIRECTORY | import PREPARED MATCHED CACHE')
  console.log(command === 'prepare' ? await prepareLuzernRoads(...args) : await importLuzernRoads(...args))
}
