import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { directedPatternKey } from './luzern-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

export const LUZERN_RAIL_LIMITS = { simplificationMetres: 5, stationAttachmentMetres: 350, topologyAttachmentMetres: 120, detourRatio: 4.5, detourFloorMetres: 1200 }
const length = points => points.slice(1).reduce((n, p, i) => n + distanceMetres(points[i], p), 0)
export const luzernOperatingPoint = stop => /^\d{7}$/.test(stop.didok ?? '') ? stop.didok : (() => {
  const number = stop.stop_id.match(/^ch:1:sloid:(\d+)(?=[:_]|$)/)?.[1]
  return number ? `85${number.padStart(5, '0')}` : stop.stop_id.match(/^(\d{7})(?=[:_]|$)/)?.[1]
})()

export function parseLuzernRail(xml, tolerance = LUZERN_RAIL_LIMITS.simplificationMetres) {
  const network = parseRailNetworkXtf(xml, tolerance), rows = [...xml.matchAll(/<Schienennetz_LV95_V1_3\.Schienennetz\.Netzsegment TID="([^"]+)">([\s\S]*?)<\/Schienennetz_LV95_V1_3\.Schienennetz\.Netzsegment>/g)]
  assert.equal(rows.length, network.segments.length, 'Rail parser omitted a source segment')
  const attributes = new Map(rows.map(([, id, body]) => {
    const field = name => body.match(new RegExp(`<${name}>([^<]+)</${name}>`))?.[1]
    return [id, { gauge: field('Spurweite'), sourceDate: field('Stand'), validFrom: field('BeginnGueltigkeit'), validUntil: field('EndeGueltigkeit'), operator: field('TUAbkuerzung') }]
  }))
  assert.equal(attributes.size, rows.length, 'Duplicate rail segment identity')
  assert.equal([...xml.matchAll(/<Schienennetz_LV95_V1_3\.Schienennetz\.Netzknoten TID=/g)].length, network.nodes.size, 'Rail parser omitted or duplicated a node')
  return { ...network, segments: network.segments.map(s => ({ ...s, ...attributes.get(s.id) })) }
}

function shortest(graph, start, end, blocked, maximum) {
  const distances = new Map([[start, 0]]), previous = new Map(), queue = [[0, start]]
  while (queue.length) {
    queue.sort((a, b) => b[0] - a[0] || String(b[1]).localeCompare(String(a[1])))
    const [distance, node] = queue.pop()
    if (distance !== distances.get(node)) continue
    if (node === end) {
      const result = []
      for (let n = end; n !== start;) { const edge = previous.get(n); result.unshift(edge); n = edge.from }
      return result
    }
    for (const edge of graph.get(node) ?? []) {
      if (blocked.has(edge.to) && edge.to !== end) continue
      const next = distance + edge.metres
      if (next > maximum || next >= (distances.get(edge.to) ?? Infinity)) continue
      distances.set(edge.to, next); previous.set(edge.to, edge); queue.push([next, edge.to])
    }
  }
}

export function luzernRailMatcher(network, config, dates) {
  const limits = config.limits, numbers = new Map(), graphs = new Map(), sourceInventory = []
  for (const node of network.nodes.values()) { const list = numbers.get(node.number) ?? []; list.push(node); numbers.set(node.number, list) }
  const gauges = [...new Set(config.routes.map(r => r.gauge))]
  for (const gauge of gauges) graphs.set(gauge, new Map())
  for (const segment of network.segments) {
    const a = network.nodes.get(segment.start), b = network.nodes.get(segment.end)
    assert(a && b && segment.points.length >= 2)
    assert(segment.points.every(p => p.length === 2 && p.every(Number.isFinite)), 'Invalid rail coordinates')
    const points = distanceMetres(a.coordinate, segment.points[0]) + distanceMetres(b.coordinate, segment.points.at(-1)) <= distanceMetres(a.coordinate, segment.points.at(-1)) + distanceMetres(b.coordinate, segment.points[0]) ? segment.points : [...segment.points].reverse()
    const attachment = Math.max(distanceMetres(a.coordinate, points[0]), distanceMetres(b.coordinate, points.at(-1)))
    const segmentGauges = segment.gauge?.replace(/^mm/, '').split('_').map(g => `mm${g}`) ?? []
    const availableGauges = gauges.filter(g => segmentGauges.includes(g))
    const reason = !availableGauges.length ? 'unreviewed-gauge' : segment.validFrom > dates[0] ? 'future-segment' : segment.validUntil && segment.validUntil < dates.at(-1) ? 'expired-segment' : attachment > limits.topologyAttachmentMetres ? 'topology-attachment-too-far' : null
    sourceInventory.push({ id: segment.id, from: a.id, to: b.id, gauge: segment.gauge, sourceDate: segment.sourceDate ?? null, validFrom: segment.validFrom ?? null, validUntil: segment.validUntil ?? null, operator: segment.operator ?? null, attachmentMetres: attachment, reason })
    if (reason) continue
    const path = [a.coordinate, ...points, b.coordinate]
    for (const gauge of availableGauges) for (const [from, to, p] of [[a.id, b.id, path], [b.id, a.id, [...path].reverse()]]) {
      const graph = graphs.get(gauge), edges = graph.get(from) ?? []
      edges.push({ from, to, id: segment.id, points: p, metres: length(p), attachment }); graph.set(from, edges)
    }
  }
  const routes = new Map(config.routes.map(r => [r.routeId, r]))
  return { sourceInventory, match(train, stops, route) {
    const identity = routes.get(train.routeId)
    assert(identity && identity.agencyId === route.agencyId && identity.line === route.line, 'Unreviewed rail route identity')
    const selected = train.calls.map(c => stops.get(c.id)), coords = selected.map(s => [Number(s.stop_lon), Number(s.stop_lat)])
    const anchors = selected.map((s, i) => {
      const number = luzernOperatingPoint(s), candidates = numbers.get(number) ?? []
      if (candidates.length !== 1) return { number, reason: candidates.length ? 'ambiguous-operating-point' : 'missing-exact-operating-point' }
      const node = candidates[0], attachment = distanceMetres(node.coordinate, coords[i])
      return attachment > limits.stationAttachmentMetres ? { number, attachment, reason: 'station-attachment-too-far' } : { number, attachment, node }
    })
    const blocked = new Set(anchors.filter(a => a.node).map(a => a.node.id))
    return coords.slice(1).map((end, i) => {
      const start = coords[i], a = anchors[i], b = anchors[i + 1], evidence = { geometrySource: 'fot-rail-inference', gauge: identity.gauge, fromOperatingPoint: a.number ?? null, toOperatingPoint: b.number ?? null, stationAttachmentsMetres: [a.attachment ?? null, b.attachment ?? null], sourceFeatures: [] }
      const fail = reason => ({ ...evidence, reason: `rail-${reason}` })
      if (!a.node || !b.node) return fail(a.reason ?? b.reason)
      if (a.node.id === b.node.id) return fail('coincident-operating-points')
      const maximum = Math.max(limits.detourFloorMetres, distanceMetres(start, end) * limits.detourRatio)
      const edges = shortest(graphs.get(identity.gauge), a.node.id, b.node.id, blocked, maximum)
      if (!edges?.length) return fail('disconnected-detour-or-stop-order')
      const path = [start, ...edges.flatMap(e => e.points), end].map(p => p.map(n => Number(n.toFixed(7)))).filter((p, j, all) => !j || p[0] !== all[j - 1][0] || p[1] !== all[j - 1][1])
      const pathMetres = length(path)
      if (pathMetres > maximum) return fail('detour-with-station-attachments')
      if (pathMetres < 1) return fail('collapsed-path')
      return { ...evidence, path, pathMetres, maximumTopologyAttachmentMetres: Math.max(...edges.map(e => e.attachment)), directedSourceSegments: edges.map(e => ({ id: e.id, from: e.from, to: e.to })) }
    })
  } }
}

// As with bus roads, all complete pattern contexts must agree before a pair
// can be reused. A shortest path may not pass another called operating point
// out of order, even when that would be a shorter infrastructure route.
export function luzernRailConsensus(raw, matcher, config) {
  const stops = new Map(raw.stops.map(s => [s.stop_id, s])), routes = new Map(raw.inventory.map(r => [r.routeId, r])), allowed = new Set(config.routes.map(r => r.routeId)), patterns = new Map(), pairs = new Map()
  for (const day of raw.snapshots) for (const train of day.trains) {
    if (!allowed.has(train.routeId)) continue
    const identity = directedPatternKey(train)
    if (patterns.has(identity)) continue
    const id = sha256(identity).slice(0, 20), results = matcher.match(train, stops, routes.get(train.routeId))
    patterns.set(identity, { id, routeId: train.routeId, directionId: train.directionId, stopIds: train.calls.map(c => c.id), results: results.map(({ path, ...r }) => ({ ...r, geometrySha256: path ? sha256(JSON.stringify(path)) : null })) })
    for (let i = 0; i < results.length; i++) {
      const key = JSON.stringify([train.routeId, train.calls[i].id, train.calls[i + 1].id]), pair = pairs.get(key) ?? { ids: new Set(), results: [] }
      pair.ids.add(id); pair.results.push(results[i]); pairs.set(key, pair)
    }
  }
  return { patterns: [...patterns.values()], pairs: new Map([...pairs].map(([key, p]) => {
    const signatures = new Set(p.results.filter(r => r.path).map(r => sha256(JSON.stringify([r.path, r.directedSourceSegments]))))
    const reasons = [...new Set(p.results.filter(r => !r.path).map(r => r.reason)), ...(signatures.size > 1 ? ['rail-pattern-dependent-path'] : [])]
    return [key, reasons.length ? { geometrySource: 'fot-rail-inference', railPatternIds: [...p.ids].sort(), reason: reasons.join(';') } : { ...p.results[0], railPatternIds: [...p.ids].sort() }]
  })) }
}

export function luzernRailInputs(raw, config) {
  const allowed = new Set(config.routes.map(r => r.routeId)), patterns = new Map(), stopIds = new Set()
  for (const day of raw.snapshots) for (const train of day.trains) if (allowed.has(train.routeId)) {
    for (const c of train.calls) stopIds.add(c.id)
    patterns.set(directedPatternKey(train), { routeId: train.routeId, directionId: train.directionId,
      calls: train.calls.map(c => ({ id: c.id, pickupType: c.pickupType, dropOffType: c.dropOffType })) })
  }
  return { dates: raw.dates, inventory: raw.inventory.filter(r => allowed.has(r.routeId)).map(r => ({ routeId: r.routeId, agencyId: r.agencyId, line: r.line })),
    stops: raw.stops.filter(s => stopIds.has(s.stop_id)), snapshots: [{ trains: [...patterns.values()] }] }
}

export async function loadLuzernRail(config, raw) {
  const bytes = await readFile(join(config.sourceDirectory, 'source.json'))
  assert.equal(sha256(bytes), config.sourceMetadataSha256, 'Changed rail source metadata')
  const source = JSON.parse(bytes)
  for (const [file, hash] of Object.entries(source.files)) assert.equal(sha256(await readFile(join(config.sourceDirectory, file))), hash, `Changed rail source ${file}`)
  const xml = gunzipSync(await readFile(join(config.sourceDirectory, 'network.xtf.gz')))
  assert.equal(sha256(xml), source.sha256)
  const catalogue = JSON.parse(await readFile(join(config.sourceDirectory, 'catalogue.json')))
  assert.equal(catalogue.assets['schienennetz_2056_de.xtf']['file:checksum'], `1220${sha256(xml)}`)
  const network = parseLuzernRail(xml.toString(), config.limits.simplificationMetres)
  assert.equal(network.nodes.size, source.nodes); assert.equal(network.segments.length, source.segments)
  const inputsBytes = await readFile(config.inputs), inputs = JSON.parse(inputsBytes)
  assert.equal(sha256(inputsBytes), config.inputsSha256, 'Changed full-pattern rail inputs')
  if (raw) assert.deepEqual(inputs, luzernRailInputs(raw, config), 'Rail inputs do not match complete source-call patterns')
  const matcher = luzernRailMatcher(network, config, inputs.dates)
  return { source, sourceInventory: matcher.sourceInventory, ...luzernRailConsensus(inputs, matcher, config) }
}
