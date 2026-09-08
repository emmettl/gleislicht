import assert from 'node:assert/strict'
import { baselGraphs } from './basel-line-geometry.mjs'

export const BASEL_RAIL_SOURCE = {
  publisher: 'Federal Office of Transport (FOT)',
  url: 'https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf',
  route: { agencyId: '37', mode: 'tram', line: '19' },
  endpointNumbers: ['8500087', '8519350'],
  simplificationMetres: 2,
}

// Use FOT operating-point identity and topology to isolate the Waldenburg
// branch. Nearby SBB tracks at Liestal must never become tram 19 candidates.
export function baselTram19Graph(network) {
  const anchors = BASEL_RAIL_SOURCE.endpointNumbers.map(number => {
    const found = [...network.nodes.values()].filter(node => node.number === number)
    assert.equal(found.length, 1, `Expected one tram 19 FOT anchor ${number}`)
    return found[0].id
  })
  const adjacency = new Map()
  for (const segment of network.segments) for (const [a, b] of [[segment.start, segment.end], [segment.end, segment.start]]) {
    const neighbors = adjacency.get(a) ?? []
    neighbors.push(b); adjacency.set(a, neighbors)
  }
  const included = new Set([anchors[0]])
  for (const id of included) for (const next of adjacency.get(id) ?? []) included.add(next)
  assert(included.has(anchors[1]), 'Tram 19 FOT branch does not reach Liestal [Gleis 4]')
  for (const id of included) {
    assert.equal(adjacency.get(id)?.length, anchors.includes(id) ? 1 : 2, 'Tram 19 FOT component is no longer an isolated chain; review changed topology')
  }
  const segments = network.segments.filter(segment => included.has(segment.start))
  assert.equal(segments.length, included.size - 1, 'Unexpected tram 19 FOT cycle')
  const graph = baselGraphs([{ type: 'FeatureCollection', features: segments.map(segment => ({
    type: 'Feature', properties: { ln_tu: 'BLT', ln_verkehrsmittel: 'Tram', ln_liniennr: '19' },
    geometry: { type: 'LineString', coordinates: segment.points },
  })) }]).get('37:tram:19')
  const vertices = new Set([0])
  for (const id of vertices) for (const [next] of graph.adjacency[id] ?? []) vertices.add(next)
  assert.equal(vertices.size, graph.points.length, 'Disconnected tram 19 source coordinates; no synthetic joins allowed')
  return { graph, corridor: {
    ...BASEL_RAIL_SOURCE,
    nodes: [...included].map(id => ({ id, number: network.nodes.get(id).number, name: network.nodes.get(id).name })),
    segmentIds: segments.map(segment => segment.id),
  } }
}
