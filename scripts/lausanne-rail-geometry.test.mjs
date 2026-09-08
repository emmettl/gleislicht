import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { applyLausanneRailGeometry, lausanneRailGroup, projectedRailGraph } from './lausanne-rail-geometry.mjs'

const stops = [[6.63, 46.51, 'Jordils', '', 'a'], [6.63, 46.512, 'Délices', '', 'b'], [6.63, 46.514, 'Grancy', '', 'c'], [6.63, 46.518, 'Flon m2', '', 'd']]
const segment = { id: 'm2-track', start: 'south', end: 'north', points: [[6.6301, 46.509], [6.6301, 46.519]] }
const train = { id: 'm2-out', routeId: 'tl-m2', route: 'm2', category: 'metro', start: 10, end: 40, stops: stops.map((_, i) => [i, 10 + i * 10, 10 + i * 10]) }
const routes = new Map([['tl-m2', { agencyId: '151' }], ['leb-r20', { agencyId: '55' }], ['mbc-r56', { agencyId: '29' }]])
const snapshot = { stops, edges: [[0, 1], [1, 2], [2, 3], [0, 3]], trains: [train] }

describe('Lausanne rail projection', () => {
  it('resolves the retained official Flon, Renens, Etagnières and Morges regressions in both directions', async () => {
    const fixture = JSON.parse(await readFile(new URL('./fixtures/lausanne-rail.json', import.meta.url), 'utf8'))
    const network = { ...fixture.network, nodes: new Map(fixture.network.nodes) }
    const result = applyLausanneRailGeometry(fixture.snapshot, network, new Map(fixture.routes))
    expect(result.projectionAudit.issues).toEqual([])
    expect(result.matchedSegments).toBe(result.totalSegments)
    expect(Math.max(...result.projectionAudit.snaps.map(stop => stop.snapMetres))).toBeLessThan(45)
    expect(result.projectionAudit.snaps.filter(stop => stop.group === 'm2' && /Flon|Délices|Grancy/.test(stop.stop))).toHaveLength(6)
    expect(result.trains.map(train => train.id)).toEqual(fixture.snapshot.trains.map(train => train.id))
    for (const train of result.trains) for (let i = 0; i < train.pathSegments.length; i++) {
      const path = result.paths[train.pathSegments[i]]
      expect(path[0]).toEqual(fixture.snapshot.stops[train.stops[i][0]].slice(0, 2).map(n => Number(n.toFixed(6))))
      expect(path.at(-1)).toEqual(fixture.snapshot.stops[train.stops[i + 1][0]].slice(0, 2).map(n => Number(n.toFixed(6))))
    }
  })

  it('places intermediate stops on the rail edge instead of collapsing them onto station nodes', () => {
    const graph = projectedRailGraph([segment], stops, [0, 1, 2, 3])
    expect(new Set([...graph.projections.values()].map(p => p.key)).size).toBe(4)
    const result = applyLausanneRailGeometry(snapshot, {}, routes, { m2: [segment] })
    expect(result.matchedSegments).toBe(3)
    const paths = result.trains[0].pathSegments.map(i => result.paths[i])
    expect(paths[1][0]).toEqual(stops[1].slice(0, 2))
    expect(paths[1].at(-1)).toEqual(stops[2].slice(0, 2))
    expect(paths[1].every(p => p[1] >= 46.512 && p[1] <= 46.514)).toBe(true)
    expect(result.edgePaths[3]).toBeNull() // no invented path on unused topology
  })

  it('keeps LEB and m2 separate even when the wrong railway is geographically closer', () => {
    const leb = { ...segment, id: 'leb-track', points: [[6.63, 46.509], [6.63, 46.519]] }
    const lebTrain = { ...train, id: 'leb', routeId: 'leb-r20', route: 'R20', category: 'regional' }
    const result = applyLausanneRailGeometry({ ...snapshot, trains: [train, lebTrain] }, {}, routes, { m2: [segment], leb: [leb] })
    expect(result.projectionAudit.snaps.filter(s => s.group === 'm2').every(s => s.segmentId === 'm2-track')).toBe(true)
    expect(result.projectionAudit.snaps.filter(s => s.group === 'leb').every(s => s.segmentId === 'leb-track')).toBe(true)
    expect(lausanneRailGroup({ ...train, category: 'regional', route: 'R56', routeId: 'mbc-r56' }, routes)).toBe('mbc')
  })

  it('preserves travel direction and joins successive surveyed segments', () => {
    const segments = [{ ...segment, end: 'join', points: [[6.6301, 46.509], [6.6301, 46.513]] }, { id: 'north-track', start: 'join', end: 'north', points: [[6.6301, 46.513], [6.631, 46.516], [6.6301, 46.519]] }]
    const reverse = { ...train, id: 'return', stops: [...train.stops].reverse() }
    const result = applyLausanneRailGeometry({ ...snapshot, trains: [reverse] }, {}, routes, { m2: segments })
    expect(result.matchedSegments).toBe(3)
    const path = result.paths[result.trains[0].pathSegments[0]]
    expect(path[0]).toEqual(stops[3].slice(0, 2))
    expect(path.at(-1)).toEqual(stops[2].slice(0, 2))
    expect(path).toContainEqual([6.631, 46.516])
  })

  it('rejects remote stations, coincident projections and disconnected tracks rather than adding long connectors', () => {
    const distant = stops.map(s => [s[0] + 0.01, ...s.slice(1)])
    const rejected = applyLausanneRailGeometry({ ...snapshot, stops: distant }, {}, routes, { m2: [segment] })
    expect(rejected.matchedSegments).toBe(0)
    expect(rejected.projectionAudit.issues[0].reason).toBe('stop-outside-corridor')
    const coincident = applyLausanneRailGeometry({ ...snapshot, stops: stops.map(() => stops[0]) }, {}, routes, { m2: [segment] })
    expect(coincident.matchedSegments).toBe(0)
    const disconnected = [{ ...segment, points: [[6.6301, 46.509], [6.6301, 46.512]] }, { id: 'isolated', start: 'isolated-start', end: 'isolated-end', points: [[6.6301, 46.514], [6.6301, 46.519]] }]
    const result = applyLausanneRailGeometry(snapshot, {}, routes, { m2: disconnected })
    expect(result.trains[0].pathSegments[1]).toBeNull()
    expect(result.projectionAudit.issues.some(i => i.reason === 'disconnected-or-excessive-detour')).toBe(true)
  })

  it('retains the detour limit even if both platforms project close to a track', () => {
    const detour = { ...segment, points: [[6.6301, 46.51], [6.8, 46.51], [6.8, 46.512], [6.6301, 46.512]] }
    const result = applyLausanneRailGeometry({ ...snapshot, trains: [{ ...train, stops: train.stops.slice(0, 2) }] }, {}, routes, { m2: [detour] })
    expect(result.trains[0].pathSegments).toEqual([null])
  })
})
