import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { parseLuzernRail, luzernRailMatcher } from './luzern-rail-geometry.mjs'
import { hashFile, sha256 } from './valais-timetable.mjs'
import { LUZERN_ROAD_SOURCE, verifyLuzernRoadEvidence } from './luzern-road-geometry.mjs'

export const patternKey = (t, stops) => JSON.stringify([t.routeId, t.directionId, t.stops.map(([i]) => stops[i][4]), t.callPermissions])
export const lengthMetres = p => p.slice(1).reduce((n, point, i) => n + distanceMetres(p[i], point), 0)
export async function loadValaisGeometry(raw, policy, { verifyEvidence = false } = {}) {
  const cache = JSON.parse(await readFile(policy.road.cache, 'utf8'))
  assert.equal(await hashFile(policy.road.cache), policy.road.sha256, 'Changed OSM cache')
  assert.deepEqual(cache.metadata.sourceHashes, raw.sourceHashes)
  assert.deepEqual(cache.metadata.dates, policy.dates)
  assert.equal(cache.metadata.source.osmSha256, LUZERN_ROAD_SOURCE.osmSha256)
  assert.equal(cache.agencies.all.cache.metadata.sourceSha256, LUZERN_ROAD_SOURCE.osmSha256)
  if (verifyEvidence) await verifyLuzernRoadEvidence(cache)
  const routes = new Map(raw.routes.map(r => [r.id, r])), expected = new Set(), road = cache.agencies.all
  for (const day of raw.snapshots) for (const t of day.trains) if (routes.get(t.routeId).mode === 'bus') {
    const id = roadPatternId(t, day.stops); expected.add(id)
    assert.equal(cache.metadata.routeAgencies[t.routeId], routes.get(t.routeId).agencyId)
    assert.deepEqual(road.identities[id], { routeId: t.routeId, stops: t.stops.map(([i]) => day.stops[i]) }, 'Missing or altered full bus pattern')
  }
  assert.deepEqual([...expected].sort(), Object.keys(road.identities).sort(), 'OSM scope must equal every dated bus candidate')
  assert.deepEqual(Object.keys(road.identities).sort(), Object.keys(road.cache.patterns).sort())
  const source = JSON.parse(await readFile(policy.rail.sourceDirectory + '/source.json', 'utf8'))
  assert.equal(await hashFile(policy.rail.sourceDirectory + '/source.json'), policy.rail.sourceMetadataSha256)
  for (const [f, hash] of Object.entries(source.files)) assert.equal(await hashFile(policy.rail.sourceDirectory + '/' + f), hash)
  const xml = gunzipSync(await readFile(policy.rail.sourceDirectory + '/network.xtf.gz'))
  assert.equal(sha256(xml), source.sha256)
  const network = parseLuzernRail(xml.toString(), policy.rail.limits.simplificationMetres)
  assert.equal(network.nodes.size, source.nodes); assert.equal(network.segments.length, source.segments)
  const matchers = new Map(), railInventory = []
  for (const group of policy.rail.groups) {
    const groupRoutes = policy.rail.routes.filter(r => r.group === group.id)
    for (const r of groupRoutes) {
      const real = routes.get(r.routeId)
      assert(real && real.agencyId === r.agencyId && real.name === r.line && real.mode === 'rail', 'Unreviewed rail identity')
    }
    const selected = network.segments.filter(s => group.operators.includes(s.operator))
    const matcher = luzernRailMatcher({ ...network, segments: selected }, { limits: policy.rail.limits, routes: groupRoutes }, policy.dates)
    for (const r of groupRoutes) matchers.set(r.routeId, matcher)
    railInventory.push({ group: group.id, operators: group.operators, routes: groupRoutes.map(r => r.routeId), segments: matcher.sourceInventory })
  }
  return { roadCache: cache, railSource: source, railInventory, match(t, day) {
    const route = routes.get(t.routeId)
    if (route.mode === 'bus') {
      const id = roadPatternId(t, day.stops), segments = road.cache.patterns[id]
      assert.equal(segments.length, t.stops.length - 1)
      return segments.map((index, i) => {
        const evidence = { geometrySource: 'osm-road-inference', roadPatternId: id, agencyId: route.agencyId }
        if (index === null) return { ...evidence, reason: 'road-matcher-rejected' }
        assert(Number.isInteger(index) && road.cache.paths[index]?.length >= 2)
        const path = road.cache.paths[index].map(p => [...p]), a = day.stops[t.stops[i][0]], b = day.stops[t.stops[i+1][0]]
        assert(distanceMetres(path[0], a) < 0.2 && distanceMetres(path.at(-1), b) < 0.2, 'Road endpoints changed')
        path[0] = a.slice(0,2); path[path.length-1] = b.slice(0,2)
        const metres = lengthMetres(path), direct = distanceMetres(a,b)
        if (metres > Math.max(policy.road.limits.detourFloorMetres, direct * policy.road.limits.detourRatio)) return { ...evidence, reason: 'road-excessive-detour', pathMetres: metres, directMetres: direct }
        if (metres < 1) return { ...evidence, reason: 'road-collapsed-path' }
        return { ...evidence, path, pathMetres: metres, directMetres: direct }
      })
    }
    if (route.mode === 'rail' && matchers.has(t.routeId)) {
      const stops = new Map(day.stops.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
      return matchers.get(t.routeId).match({ routeId: t.routeId, calls: t.stops.map(([i]) => ({ id: day.stops[i][4] })) }, stops,
        { agencyId: route.agencyId, line: route.name }).map((r,i) => {
          if (r.path) { r.path[0] = day.stops[t.stops[i][0]].slice(0,2); r.path[r.path.length-1] = day.stops[t.stops[i+1][0]].slice(0,2) }
          const rejected = policy.rail.rejectedSegments?.find(e => e.patternId === sha256(patternKey(t, day.stops)).slice(0,24) && e.segmentIndex === i)
          if (rejected && r.path) { assert.equal(sha256(JSON.stringify(r.path)), rejected.geometrySha256); const { path, ...evidence } = r; return { ...evidence, candidateGeometrySha256: sha256(JSON.stringify(path)), reason: rejected.reason, review: rejected.review } }
          return r
        })
    }
    return t.stops.slice(1).map(() => ({ reason: route.mode === 'rail' ? 'rail-unreviewed-infrastructure' : `no-reviewed-${route.mode}-geometry` }))
  } }
}

export function applyValaisGeometry(day, geometry) {
  const paths = [], pathMap = new Map(), patterns = new Map(), pairs = new Map(), trains = []
  for (const t of day.trains) {
    const key = patternKey(t, day.stops)
    if (!patterns.has(key)) {
      const segments = geometry.match(t, day)
      assert.equal(segments.length, t.stops.length-1)
      const results = segments.map(({path, ...evidence}) => {
        let pathIndex = null
        if (path) { const s = JSON.stringify(path); if (!pathMap.has(s)) { pathMap.set(s, paths.length); paths.push(path) } pathIndex = pathMap.get(s) }
        return { ...evidence, pathIndex, geometrySha256: path ? sha256(JSON.stringify(path)) : null }
      })
      const reasons = [...new Set(results.filter(r=>r.pathIndex===null).map(r=>r.reason)), ...(t.reservationRequired ? ['prior-arrangement-call'] : [])]
      patterns.set(key, { id: sha256(key).slice(0,24), routeId:t.routeId, agencyId:t.agencyId, line:t.route, directionId:t.directionId,
        stopIds:t.stops.map(([i])=>day.stops[i][4]), stopNames:t.stops.map(([i])=>day.stops[i][2]), callPermissions:t.callPermissions,
        results, reasons, trips:0, admittedTrips:0, matchedSegments:results.filter(r=>r.pathIndex!==null).length, segmentCount:results.length })
    }
    const pattern=patterns.get(key), admitted=!pattern.reasons.length
    pattern.trips++; pattern.admittedTrips+=Number(admitted)
    for (let i=0;i<pattern.results.length;i++) {
      const result=pattern.results[i], fromId=pattern.stopIds[i], toId=pattern.stopIds[i+1], pairKey=JSON.stringify([t.routeId,fromId,toId])
      const pair=pairs.get(pairKey)??{routeId:t.routeId,agencyId:t.agencyId,line:t.route,fromId,toId,from:pattern.stopNames[i],to:pattern.stopNames[i+1],occurrences:0,matchedOccurrences:0,admittedOccurrences:0,patternIds:new Set(),geometryHashes:new Set(),reasons:new Set()}
      pair.occurrences++;pair.matchedOccurrences+=Number(result.pathIndex!==null);pair.admittedOccurrences+=Number(admitted);pair.patternIds.add(pattern.id)
      if(result.geometrySha256)pair.geometryHashes.add(result.geometrySha256)
      if(result.reason)pair.reasons.add(result.reason)
      pairs.set(pairKey,pair)
    }
    trains.push({...t,patternId:pattern.id,pathSegments:pattern.results.map(r=>r.pathIndex),geometrySources:[...new Set(pattern.results.map(r=>r.geometrySource).filter(Boolean))],admission:admitted?'admitted':pattern.reasons.join(';')})
  }
  return {trains,paths,patterns:[...patterns.values()],pairs:[...pairs.values()].map(p=>({...p,patternIds:[...p.patternIds],geometryHashes:[...p.geometryHashes],reasons:[...p.reasons],allContextsMatched:p.matchedOccurrences===p.occurrences}))}
}
