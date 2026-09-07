import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
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
  it('writes day-chunk integrity for the enriched bytes that the browser receives', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'swiss-geometry-test-'))
    try {
      const network = parseRailNetworkXtf(xtf, 20)
      const start = network.nodes.get('a').coordinate
      const end = network.nodes.get('c').coordinate
      const payload = { windowStart: 0, windowEnd: 86_400, trains: [{ id: 'train', stops: [[0, 0, 0], [1, 600, 600]] }] }
      const original = JSON.stringify(payload)
      const manifest = {
        metadata: { serviceDate: '2026-09-07', feedVersion: 'test' },
        stops: [[...start, 'Zürich HB', '', 'ch:1:sloid:3000'], [...end, 'Winterthur', '', 'ch:1:sloid:3002']],
        edges: [[0, 1]],
        chunks: [{ path: 'chunk.json', bytes: Buffer.byteLength(original), sha256: createHash('sha256').update(original).digest('hex') }],
      }
      await Promise.all([
        writeFile(join(directory, 'source.xtf'), xtf),
        writeFile(join(directory, 'chunk.json'), original),
        writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest)),
      ])
      await promisify(execFile)(process.execPath, [resolve('scripts/enrich-swiss-rail-geometry.mjs'), '--source', join(directory, 'source.xtf'), '--snapshot', join(directory, 'manifest.json'), '--tolerance', '20'])
      const bytes = await readFile(join(directory, 'chunk.json'))
      const result = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'))
      expect(JSON.parse(bytes.toString()).trains[0].pathSegments).toEqual([0])
      expect(result.chunks[0].bytes).toBe(bytes.length)
      expect(result.chunks[0].sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
      expect(result.metadata.serviceDate).toBe('2026-09-07')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

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

  it('routes topology edges whose duplicate platform records are absent from the window', () => {
    const network = parseRailNetworkXtf(xtf, 20)
    const start = network.nodes.get('a').coordinate
    const end = network.nodes.get('c').coordinate
    const snapshot = {
      stops: [
        [start[0], start[1], 'Zürich HB', '', 'ch:1:sloid:3000:1'],
        [end[0], end[1], 'Winterthur', '', 'ch:1:sloid:3002:1'],
        [start[0], start[1], 'Zürich HB', '', 'ch:1:sloid:3000:2'],
        [end[0], end[1], 'Winterthur', '', 'ch:1:sloid:3002:2'],
      ],
      edges: [[0, 1], [2, 3]],
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
    expect(result.paths).toHaveLength(1)
    expect(result.edgePaths).toEqual([0, 0])
  })
})
