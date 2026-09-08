import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { baselGraphs, matchBaselSegment } from './basel-line-geometry.mjs'
import { bernGraph, bernPatternId } from './bern-line-geometry.mjs'
import { loadSolothurnCorridors } from './solothurn-corridor-geometry.mjs'
import { loadSolothurnS29Precedence } from './solothurn-s29-precedence.mjs'
import { loadSolothurnRailReview } from './solothurn-rail-review.mjs'
import { loadZugRail } from './zug-rail-geometry.mjs'
import { loadSolothurnAccessRoads } from './solothurn-access-roads.mjs'
import { loadSolothurnDelleRail } from './solothurn-delle-rail.mjs'
import { loadSolothurnSimplonRail } from './solothurn-simplon-rail.mjs'
import { loadSolothurnComoRail } from './solothurn-como-rail.mjs'
import { loadSolothurnS26Review } from './solothurn-s26-review.mjs'
import { loadSolothurnBernTerminal } from './solothurn-bern-terminal.mjs'
import { loadSolothurnBusJunction } from './solothurn-bus-junction.mjs'
import { loadSolothurnRoads } from './solothurn-road-geometry.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const keyOf = (route, from, to) => JSON.stringify([route.id, from[4], to[4]])

// A supplement cannot choose whichever full stop context happens to succeed.
// Agree across all observed complete patterns or leave this pair unresolved.
export function supplementConsensus(candidates) {
  return new Map([...candidates].map(([key, results]) => {
    const signatures = new Map(results.filter(r => r.path).map(r => [sha(r.path), r]))
    const failures = results.filter(r => !r.path).map(r => r.reason ?? 'supplement-no-path')
    return [key, !failures.length && signatures.size === 1 ? { ...[...signatures.values()][0], contextCount: results.length }
      : { reason: failures.length ? [...new Set(failures)].sort().join(';') : 'supplement-pattern-dependent-path', contextCount: results.length }]
  }))
}

export async function loadSolothurnSupplements(timetable, { roads = true, verifyEvidence = false } = {}) {
  const busJunction = await loadSolothurnBusJunction()
  const contextPath = 'data/solothurn-pattern-contexts.json.gz'
  const context = JSON.parse(gunzipSync(await readFile(contextPath)))
  assert.deepEqual(context.sourceHashes, timetable.sourceHashes)
  const policyPath = 'data/solothurn-supplement-policy.json', policy = JSON.parse(await readFile(policyPath))
  for (const config of [policy.boat, policy.tram]) assert.equal(await hashFile(config.file), config.sha256)
  const boat = JSON.parse(await readFile(policy.boat.file)), tramCollection = JSON.parse(gunzipSync(await readFile(policy.tram.file)))
  const graphs = { ferry: bernGraph([boat]), tram: baselGraphs([tramCollection]).get('37:tram:10') }
  assert(graphs.tram)
  const corridors = await loadSolothurnCorridors()
  const s29Precedence = await loadSolothurnS29Precedence(corridors)
  const rail = await loadZugRail(policy.rail, context.snapshots.map(s => s.metadata.serviceDate))
  const delle = await loadSolothurnDelleRail(context)
  const simplon = await loadSolothurnSimplonRail(context)
  const como = await loadSolothurnComoRail(context)
  const s26 = await loadSolothurnS26Review(policy.rail, context.snapshots.map(s => s.metadata.serviceDate))
  const bernTerminal = await loadSolothurnBernTerminal(policy.rail, context.snapshots.map(s => s.metadata.serviceDate))
  const railReview = await loadSolothurnRailReview(policy.rail, context.snapshots.map(s => s.metadata.serviceDate))
  const railIds = new Set(policy.rail.routes.map(r => r.routeId)), routes = new Map(timetable.routes.map(r => [r.id, r]))
  const candidates = new Map(), seen = new Set(), graphCache = new Map()
  for (const raw of context.snapshots) {
    const stops = new Map(raw.stops.map(s => [s[4], { stop_id: s[4], stop_lon: s[0], stop_lat: s[1] }]))
    for (const train of raw.trains) {
      const route = routes.get(train.routeId), id = bernPatternId(train, raw.stops)
      if (seen.has(id) || !['rail', 'ferry', 'tram'].includes(route.mode)) continue
      seen.add(id)
      let results
      if (route.id === '91-11-M-j26-1') results = train.stops.slice(1).map(([index], i) => corridors.match(route, raw.stops[train.stops[i][0]], raw.stops[index]))
      else if (railIds.has(route.id)) results = rail.matchPattern({ ...train, calls: train.stops.map(([i]) => ({ id: raw.stops[i][4] })) }, stops, { ...route, line: route.name })
      else {
        const config = route.mode === 'ferry' ? policy.boat : route.mode === 'tram' ? policy.tram : undefined
        if (!config || config.routeId !== route.id || config.agencyId !== route.agencyId || config.line !== route.name) continue
        results = train.stops.slice(1).map(([index], i) => {
          const from = raw.stops[train.stops[i][0]], to = raw.stops[index], key = keyOf(route, from, to)
          if (!graphCache.has(key)) graphCache.set(key, { ...matchBaselSegment(graphs[route.mode], from, to,
            config.source.limits ?? { snapMetres: 150, detourRatio: 3, detourFloorMetres: 1200, alternativeSnapMetres: 5 }), geometrySource: route.mode === 'ferry' ? 'bern-official-boat-3216' : 'basel-official-tram-10' })
          return graphCache.get(key)
        })
      }
      if (route.mode === 'rail') {
        results = railReview.matchPattern(train, raw.stops, route, results)
        results = bernTerminal.matchPattern(train, raw.stops, route, results)
        results = s26.matchPattern(train, raw.stops, route, results)
        results = como.matchPattern(train, raw.stops, route, results)
        results = simplon.matchPattern(train, raw.stops, route, results)
        results = delle.matchPattern(train, raw.stops, route, results)
      }
      for (const [i, result] of results.entries()) {
        const from = raw.stops[train.stops[i][0]], to = raw.stops[train.stops[i + 1][0]], key = keyOf(route, from, to)
        const list = candidates.get(key) ?? []
        const previous = route.mode === 'rail' ? corridors.match(route, from, to, result) : result
        const selected = s29Precedence.select(route, from, to, previous, { patternId: id, directionId: train.directionId, stopIds: train.stops.map(([j]) => raw.stops[j][4]) })
        list.push({ ...selected, ...(selected.path ? { path: selected.path.map(p => p.slice(0, 2).map(v => Number(v.toFixed(7)))) } : {}), agencyId: route.agencyId })
        candidates.set(key, list)
      }
    }
  }
  const pairs = supplementConsensus(candidates)
  const accessRoads = roads ? await loadSolothurnAccessRoads(context, { verifyEvidence }) : undefined
  let road
  if (roads) {
    road = await loadSolothurnRoads(context, { verifyEvidence })
    for (const [key, value] of road.pairs) pairs.set(key, value)
  }
  return { pairs, policy, s29PrecedenceReview: [...s29Precedence.review.values()], accessRoadReview: accessRoads ? [...accessRoads.all].map(([key, { path, ...assessment }]) => ({ key, ...assessment, pathSha256: path ? sha(path) : null, selected: accessRoads.pairs.has(key) })) : [], metadata: { delle: delle.metadata, simplon: simplon.metadata, como: como.metadata, s26: s26.metadata, bernTerminal: bernTerminal.metadata, ...(accessRoads ? { accessRoads: accessRoads.metadata } : {}), busJunction: busJunction.metadata, s29Precedence: s29Precedence.metadata, railReview: railReview.metadata, corridors: corridors.metadata, contextSha256: await hashFile(contextPath), policySha256: await hashFile(policyPath), boat: policy.boat, tram: policy.tram, rail: { ...rail.source, limits: policy.rail.limits },
    ...(road ? { road: road.metadata, roadCacheSha256: road.sha256 } : {}) },
    match(route, from, to) {
      const previous = busJunction.match(route, from, to, pairs.get(keyOf(route, from, to)))
      const value = accessRoads ? accessRoads.match(route, from, to, previous) : previous
      if (value?.path) assert.equal(value.agencyId, route.agencyId, 'Supplement changed operator identity')
      return value
    } }
}
