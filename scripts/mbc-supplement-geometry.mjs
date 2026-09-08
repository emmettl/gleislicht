import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { assessRoad, distanceMetres } from './enrich-postbus-roads.mjs'

export const MBC_GEOMETRY_SOURCE = 'data/vaud-sources/mbc-terminal-funicular-osm.json'
export const PLANTAZ_PLATFORMS = ['ch:1:sloid:70082:0:301404', 'ch:1:sloid:70082:0:464727']
export async function readMbcGeometrySource() {
  const bytes = await readFile(MBC_GEOMETRY_SOURCE)
  return { source: JSON.parse(bytes), sha256: createHash('sha256').update(bytes).digest('hex') }
}
export function osmSegments(source) {
  const nodes = new Map(source.nodes.map(n => [n.id, [n.lon, n.lat]]))
  return source.ways.map(w => ({ id: String(w.id), start: String(w.nodes[0]), end: String(w.nodes.at(-1)), points: w.nodes.map(id => { assert(nodes.has(id), `Missing OSM node ${id}`); return nodes.get(id) }), tags: w.tags }))
}

// The relation explicitly repeats the approach roads around a complete
// roundabout. Shortest-path routing between these adjacent poles loses this loop.
export function plantazTurnaround(source, from, to) {
  assert.deepEqual([from[4], to[4]], PLANTAZ_PLATFORMS)
  assert.equal(source.terminalRelation.tags['gtfs:route_id'], '92-701-j26-1')
  const ways = new Map(osmSegments(source).map(w => [Number(w.id), w]))
  const ordered = source.terminalRelation.orderedWayIds.map(id => { assert(ways.has(id)); return ways.get(id) })
  assert.equal(ordered.filter(w => w.tags.junction === 'roundabout').length, 1)
  let end, points = []
  for (const [i, way] of ordered.entries()) {
    let forward = i ? way.start === end : [ordered[1].start, ordered[1].end].includes(way.end)
    assert(!i || forward || way.end === end, 'Disconnected terminal relation')
    if (way.tags.junction === 'roundabout') assert(forward && way.start === way.end, 'Roundabout direction changed')
    const part = forward ? way.points : [...way.points].reverse()
    points.push(...(i ? part.slice(1) : part))
    end = forward ? way.end : way.start
  }
  assert(distanceMetres(points[0], points.at(-1)) < .1, 'Incomplete terminal loop')
  const result = assessRoad(points, from, to)
  assert(result.path && result.length > 200, 'Invalid terminal turnaround')
  return result
}

export function repairPlantazCache(cache, input, source, sha256) {
  const result = structuredClone(cache), repaired = []
  for (const pattern of input.patterns) {
    if (pattern.routeId !== '92-701-j26-1') continue
    for (let i = 1; i < pattern.stops.length; i++) {
      const from = input.stops[pattern.stops[i - 1][0]], to = input.stops[pattern.stops[i][0]]
      if (from[4] !== PLANTAZ_PLATFORMS[0] || to[4] !== PLANTAZ_PLATFORMS[1]) continue
      const path = plantazTurnaround(source, from, to)
      const index = result.patterns[pattern.id][i - 1]
      if (index !== null) { assert.deepEqual(result.paths[index], path.path, 'Conflicting terminal repair'); continue }
      const issue = result.report.issues.find(issue => issue.pattern === pattern.id && issue.segment === i - 1)
      assert(issue && issue.trips === pattern.tripCount && issue.reason === 'missing-shape', 'Unexpected matcher rejection')
      result.patterns[pattern.id][i - 1] = result.paths.length
      result.paths.push(path.path)
      result.report.issues = result.report.issues.filter(value => value !== issue)
      result.report.matchedSegments += pattern.tripCount
      result.report.routes.find(route => route.routeId === pattern.routeId).matched += pattern.tripCount
      result.report.maxSnapMetres = Math.max(result.report.maxSnapMetres, path.snap)
      repaired.push({ pattern: pattern.id, segment: i - 1, trips: pattern.tripCount, fromId: from[4], toId: to[4], lengthMetres: path.length, snapMetres: path.snap })
    }
  }
  result.report.coverage = result.report.matchedSegments / result.report.totalSegments
  result.report.rejectedPatternSegments = result.report.issues.length
  if (repaired.length) result.metadata.terminalRepair = { source: MBC_GEOMETRY_SOURCE, sha256, relationId: source.terminalRelation.id, license: source.license, model: 'Ordered OSM route-relation turnaround with short platform connectors; inferred, not operator verified', repaired }
  return result
}
