import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { prepareRoadFeed, roadPatternId } from './prepare-postbus-road-feed.mjs'
import { importLuzernRoads, roadConsensus, verifyLuzernRoadEvidence, LUZERN_ROAD_SOURCE } from './luzern-road-geometry.mjs'
import { hashFile } from './fribourg-timetable.mjs'
import { loadMontCarmel } from './fribourg-mont-carmel.mjs'
import { loadJongny } from './fribourg-jongny.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
export const FRIBOURG_ROAD_LIMITS = { detourRatio: 3, detourFloorMetres: 600 }

export function fribourgRoadInputs(timetable) {
  const routes = new Map(timetable.routes.map(r => [r.id, r])), stops = [], indexes = new Map(), agencies = new Map()
  for (const day of timetable.snapshots) for (const train of day.trains) {
    const route = routes.get(train.routeId)
    if (route.mode !== 'bus') continue
    assert.equal(train.agencyId, route.agencyId)
    const agency = agencies.get(route.agencyId) ?? { id: route.agencyId, name: route.agency, trains: [] }
    // Only the routing input is shifted; emitted journeys retain original times.
    const shift = Math.max(0, Math.ceil(-train.stops[0][1] / 86400) * 86400)
    agency.trains.push({ ...train, id: `${day.metadata.serviceDate}:${train.id}`, stops: train.stops.map(([i, a, d]) => {
      const stop = day.stops[i], key = JSON.stringify(stop)
      if (!indexes.has(key)) { indexes.set(key, stops.length); stops.push(stop) }
      return [indexes.get(key), a + shift, d + shift]
    }) })
    agencies.set(agency.id, agency)
  }
  return { stops, agencies }
}

export async function prepareFribourgRoads(timetablePath, output) {
  const timetable = JSON.parse(gunzipSync(await readFile(timetablePath))), { stops, agencies } = fribourgRoadInputs(timetable)
  const metadata = { ...timetable.snapshots[0].metadata, dates: timetable.snapshots.map(s => s.metadata.serviceDate),
    timetableSha256: await hashFile(timetablePath), sourceHashes: timetable.sourceHashes,
    scope: 'Every full Fribourg-calling bus pattern on both civil dates, including night and replacement buses; exact agency, route, platform IDs and coordinates retained.' }
  await mkdir(output, { recursive: true })
  const summaries = []
  for (const agency of agencies.values()) summaries.push({ agencyId: agency.id, ...await prepareRoadFeed({
    manifest: { metadata, stops }, trains: agency.trains, output: join(output, agency.id), agency: { ...agency, url: metadata.sourceUrl },
  }) })
  await writeFile(join(output, 'index.json'), JSON.stringify({ metadata, agencies: summaries }, null, 2) + '\n')
  return summaries
}

export function validateFribourgRoadScope(timetable, cache) {
  assert.deepEqual(cache.metadata.dates, timetable.snapshots.map(s => s.metadata.serviceDate))
  assert.deepEqual(cache.metadata.sourceHashes, timetable.sourceHashes)
  const { stops, agencies } = fribourgRoadInputs(timetable)
  assert.deepEqual([...agencies.keys()].sort(), Object.keys(cache.agencies).sort())
  for (const [id, agency] of agencies) {
    assert.deepEqual([...new Set(agency.trains.map(t => roadPatternId(t, stops)))].sort(), Object.keys(cache.agencies[id].identities).sort(), 'Missing or extra full Fribourg road pattern')
  }
}

export async function loadFribourgRoads(timetable, policy, { verifyEvidence = false } = {}) {
  const cache = await json(policy.cacheFile)
  assert.equal(await hashFile(policy.cacheFile), policy.cacheSha256, 'Changed Fribourg road cache')
  assert.equal(await hashFile(policy.configFile), policy.configSha256, 'Changed Fribourg matcher configuration')
  assert.deepEqual(cache.metadata.source, LUZERN_ROAD_SOURCE)
  if (timetable) validateFribourgRoadScope(timetable, cache)
  for (const agency of Object.values(cache.agencies)) {
    assert.equal(agency.cache.metadata.matcher.configSha256, policy.configSha256)
    assert.equal(agency.cache.metadata.matcher.binarySha256, policy.binarySha256)
    assert.equal(await hashFile(agency.evidence.file), agency.evidence.sha256, 'Changed retained road evidence')
  }
  if (verifyEvidence) await verifyLuzernRoadEvidence(cache)
  assert.deepEqual(policy.limits, FRIBOURG_ROAD_LIMITS)
  const baseline = roadConsensus(cache, policy.limits)
  const review = policy.montCarmel ? await loadMontCarmel(cache, baseline, policy.montCarmel) : undefined
  const jongny = policy.jongny ? await loadJongny(cache, review?.candidates ?? baseline, policy.jongny) : undefined
  return { candidates: jongny?.candidates ?? review?.candidates ?? baseline, ...(review ? { montCarmel: review.audit } : {}), ...(jongny ? { jongny: jongny.audit } : {}), metadata: cache.metadata, policy,
    inventory: Object.entries(cache.agencies).flatMap(([agencyId, agency]) => Object.entries(agency.identities).map(([id, identity]) => ({ id, agencyId, ...identity }))),
    patterns: Object.values(cache.agencies).reduce((n, a) => n + Object.keys(a.identities).length, 0) }
}

export function applyFribourgRoads(result, routes, roads) {
  if (!roads) return result
  const indexes = new Map(result.paths.map((p, i) => [JSON.stringify(p), i]))
  const pairs = new Map(result.pairs.map(p => [JSON.stringify([p.routeId, p.fromId, p.toId]), p]))
  for (const [key, pair] of pairs) {
    if (pair.mode !== 'bus' || pair.pathIndex !== null) continue
    const road = roads.candidates.get(key)
    assert(road, 'Road census missing a directed bus pair')
    assert.equal(road.agencyId, pair.agencyId)
    const { path, ...assessment } = road
    const officialFailure = { ...pair }
    pair.roadFallback = assessment
    if (!path) continue
    const signature = JSON.stringify(path)
    if (!indexes.has(signature)) { indexes.set(signature, result.paths.length); result.paths.push(path) }
    pair.officialFailure = officialFailure
    delete pair.reason
    pair.pathIndex = indexes.get(signature); pair.pathMetres = road.lengthMetres
    pair.maximumSnapMetres = null; pair.roadSnapLimitMetres = 120
    pair.geometrySource = 'osm-road-inference'
  }
  for (const pattern of result.patterns) {
    pattern.officialMatchedSegments = pattern.matchedSegments
    pattern.pathSegments = pattern.stopIds.slice(1).map((to, i) => pairs.get(JSON.stringify([pattern.routeId, pattern.stopIds[i], to])).pathIndex)
    pattern.matchedSegments = pattern.pathSegments.filter(i => i !== null).length
    pattern.roadSegments = pattern.stopIds.slice(1).filter((to, i) => pairs.get(JSON.stringify([pattern.routeId, pattern.stopIds[i], to])).geometrySource === 'osm-road-inference').length
    pattern.roadReviewKinds = [...new Set(pattern.stopIds.slice(1).map((to, i) => pairs.get(JSON.stringify([pattern.routeId, pattern.stopIds[i], to])).roadFallback?.roadReview?.kind).filter(Boolean))].sort()
    pattern.admittedTrips = 0; pattern.decisions = {}
  }
  for (const pair of pairs.values()) pair.admittedOccurrences = 0
  const patterns = new Map(result.patterns.map(p => [p.id, p]))
  for (const train of result.trains) {
    const pattern = patterns.get(train.patternId), route = routes.get(train.routeId)
    train.pathSegments = pattern.pathSegments
    if (route.mode === 'bus' && pattern.roadSegments) {
      train.admission = train.reservationRequired ? 'reservation-or-demand-responsive'
        : route.type === 715 ? 'demand-responsive-route-type'
          : pattern.matchedSegments === pattern.segmentCount ? 'admitted' : 'incomplete-directed-pattern'
      train.geometrySource = 'cantonal-lines-with-osm-road-inference'
      train.roadSegmentCount = pattern.roadSegments
      if (pattern.roadReviewKinds.length) train.roadReviewKinds = pattern.roadReviewKinds
    }
    if (roads.policy.excludedRouteIds.includes(train.routeId)) train.admission = 'provisional-boundary-membership'
    if (route.mode === 'bus' && route.type === 715) train.admission = 'demand-responsive-route-type'
    const admitted = train.admission === 'admitted'
    pattern.admittedTrips += Number(admitted)
    pattern.decisions[train.admission] = (pattern.decisions[train.admission] ?? 0) + 1
    for (let i = 1; i < pattern.stopIds.length; i++) pairs.get(JSON.stringify([pattern.routeId, pattern.stopIds[i - 1], pattern.stopIds[i]])).admittedOccurrences += Number(admitted)
  }
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'prepare') console.log(await prepareFribourgRoads(...args))
  else if (command === 'import') console.log(await importLuzernRoads(args[0], args[1], 'data/fribourg-road-cache.json', 'data/fribourg-road-evidence'))
  else throw new Error('Usage: prepare TIMETABLE DIRECTORY | import PREPARED MATCHED')
}
