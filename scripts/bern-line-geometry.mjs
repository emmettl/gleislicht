import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { bernWgs84 } from './bern-spatial.mjs'

export const BERN_LIMITS = {
  bus: { snapMetres: 80, detourRatio: 4.5, detourFloorMetres: 1200, alternativeSnapMetres: 5 },
  tram: { snapMetres: 80, detourRatio: 4.5, detourFloorMetres: 1200, alternativeSnapMetres: 5 },
  rail: { snapMetres: 120, detourRatio: 4.5, detourFloorMetres: 3000, alternativeSnapMetres: 5 },
  cableway: { snapMetres: 80, detourRatio: 4.5, detourFloorMetres: 1200, alternativeSnapMetres: 5 },
  funicular: { snapMetres: 80, detourRatio: 4.5, detourFloorMetres: 1200, alternativeSnapMetres: 5 },
  ferry: { snapMetres: 150, detourRatio: 4.5, detourFloorMetres: 1200, alternativeSnapMetres: 5 },
}
const modes = { 1: ['rail'], 2: ['bus'], 3: ['bus'], 4: ['tram'], 5: ['cableway', 'funicular'], 6: ['ferry'] }

export function bernLineNumbers(value) {
  // R61/62 is two numbers with the same prefix; R30/R34 and RE2 / RE3
  // are independent tokens. Do not use substring or number-only matching.
  let prefix = ''
  return String(value).trim().split('/').map(s => {
    s = s.trim()
    const match = /^([A-Z]+)(\d+)$/.exec(s)
    if (match) prefix = match[1]
    else if (/^\d+$/.test(s) && prefix) s = prefix + s
    return s
  }).filter(Boolean)
}

export function bernFeatureMatch(route, feature, crosswalk) {
  const p = feature.properties, override = crosswalk.featureOverrides?.[p.liniencode]
  if (!modes[p.vkmtyp]?.includes(route.mode)) return false
  const agencyIds = override?.agencyIds ?? (p.tucode === 'Moonliner' ? crosswalk.nightOperators[p.tuname] : crosswalk.operators[p.tucode]) ?? []
  if (!agencyIds.includes(route.agencyId)) return false
  if (override) return override.allLines || override.lines.includes(route.name)
  if ([5, 6].includes(p.vkmtyp)) return p.kubunr === route.name
  const numbers = bernLineNumbers(p.liniennr)
  if (numbers.includes(route.name)) return true
  // Extended GTFS type 116 is a rack railway; OEVTP includes R in its
  // passenger label while the GTFS uses the numeric line on these records.
  return route.type === 116 && numbers.includes(`R${route.name}`)
}

export function bernGraph(features) {
  const graph = { points: [], indexes: new Map(), adjacency: [], edges: [], parts: [] }
  const index = (point, original) => {
    // Topology uses exact source LV95 coordinates. Output rounding must not
    // merge close but distinct source vertices, even a few millimetres apart.
    const key = original.join(',')
    if (!graph.indexes.has(key)) {
      graph.indexes.set(key, graph.points.length); graph.points.push(point); graph.adjacency.push([])
    }
    return graph.indexes.get(key)
  }
  for (const feature of features) {
    assert(['LineString', 'MultiLineString'].includes(feature.geometry.type))
    const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const line of lines) {
      assert(line.length >= 2)
      const points = line.map(point => {
        assert(point.length === 2 && point.every(Number.isFinite) && point[0] > 2400000 && point[0] < 2900000 && point[1] > 1000000 && point[1] < 1400000, 'Invalid Bern LV95 coordinate')
        return bernWgs84(point)
      })
      const part = []
      for (let i = 1; i < points.length; i++) {
        const a = index(points[i - 1], line[i - 1]), b = index(points[i], line[i])
        if (a === b) continue
        const length = distanceMetres(graph.points[a], graph.points[b]), edge = { a, b, length }
        graph.edges.push(edge); part.push(edge)
        // Undirected source centrelines. Direction is from ordered GTFS calls,
        // never asserted to be a legal road direction or a specific rail track.
        graph.adjacency[a].push([b, length]); graph.adjacency[b].push([a, length])
      }
      if (part.length) graph.parts.push(part)
    }
  }
  return graph
}

export function bernPatternId(train, stops) {
  return createHash('sha256').update(JSON.stringify([train.routeId, train.directionId,
    train.stops.map(([i]) => stops[i][4])])).digest('hex').slice(0, 24)
}

export function bernAdmission(train, pattern) {
  if (train.reservationRequired) return 'reservation-or-demand-responsive'
  if (!pattern.sourceLines.length) return 'no-verified-operator-line-crosswalk'
  if (pattern.matchedSegments !== pattern.segmentCount) return 'incomplete-directed-pattern'
  return 'admitted'
}

export function applyBernGeometry(raw, routes, source, crosswalk, { featureMatch = bernFeatureMatch, limits = BERN_LIMITS, lineId = f => f.properties.liniencode } = {}) {
  const paths = [], pathIndexes = new Map(), pairs = new Map(), patterns = new Map(), graphs = new Map()
  const routeCrosswalk = [...routes.values()].map(route => {
    const features = source.lines.filter(f => featureMatch(route, f, crosswalk))
    const sourceLines = features.map(lineId).sort()
    return { routeId: route.id, agencyId: route.agencyId, line: route.name, mode: route.mode, sourceLines, features }
  })
  const byRoute = new Map(routeCrosswalk.map(item => [item.routeId, item]))
  const trains = raw.trains.map(train => {
    const route = routes.get(train.routeId), cross = byRoute.get(train.routeId)
    const patternId = bernPatternId(train, raw.stops)
    if (!patterns.has(patternId)) {
      const graphKey = cross.sourceLines.join('|')
      if (cross.sourceLines.length && !graphs.has(graphKey)) graphs.set(graphKey, bernGraph(cross.features))
      const graph = graphs.get(graphKey)
      const pairKeys = [], pathSegments = train.stops.slice(1).map(([toIndex], i) => {
        const from = raw.stops[train.stops[i][0]], to = raw.stops[toIndex]
        const key = JSON.stringify([train.routeId, from[4], to[4]])
        pairKeys.push(key)
        if (!pairs.has(key)) {
          const match = matchBaselSegment(graph, from, to, limits[route.mode])
          let pathIndex = null
          if (match.path) {
            const signature = JSON.stringify(match.path)
            if (!pathIndexes.has(signature)) { pathIndexes.set(signature, paths.length); paths.push(match.path) }
            pathIndex = pathIndexes.get(signature)
          }
          const { path: _path, ...assessment } = match
          pairs.set(key, { routeId: train.routeId, agencyId: route.agencyId, mode: route.mode,
            fromId: from[4], toId: to[4], from: from[2], to: to[2], ...assessment, pathIndex, occurrences: 0, admittedOccurrences: 0 })
        }
        return pairs.get(key).pathIndex
      })
      patterns.set(patternId, { id: patternId, routeId: train.routeId, agencyId: route.agencyId, mode: route.mode, line: train.route,
        directionId: train.directionId, stopIds: train.stops.map(([i]) => raw.stops[i][4]), sourceLines: cross.sourceLines,
        segmentCount: pathSegments.length, matchedSegments: pathSegments.filter(i => i !== null).length,
        pathSegments, pairKeys, trips: 0, admittedTrips: 0, carryInTrips: 0, representativeHeadwayTrips: 0, decisions: {} })
    }
    const pattern = patterns.get(patternId), decision = bernAdmission(train, pattern)
    pattern.trips++; pattern.admittedTrips += Number(decision === 'admitted')
    pattern.carryInTrips += Number(train.sourceServiceDate !== raw.metadata.serviceDate)
    pattern.representativeHeadwayTrips += Number(train.frequency?.exactTimes === 0)
    pattern.decisions[decision] = (pattern.decisions[decision] ?? 0) + 1
    for (const key of pattern.pairKeys) {
      const pair = pairs.get(key); pair.occurrences++; pair.admittedOccurrences += Number(decision === 'admitted')
    }
    return { ...train, patternId, admission: decision, pathSegments: pattern.pathSegments }
  })
  return { trains, paths, pairs: [...pairs.values()], patterns: [...patterns.values()].map(({ pairKeys: _keys, ...p }) => p),
    routeCrosswalk: routeCrosswalk.map(({ features: _features, ...item }) => item) }
}
