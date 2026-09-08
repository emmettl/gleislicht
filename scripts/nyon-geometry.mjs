import assert from 'node:assert/strict'
import { applyLausanneRailGeometry } from './lausanne-rail-geometry.mjs'
import { applyRoadCache } from './enrich-postbus-roads.mjs'
export const NYON_AGENCIES = ['66', '738', '741']
export function nyonRailCorridor(network) {
  const anchors = [...network.nodes.values()].filter(node => node.number === '8501060')
  assert.equal(anchors.length, 1, 'Missing La Cure anchor')
  const visited = new Set([anchors[0].id])
  for (const id of visited) for (const segment of network.segments) {
    if (segment.start === id) visited.add(segment.end)
    if (segment.end === id) visited.add(segment.start)
  }
  assert([...network.nodes.values()].some(node => node.number === '8519325' && visited.has(node.id)), 'NStCM must reach underground Nyon')
  assert(![...network.nodes.values()].some(node => node.number === '8501030' && visited.has(node.id)), 'NStCM connected to mainline Nyon')
  return network.segments.filter(segment => visited.has(segment.start) && visited.has(segment.end))
}
export function assertCompleteNyonCalls(train, stops, calls, date) {
  assert(calls?.length >= 2, 'Missing Nyon source calls')
  assert.deepEqual(train.stops.map(([i]) => stops[i][4]), calls.map(call => call.id), `Clipped Nyon journey ${train.id}`)
  const offset = train.stops[0][2] - calls[0].departure
  if (!train.frequency) assert.equal(offset, train.sourceServiceDate === date ? 0 : -86400, 'Changed Nyon service-day offset')
  assert.deepEqual(train.stops.map(([, a, d]) => [a, d]), calls.map(call => [call.arrival + offset, call.departure + offset]), 'Changed Nyon source times')
}
export function applyNyonGeometry(snapshot, routes, corridor, cache) {
  assert(snapshot.trains.every(train => NYON_AGENCIES.includes(routes.get(train.routeId)?.agencyId)))
  const railTrains = snapshot.trains.filter(train => routes.get(train.routeId).agencyId === '66')
  const busTrains = snapshot.trains.filter(train => train.category === 'bus')
  assert.equal(railTrains.length + busTrains.length, snapshot.trains.length)
  const rail = applyLausanneRailGeometry({ ...snapshot, trains: railTrains }, null, routes, { rail: corridor })
  const bus = applyRoadCache(snapshot, busTrains, cache), offset = rail.paths.length
  const trains = [...rail.trains, ...bus.trains.map(train => ({ ...train, pathSegments: train.pathSegments.map(index => index === null ? null : index + offset) }))].sort((a, b) => a.id.localeCompare(b.id))
  const edges = snapshot.edges.map((_, i) => bus.edgePaths[i] !== null ? bus.edgePaths[i] + offset : rail.edgePaths[i])
  return { snapshot: { ...snapshot, trains, paths: [...rail.paths, ...bus.paths], edgePaths: edges }, rail, bus }
}
