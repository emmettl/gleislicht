import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { clipRingToBounds, rigiAscent, sampleElevation } from './ingest-rigi-terrain.mjs'

const networkBytes = readFileSync(new URL('../public/data/rigi-day.json', import.meta.url))
const network = JSON.parse(networkBytes)
const bytes = readFileSync(new URL('../public/data/vitznau-rigi-corridor.json', import.meta.url))
const corridor = JSON.parse(bytes)

describe('Rigi measured ground ingestion', () => {
  const raster = { origin: [100, 200], resolution: [10, -10], window: [0, 0], width: 2, height: 2, values: [400, 500, 600, 700] }
  it('samples native pixel centres and bilinear interiors in the north-down raster', () => {
    expect(sampleElevation(raster, 105, 195)).toBe(400)
    expect(sampleElevation(raster, 115, 185)).toBe(700)
    expect(sampleElevation(raster, 110, 190)).toBe(550)
    expect(sampleElevation({ ...raster, window: [2, 3] }, 125, 165)).toBe(400)
  })
  it('rejects missing coverage and invalid source cells before interpolation', () => {
    expect(() => sampleElevation(raster, 100, 195)).toThrow('outside cached raster')
    expect(() => sampleElevation({ ...raster, values: [-9999, 500, 600, 700] }, 114, 186)).toThrow('Invalid Swiss terrain sample')
  })
  it('retains a complete source run and mapped bends with samples at most 20 m apart', () => {
    const ascent = rigiAscent(network)
    expect(ascent.train.shortName).toBe('1127')
    expect(ascent.stops).toHaveLength(9)
    expect(ascent.stops[0]).toMatchObject({ name: 'Vitznau', progress: 0, departure: 44100 })
    expect(ascent.stops.at(-1)).toMatchObject({ name: 'Rigi Kulm', progress: 1, departure: 46020 })
    for (let i = 1; i < ascent.points.length; i++) expect(Math.hypot(ascent.points[i][0] - ascent.points[i - 1][0], ascent.points[i][1] - ascent.points[i - 1][1])).toBeLessThanOrEqual(20.001)
    const reversed = { ...network, paths: network.paths.map(path => [...path].reverse()) }
    expect(rigiAscent(reversed).points).toEqual(ascent.points)
  })
  it('rejects absent geometry, disconnected alignment and missing source classification', () => {
    expect(() => rigiAscent({ ...network, paths: [] })).toThrow('complete mapped rail paths')
    expect(() => rigiAscent({ ...network, trains: network.trains.map(t => ({ ...t, routeType: undefined })) })).toThrow('source-classified')
    const ascent = rigiAscent(network), paths = [...network.paths]
    paths[ascent.train.pathSegments[1]] = [[9, 47], [9.01, 47.01]]
    expect(() => rigiAscent({ ...network, paths })).toThrow('Disconnected')
  })
  it('clips lake context to the same terrain rectangle', () => {
    const ring = clipRingToBounds([[-2, -2], [2, -2], [2, 2], [-2, 2]], { minEasting: -1, maxEasting: 1, minNorthing: -1, maxNorthing: 1 })
    expect(new Set(ring.map(p => p.join(',')))).toEqual(new Set(['-1,-1', '1,-1', '1,1', '-1,1']))
  })
  it('ships finite terrain and an auditable profile within its optional 100 KiB budget', () => {
    expect(gzipSync(bytes).length).toBeLessThan(100 * 1024)
    expect(corridor.metadata.sourceEvidence.networkSha256).toBe(createHash('sha256').update(networkBytes).digest('hex'))
    expect(corridor.terrain.elevations).toHaveLength(corridor.terrain.columns * corridor.terrain.rows)
    expect(corridor.terrain.elevations.every(Number.isFinite)).toBe(true)
    expect(corridor.route.points.every(p => p.every(Number.isFinite))).toBe(true)
    expect(corridor.route.points[0][2]).toBeCloseTo(436.4)
    expect(corridor.route.points.at(-1)[2]).toBeCloseTo(1748)
    expect(corridor.route.tunnels).toBeUndefined()
    expect(corridor.route.distanceMetres).toBe(6829)
    for (const [x, z] of [...corridor.route.points, ...corridor.lakes[0].rings[0]]) {
      expect(Math.abs(x)).toBeLessThanOrEqual(corridor.terrain.widthMetres / 2)
      expect(Math.abs(z)).toBeLessThanOrEqual(corridor.terrain.depthMetres / 2)
    }
  })
})
