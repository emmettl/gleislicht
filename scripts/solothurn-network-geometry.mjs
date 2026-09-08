import assert from 'node:assert/strict'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { bernWgs84 } from './bern-spatial.mjs'
import { bernPatternId } from './bern-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export const SO_MODES = { Bus: 'bus', Bahn: 'rail', Seilbahn: 'cableway' }
export const SO_LIMITS = {
  bus: { snapMetres: 60, detourRatio: 3, detourFloorMetres: 600, alternativeSnapMetres: 5 },
  rail: { snapMetres: 120, detourRatio: 3, detourFloorMetres: 1500, alternativeSnapMetres: 5 },
  cableway: { snapMetres: 80, detourRatio: 2, detourFloorMetres: 500, alternativeSnapMetres: 5 },
}
export function solothurnNight(route) {
  return route.type === 705 || /^(?:SN|[MN])\d/i.test(route.name) || /moonliner|nachtbus|nachtlinie|night bus/i.test(`${route.agency} ${route.longName}`)
}

export function solothurnGraphs(features, { joinEndpointInteriors = true } = {}) {
  const graphs = new Map(), endpoints = new Map()
  for (const feature of features) {
    if (feature.properties.tunnel) continue
    const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const line of lines) for (const xy of [line[0], line.at(-1)]) {
      const key = `${feature.properties.verkehrsmittel}:${xy.join(',')}`
      const ids = endpoints.get(key) ?? new Set()
      ids.add(feature.properties.T_Ili_Tid); endpoints.set(key, ids)
    }
  }
  for (const feature of features) {
    const mode = SO_MODES[feature.properties.verkehrsmittel]
    assert(mode, 'Unreviewed Solothurn source mode')
    assert(['LineString', 'MultiLineString'].includes(feature.geometry.type))
    const graph = graphs.get(mode) ?? { points: [], indexes: new Map(), adjacency: [], edges: [], parts: [], sourceIds: [], tunnelRecords: 0, endpointInteriorJunctions: [] }
    graph.sourceIds.push(feature.properties.T_Ili_Tid)
    graph.tunnelRecords += Number(feature.properties.tunnel)
    const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const [partId, line] of lines.entries()) {
      assert(line.length >= 2)
      const indexes = line.map((xy, i) => {
        assert(xy.length === 2 && xy.every(Number.isFinite) && xy[0] > 2400000 && xy[0] < 2900000 && xy[1] > 1000000 && xy[1] < 1400000)
        // A source endpoint at another feature's exact interior vertex is a
        // supported T-junction. Never invent an interior/interior crossing,
        // stitch a nearby coordinate, or node a tunnel interior onto surface.
        const isEndpoint = i === 0 || i === line.length - 1
        const endpointIds = endpoints.get(`${feature.properties.verkehrsmittel}:${xy.join(',')}`)
        const joinInterior = joinEndpointInteriors && !isEndpoint && !feature.properties.tunnel
          && endpointIds && [...endpointIds].some(id => id !== feature.properties.T_Ili_Tid)
        if (joinInterior) graph.endpointInteriorJunctions.push({ coordinate: xy,
          interiorFeature: feature.properties.T_Ili_Tid, part: partId, vertex: i,
          endpointFeatures: [...endpointIds].filter(id => id !== feature.properties.T_Ili_Tid).sort() })
        const key = isEndpoint || joinInterior ? xy.join(',') : `${feature.properties.T_Ili_Tid}:${partId}:${i}`
        if (!graph.indexes.has(key)) {
          graph.indexes.set(key, graph.points.length)
          graph.points.push(bernWgs84(xy)); graph.adjacency.push([])
        }
        return graph.indexes.get(key)
      })
      const part = []
      for (let i = 1; i < indexes.length; i++) {
        const a = indexes[i - 1], b = indexes[i], length = distanceMetres(graph.points[a], graph.points[b])
        if (a === b || length === 0) continue
        const edge = { a, b, length, sourceId: feature.properties.T_Ili_Tid, tunnel: feature.properties.tunnel }
        graph.edges.push(edge); part.push(edge)
        graph.adjacency[a].push([b, length]); graph.adjacency[b].push([a, length])
      }
      if (part.length) graph.parts.push(part)
    }
    graphs.set(mode, graph)
  }
  for (const graph of graphs.values()) {
    const seen = new Set(), components = []
    for (let i = 0; i < graph.points.length; i++) {
      if (seen.has(i)) continue
      const queue = [i]; seen.add(i)
      for (let j = 0; j < queue.length; j++) for (const [next] of graph.adjacency[queue[j]]) if (!seen.has(next)) { seen.add(next); queue.push(next) }
      components.push(queue.length)
    }
    graph.topology = { sourceRecords: graph.sourceIds.length, tunnelRecords: graph.tunnelRecords,
      vertices: graph.points.length, edges: graph.edges.length, parts: graph.parts.length,
      endpointInteriorJunctions: graph.endpointInteriorJunctions,
      components: components.length, componentVertices: components.sort((a, b) => b - a) }
  }
  return graphs
}

export function solothurnAdmission(train, route, pattern) {
  if (solothurnNight(route) && pattern.matchedSegments !== pattern.segmentCount) return 'night-network-excluded-by-source'
  if (train.reservationRequired) return 'reservation-or-demand-responsive'
  if (!SO_LIMITS[route.mode] && !pattern.supplementAvailable) return 'no-compatible-source-mode'
  if (pattern.matchedSegments !== pattern.segmentCount) return 'incomplete-directed-pattern'
  return 'admitted'
}

export function applySolothurnGeometry(raw, routes, graphs, matchCache = new Map(), supplements) {
  const paths = [], pathIndexes = new Map(), pairs = new Map(), patterns = new Map()
  const trains = raw.trains.map(train => {
    const route = routes.get(train.routeId), patternId = bernPatternId(train, raw.stops)
    if (!patterns.has(patternId)) {
      const pairKeys = [], pathSegments = train.stops.slice(1).map(([toIndex], i) => {
        const from = raw.stops[train.stops[i][0]], to = raw.stops[toIndex]
        const key = JSON.stringify([route.id, from[4], to[4]])
        pairKeys.push(key)
        if (!pairs.has(key)) {
          const cacheKey = JSON.stringify([route.mode, solothurnNight(route), from[4], to[4], from.slice(0, 2), to.slice(0, 2)])
          if (!matchCache.has(cacheKey)) matchCache.set(cacheKey, solothurnNight(route) ? { reason: 'night-network-excluded-by-source' }
            : !SO_LIMITS[route.mode] ? { reason: 'no-compatible-source-mode' }
              : matchBaselSegment(graphs.get(route.mode), from, to, SO_LIMITS[route.mode]))
          const primary = matchCache.get(cacheKey)
          const fallback = !primary.path ? supplements?.match(route, from, to) : undefined
          const selected = fallback?.path ? { ...fallback, primaryReason: primary.reason }
            : { ...primary, ...(primary.path ? { geometrySource: 'solothurn-network' } : {}), ...(fallback ? { supplementFailure: fallback.reason, supplementAvailable: true } : {}) }
          const { path, ...assessment } = selected
          let pathIndex = null
          if (path) {
            const signature = JSON.stringify(path)
            if (!pathIndexes.has(signature)) { pathIndexes.set(signature, paths.length); paths.push(path) }
            pathIndex = pathIndexes.get(signature)
          }
          pairs.set(key, { routeId: route.id, agencyId: route.agencyId, mode: route.mode, fromId: from[4], toId: to[4],
            from: from[2], to: to[2], directMetres: distanceMetres(from, to), ...assessment, pathIndex, occurrences: 0, admittedOccurrences: 0 })
        }
        return pairs.get(key).pathIndex
      })
      patterns.set(patternId, { id: patternId, routeId: route.id, agencyId: route.agencyId, mode: route.mode, line: route.name,
        directionId: train.directionId, stopIds: train.stops.map(([i]) => raw.stops[i][4]), segmentCount: pathSegments.length,
        supplementAvailable: pairKeys.some(key => pairs.get(key).supplementAvailable || (pairs.get(key).geometrySource && pairs.get(key).geometrySource !== 'solothurn-network')),
        geometrySources: [...new Set(pairKeys.map(key => pairs.get(key).geometrySource).filter(Boolean))].sort(),
        matchedSegments: pathSegments.filter(i => i !== null).length, pathSegments, pairKeys,
        trips: 0, admittedTrips: 0, carryInTrips: 0, representativeHeadwayTrips: 0, decisions: {} })
    }
    const pattern = patterns.get(patternId), admission = solothurnAdmission(train, route, pattern)
    pattern.trips++; pattern.admittedTrips += Number(admission === 'admitted')
    pattern.carryInTrips += Number(train.sourceServiceDate !== raw.metadata.serviceDate)
    pattern.representativeHeadwayTrips += Number(train.frequency?.exactTimes === 0)
    pattern.decisions[admission] = (pattern.decisions[admission] ?? 0) + 1
    for (const key of pattern.pairKeys) { const pair = pairs.get(key); pair.occurrences++; pair.admittedOccurrences += Number(admission === 'admitted') }
    return { ...train, patternId, admission, pathSegments: pattern.pathSegments }
  })
  return { trains, paths, pairs: [...pairs.values()], patterns: [...patterns.values()].map(({ pairKeys: _keys, ...p }) => p) }
}
