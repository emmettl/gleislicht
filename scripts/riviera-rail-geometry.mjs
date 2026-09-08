import assert from 'node:assert/strict'
import { applyLausanneRailGeometry } from './lausanne-rail-geometry.mjs'

// Operating-point anchors distinguish adjacent platforms at Vevey, Montreux,
// Zweisimmen. A connected component alone includes SBB tracks.
export const RIVIERA_RAIL_CORRIDORS = {
  '42': { name: 'MVR Vevey–Blonay–Les Pléiades', branches: [['8519324', '8501281', '8501288']], excluded: ['8501200', '8501300'] },
  '131': { name: 'MVR Montreux–Rochers-de-Naye', branches: [['8501353', '8501369']], excluded: ['8501300', '8501352'] },
  '64': { name: 'MOB Montreux–Zweisimmen–Lenk', branches: [['8501352', '8504070', '8519323', '8507279']], excluded: ['8501300', '8501200'] },
}

export function rivieraRailCorridors(network) {
  const byNumber = new Map(), graph = new Map()
  for (const node of network.nodes.values()) {
    const entries = byNumber.get(node.number) ?? []; entries.push(node.id); byNumber.set(node.number, entries)
  }
  const anchor = number => { const entries = byNumber.get(number); assert.equal(entries?.length, 1, `Riviera: missing or ambiguous FOT anchor ${number}`); return entries[0] }
  for (const segment of network.segments) for (const [from, to] of [[segment.start, segment.end], [segment.end, segment.start]]) {
    assert(Number.isFinite(segment.length) && segment.length > 0, 'Riviera: invalid segment length')
    const edges = graph.get(from) ?? []; edges.push({ to, segment }); graph.set(from, edges)
  }
  const shortest = (from, to) => {
    const distances = new Map([[from, 0]]), previous = new Map(), queue = [[0, from]]
    while (queue.length) {
      queue.sort((a, b) => b[0] - a[0])
      const [distance, node] = queue.pop()
      if (distance !== distances.get(node)) continue
      if (node === to) {
        const path = []
        for (let at = to; at !== from;) { const step = previous.get(at); path.unshift(step.segment); at = step.from }
        return path
      }
      for (const { to: next, segment } of graph.get(node) ?? []) {
        const candidate = distance + segment.length
        if (candidate >= (distances.get(next) ?? Infinity)) continue
        distances.set(next, candidate); previous.set(next, { from: node, segment }); queue.push([candidate, next])
      }
    }
    throw new Error(`Riviera: disconnected FOT anchors ${from} → ${to}`)
  }
  return Object.fromEntries(Object.entries(RIVIERA_RAIL_CORRIDORS).map(([agency, policy]) => {
    const segments = new Map()
    for (const branch of policy.branches) for (let i = 1; i < branch.length; i++) {
      for (const segment of shortest(anchor(branch[i - 1]), anchor(branch[i]))) segments.set(segment.id, segment)
    }
    const endpoints = new Set([...segments.values()].flatMap(s => [s.start, s.end]))
    for (const number of policy.excluded) assert(!endpoints.has(anchor(number)), `Riviera: ${agency} incorrectly reaches mainline anchor ${number}`)
    return [agency, [...segments.values()]]
  }))
}

export function applyRivieraRailGeometry(snapshot, routes, corridors) {
  const paths = [], edgePaths = snapshot.edges.map(() => null), updated = new Map(), reports = []
  for (const [agency, corridor] of Object.entries(corridors)) {
    const trains = snapshot.trains.filter(t => routes.get(t.routeId)?.agencyId === agency && routes.get(t.routeId)?.mode === 'rail')
    if (!trains.length) continue
    const result = applyLausanneRailGeometry({ ...snapshot, trains }, null, routes, { rail: corridor })
    const offset = paths.length
    paths.push(...result.paths)
    for (const t of result.trains) updated.set(t.id, { ...t, pathSegments: t.pathSegments.map(i => i === null ? null : i + offset) })
    result.edgePaths.forEach((index, i) => { if (index !== null) edgePaths[i] = index + offset })
    reports.push({ agencyId: agency, corridor: RIVIERA_RAIL_CORRIDORS[agency], segmentIds: corridor.map(s => s.id), matchedSegments: result.matchedSegments, totalSegments: result.totalSegments, projection: result.projectionAudit })
  }
  // Deferred modes retain explicit gaps; no straight path is called accepted.
  const trains = snapshot.trains.map(t => updated.get(t.id) ?? { ...t, pathSegments: t.stops.slice(1).map(() => null) })
  return { snapshot: { ...snapshot, trains, paths, edgePaths }, reports }
}

export const RIVIERA_AGENCIES = ['42', '64', '131', '125', '155', '876', '7040', '7260']
export function assertCompleteRivieraCalls(train, stops, calls, date) {
  assert(calls?.length >= 2, 'Riviera: missing source calls')
  assert.deepEqual(train.stops.map(([i]) => stops[i][4]), calls.map(c => c.id), 'Riviera: clipped or reordered calls')
  const offset = train.stops[0][2] - calls[0].departure
  if (!train.frequency) assert.equal(offset, train.sourceServiceDate === date ? 0 : -86400, 'Riviera: changed service-day offset')
  assert.deepEqual(train.stops.map(([, a, d]) => [a, d]), calls.map(c => [c.arrival + offset, c.departure + offset]), 'Riviera: changed source times')
}
