import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export const AARGAU_RAIL_LIMITS = { stationAttachmentMetres: 350, topologyAttachmentMetres: 120, detourRatio: 4.5, detourAllowanceMetres: 3000, simplificationMetres: 5 }
const lengthOf = points => points.slice(1).reduce((n, p, i) => n + distanceMetres(points[i], p), 0)
export const railStopNumber = id => {
  const sloid = String(id).match(/^ch:1:sloid:(\d+)(?=[:_]|$)/)?.[1]
  return sloid ? `85${sloid.padStart(5, '0')}` : String(id).match(/^(\d{7})(?=[:_]|$)/)?.[1]
}

// Search respects every known scheduled operating point in the full pattern:
// another call cannot be traversed early just because it makes a shorter path.
function shortest(graph, start, end, blocked, maximum) {
  const distances = new Map([[start, 0]]), previous = new Map(), queue = [[0, start]]
  while (queue.length) {
    queue.sort((a, b) => b[0] - a[0])
    const [distance, node] = queue.pop()
    if (distance !== distances.get(node)) continue
    if (node === end) {
      const edges = []
      for (let key = end; key !== start;) { const step = previous.get(key); edges.unshift(step.edge); key = step.node }
      return edges
    }
    for (const edge of graph.get(node) ?? []) {
      if (blocked.has(edge.to) && edge.to !== end) continue
      const next = distance + edge.length
      if (next > maximum || next >= (distances.get(edge.to) ?? Infinity)) continue
      distances.set(edge.to, next); previous.set(edge.to, { node, edge }); queue.push([next, edge.to])
    }
  }
}

export function aargauRailMatcher(network, policy, limits = AARGAU_RAIL_LIMITS) {
  const routes = new Map(policy.routes.map(r => [r.routeId, r])), numbers = new Map(), graph = new Map(), rejectedSourceSegments = []
  for (const node of network.nodes.values()) {
    const candidates = numbers.get(node.number) ?? []; candidates.push(node); numbers.set(node.number, candidates)
  }
  for (const segment of network.segments) {
    const start = network.nodes.get(segment.start), end = network.nodes.get(segment.end)
    assert(start && end && segment.points.length >= 2)
    const forward = distanceMetres(start.coordinate, segment.points[0]) + distanceMetres(end.coordinate, segment.points.at(-1))
    const reverse = distanceMetres(end.coordinate, segment.points[0]) + distanceMetres(start.coordinate, segment.points.at(-1))
    const points = reverse < forward ? [...segment.points].reverse() : segment.points
    const attachment = Math.max(distanceMetres(start.coordinate, points[0]), distanceMetres(end.coordinate, points.at(-1)))
    if (attachment > limits.topologyAttachmentMetres) { rejectedSourceSegments.push({ segmentId: segment.id, reason: 'source-endpoint-outside-topology-limit', attachmentMetres: attachment }); continue }
    // These small explicit operating-point connectors preserve source topology;
    // no nearest-coordinate merge creates an edge between unrelated networks.
    const path = [start.coordinate, ...points, end.coordinate]
    for (const [from, to, p] of [[segment.start, segment.end, path], [segment.end, segment.start, [...path].reverse()]]) {
      const edges = graph.get(from) ?? []
      edges.push({ from, to, segmentId: segment.id, points: p, length: lengthOf(p), attachmentMetres: attachment }); graph.set(from, edges)
    }
  }
  const cache = new Map()
  return { rejectedSourceSegments, matchPattern(train, stops) {
    const route = routes.get(train.routeId), mode = train.mode ?? train.category
    if (mode !== 'rail' || !route || route.agencyId !== train.agencyId || route.line !== train.route) return undefined
    const selected = train.stops.map(([i]) => stops[i])
    const key = JSON.stringify([train.agencyId, train.routeId, train.directionId, selected])
    if (cache.has(key)) return cache.get(key)
    const anchors = selected.map(stop => {
      const number = railStopNumber(stop[4]), candidates = numbers.get(number) ?? []
      if (candidates.length !== 1) return { number, reason: candidates.length ? 'ambiguous-operating-point' : 'no-exact-operating-point' }
      const node = candidates[0], attachmentMetres = distanceMetres(stop, node.coordinate)
      return attachmentMetres <= limits.stationAttachmentMetres ? { number, node, attachmentMetres } : { number, reason: 'station-attachment-too-far', attachmentMetres }
    })
    const blocked = new Set(anchors.filter(a => a.node).map(a => a.node.id))
    const results = selected.slice(1).map((end, i) => {
      const start = selected[i], a = anchors[i], b = anchors[i + 1]
      const evidence = { fromOperatingPoint: a.number ?? null, toOperatingPoint: b.number ?? null, stationAttachmentsMetres: [a.attachmentMetres ?? null, b.attachmentMetres ?? null] }
      const fail = reason => ({ railFailure: reason, ...evidence })
      if (!a.node || !b.node) return fail(a.reason ?? b.reason)
      if (a.node.id === b.node.id) return fail('coincident-operating-points')
      const maximum = Math.max(limits.detourAllowanceMetres, distanceMetres(start, end) * limits.detourRatio)
      const edges = shortest(graph, a.node.id, b.node.id, blocked, maximum)
      if (!edges?.length) return fail('disconnected-excessive-detour-or-stop-order')
      const path = [start.slice(0, 2), ...edges.flatMap(e => e.points), end.slice(0, 2)]
        .filter((p, j, all) => j === 0 || p[0] !== all[j - 1][0] || p[1] !== all[j - 1][1])
      const pathMetres = lengthOf(path)
      if (pathMetres > maximum) return fail('excessive-detour-with-station-attachments')
      return { path, geometrySource: 'fot', ...evidence, pathMetres, maximumTopologyAttachmentMetres: Math.max(...edges.map(e => e.attachmentMetres)), directedSourceSegments: edges.map(e => ({ id: e.segmentId, from: e.from, to: e.to })) }
    })
    cache.set(key, results); return results
  } }
}

export async function loadAargauRail(directory, policyPath) {
  const source = JSON.parse(await readFile(`${directory}/source.json`, 'utf8'))
  for (const [name, sha256] of Object.entries(source.files)) assert.equal(createHash('sha256').update(await readFile(`${directory}/${name}`)).digest('hex'), sha256, `Changed FOT source ${name}`)
  const catalogue = JSON.parse(await readFile(`${directory}/catalogue.json`, 'utf8'))
  assert.equal(catalogue.assets['schienennetz_2056_de.xtf']['file:checksum'], `1220${source.sha256}`)
  assert.equal(catalogue.properties.datetime, source.catalogueDate)
  assert.equal(catalogue.assets['schienennetz_2056_de.xtf'].updated, source.assetUpdated)
  const xml = gunzipSync(await readFile(`${directory}/network.xtf.gz`))
  assert.equal(createHash('sha256').update(xml).digest('hex'), source.sha256)
  const policy = JSON.parse(await readFile(policyPath, 'utf8'))
  const network = parseRailNetworkXtf(xml.toString(), AARGAU_RAIL_LIMITS.simplificationMetres)
  assert.equal(network.nodes.size, source.nodes); assert.equal(network.segments.length, source.segments)
  return { ...aargauRailMatcher(network, policy), source, policy, limits: AARGAU_RAIL_LIMITS }
}
