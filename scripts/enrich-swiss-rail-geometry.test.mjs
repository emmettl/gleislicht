import { describe, expect, it } from 'vitest'
import {
  applyRailGeometry,
  createStopNodeResolver,
  parseRailNetworkXtf,
  simplifyPolyline,
} from './enrich-swiss-rail-geometry.mjs'

const xtf = `
<Schienennetz_LV95_V1_3.Schienennetz.Netzknoten TID="a"><Betriebspunkt><Schienennetz_LV95_V1_3.Schienennetz.Betriebspunkt><Nummer>8503000</Nummer><Name>Zürich HB</Name></Schienennetz_LV95_V1_3.Schienennetz.Betriebspunkt></Betriebspunkt><Geometrie><COORD><C1>2683300</C1><C2>1247900</C2></COORD></Geometrie></Schienennetz_LV95_V1_3.Schienennetz.Netzknoten>
<Schienennetz_LV95_V1_3.Schienennetz.Netzknoten TID="b"><Betriebspunkt><Schienennetz_LV95_V1_3.Schienennetz.Betriebspunkt><Nummer>8503001</Nummer><Name>Bend</Name></Schienennetz_LV95_V1_3.Schienennetz.Betriebspunkt></Betriebspunkt><Geometrie><COORD><C1>2684300</C1><C2>1248900</C2></COORD></Geometrie></Schienennetz_LV95_V1_3.Schienennetz.Netzknoten>
<Schienennetz_LV95_V1_3.Schienennetz.Netzknoten TID="c"><Betriebspunkt><Schienennetz_LV95_V1_3.Schienennetz.Betriebspunkt><Nummer>8503002</Nummer><Name>Winterthur</Name></Schienennetz_LV95_V1_3.Schienennetz.Betriebspunkt></Betriebspunkt><Geometrie><COORD><C1>2685300</C1><C2>1247900</C2></COORD></Geometrie></Schienennetz_LV95_V1_3.Schienennetz.Netzknoten>
<Schienennetz_LV95_V1_3.Schienennetz.Netzsegment TID="ab"><Geometrie><POLYLINE><COORD><C1>2683300</C1><C2>1247900</C2></COORD><COORD><C1>2683800</C1><C2>1248500</C2></COORD><COORD><C1>2684300</C1><C2>1248900</C2></COORD></POLYLINE></Geometrie><rAnfangsknoten REF="a"></rAnfangsknoten><rEndknoten REF="b"></rEndknoten></Schienennetz_LV95_V1_3.Schienennetz.Netzsegment>
<Schienennetz_LV95_V1_3.Schienennetz.Netzsegment TID="bc"><Geometrie><POLYLINE><COORD><C1>2684300</C1><C2>1248900</C2></COORD><COORD><C1>2684800</C1><C2>1248500</C2></COORD><COORD><C1>2685300</C1><C2>1247900</C2></COORD></POLYLINE></Geometrie><rAnfangsknoten REF="b"></rAnfangsknoten><rEndknoten REF="c"></rEndknoten></Schienennetz_LV95_V1_3.Schienennetz.Netzsegment>`

describe('Swiss rail geometry enrichment', () => {
  it('simplifies surveyed lines without removing a meaningful bend', () => {
    expect(simplifyPolyline([[0, 0], [50, 80], [100, 0]], 20)).toHaveLength(3)
    expect(simplifyPolyline([[0, 0], [50, 2], [100, 0]], 20)).toEqual([
      [0, 0],
      [100, 0],
    ])
  })

  it('parses infrastructure nodes and directed segment geometry', () => {
    const network = parseRailNetworkXtf(xtf, 20)
    expect(network.nodes.size).toBe(3)
    expect(network.segments).toHaveLength(2)
    expect(network.segments[0].points.length).toBeGreaterThan(2)
  })

  it('matches SLOID station identifiers to FOT operating-point numbers', () => {
    const network = parseRailNetworkXtf(xtf, 20)
    const resolve = createStopNodeResolver(network.nodes)
    const zurich = network.nodes.get('a').coordinate
    expect(resolve([zurich[0], zurich[1], 'Different label', '', 'ch:1:sloid:3000:7:13'])).toBe('a')
  })

  it('routes a scheduled hop around the infrastructure bend', () => {
    const network = parseRailNetworkXtf(xtf, 20)
    const start = network.nodes.get('a').coordinate
    const end = network.nodes.get('c').coordinate
    const snapshot = {
      stops: [
        [start[0], start[1], 'Zürich HB', '', 'ch:1:sloid:3000'],
        [end[0], end[1], 'Winterthur', '', 'ch:1:sloid:3002'],
      ],
      edges: [[0, 1]],
      trains: [
        {
          id: 'train',
          route: 'IC',
          headsign: 'Winterthur',
          shortName: '1',
          category: 'intercity',
          start: 0,
          end: 600,
          stops: [[0, 0, 0], [1, 600, 600]],
        },
      ],
    }
    const result = applyRailGeometry(snapshot, network)
    expect(result.matchedSegments).toBe(1)
    expect(result.paths[0].length).toBeGreaterThan(4)
    expect(result.trains[0].pathSegments).toEqual([0])
    expect(result.edgePaths).toEqual([0])
  })
})
