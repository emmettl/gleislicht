import { describe, expect, it } from 'vitest'
import { baselGraphs, matchBaselSegment, applyBaselGeometry } from './basel-line-geometry.mjs'
import { baselGate, compactBaselSnapshot } from './audit-basel-study.mjs'
import { downloadBaselSources, validateBaselDownload } from './download-basel-sources.mjs'
import { baselTram19Graph } from './basel-rail-geometry.mjs'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const A = [7.6, 47.55], B = [7.62, 47.55]
function feature(line = '8', operator = 'BVB', points = [A, B], mode = 'Tram') {
  return { type: 'Feature', properties: { ln_liniennr: line, ln_tu: operator, ln_verkehrsmittel: mode }, geometry: { type: 'LineString', coordinates: points } }
}
const collection = (...features) => ({ type: 'FeatureCollection', features })
const graph = (...features) => baselGraphs([collection(...features)]).get('823:tram:8')

describe('Basel official line inference', () => {
  it('projects stops onto long source segments instead of snapping to distant vertices', () => {
    const from = [7.605, 47.5501], to = [7.615, 47.5501]
    const result = matchBaselSegment(graph(feature()), from, to)
    expect(result.path[0]).toEqual(from)
    expect(result.path.at(-1)).toEqual(to)
    expect(result.maximumSnapMetres).toBeLessThan(12)
    expect(result.pathMetres).toBeGreaterThan(700)
    expect(result.pathMetres).toBeLessThan(800)
    expect(matchBaselSegment(graph(feature()), to, from).path).toEqual([...result.path].reverse())
  })

  it('routes through connected source vertices and rejects disconnected line pieces', () => {
    const bend = [7.61, 47.551]
    const result = matchBaselSegment(graph(feature('8', 'BVB', [A, bend, B])), A, B)
    expect(result.path).toContainEqual(bend)
    const broken = graph(feature('8', 'BVB', [A, [7.601, 47.55]]), feature('8', 'BVB', [[7.619, 47.55], B]))
    expect(matchBaselSegment(broken, A, B).reason).toBe('disconnected-line')
  })

  it('keeps agency and mode identities separate even when display numbers coincide', () => {
    const maps = baselGraphs([collection(feature('8', 'BLT'), feature('8', 'BVB', [A, B], 'Bus'), feature('38', 'BVB / Südbadenbus', [A, B], 'Bus'), feature('8', 'distribus'))])
    expect(maps.has('823:tram:8')).toBe(false)
    expect(maps.has('37:tram:8')).toBe(true)
    expect(maps.has('823:bus:8')).toBe(true)
    expect(maps.has('823:bus:38')).toBe(true)
    expect(matchBaselSegment(maps.get('823:tram:8'), A, B).reason).toBe('missing-line')
  })

  it('recovers a failed nearest match on close parallel source parts without connecting them', () => {
    const otherA = [A[0], A[1] + 0.00003], otherB = [B[0], B[1] + 0.00003]
    const g = graph(feature(), feature('8', 'BVB', [otherA, otherB]))
    const result = matchBaselSegment(g, A, otherB)
    expect(result.projectionChoice.initialReason).toBe('disconnected-line')
    expect(result.projectionChoice.maximumAdditionalSnapMetres).toBeLessThan(4)
    expect(result.pathMetres).toBeGreaterThan(1400)
    expect(result.path[0]).toEqual(A)
    expect(result.path.at(-1)).toEqual(otherB)
    // All on-network vertices remain on one part; only the platform connector
    // can leave it. The graph still consists of two disconnected edges.
    expect(new Set(result.path.slice(1, -1).map(point => point[1])).size).toBe(1)
    expect(g.edges).toHaveLength(2)
    expect(matchBaselSegment(g, A, B).projectionChoice).toBeUndefined()
  })

  it('does not stretch the alternative allowance or the original endpoint limits', () => {
    const otherA = [A[0], A[1] + 0.0001], otherB = [B[0], B[1] + 0.0001]
    expect(matchBaselSegment(graph(feature(), feature('8', 'BVB', [otherA, otherB])), A, otherB).reason).toBe('disconnected-line')
    const outside = [B[0], B[1] + 0.002]
    expect(matchBaselSegment(graph(feature()), A, outside).reason).toBe('endpoint-gap')
  })

  it('avoids a multi-kilometre return to a distant join on opposite source parts', () => {
    const lowerEnd = [7.64, A[1]], upperStart = [A[0], A[1] + 0.00003], upperEnd = [7.64, upperStart[1]]
    const g = graph(feature('8', 'BVB', [A, lowerEnd]), feature('8', 'BVB', [upperStart, upperEnd]), feature('8', 'BVB', [A, upperStart]))
    const from = [7.63, A[1]], to = [7.631, upperStart[1]]
    expect(matchBaselSegment(g, from, to, { snapMetres: 120, detourRatio: 4.5, detourFloorMetres: 1200, alternativeSnapMetres: 0 }).reason).toBe('implausible-detour')
    const result = matchBaselSegment(g, from, to)
    expect(result.projectionChoice.initialReason).toBe('implausible-detour')
    expect(result.pathMetres).toBeLessThan(100)
    expect(result.path.every(point => point[0] >= from[0])).toBe(true)
  })

  it('can compare nearby infrastructure parts without changing ordinary successful line matches', () => {
    const upperStart = [A[0], A[1] + 0.00003], upperEnd = [B[0], upperStart[1]]
    const g = graph(feature(), feature('8', 'BVB', [upperStart, upperEnd]), feature('8', 'BVB', [A, upperStart]))
    const from = [7.605, A[1]], to = [7.607, upperStart[1]]
    const nearest = matchBaselSegment(g, from, to)
    expect(nearest.path).toBeTruthy()
    expect(nearest.projectionChoice).toBeUndefined()
    const shorter = matchBaselSegment(g, from, to, undefined, { compareNearbyParts: true })
    expect(shorter.projectionChoice.initialReason).toBe('longer-nearest-path')
    expect(shorter.pathMetres).toBeLessThan(nearest.pathMetres / 2)
    expect(shorter.projectionChoice.maximumAdditionalSnapMetres).toBeLessThan(5)
  })

  it('rejects gaps, collapsed movements and implausible detours before adding endpoint connectors', () => {
    const g = graph(feature())
    expect(matchBaselSegment(g, [7.61, 47.56], B).reason).toBe('endpoint-gap')
    expect(matchBaselSegment(g, [7.6, 47.5501], [7.6, 47.5499]).reason).toBe('collapsed-path')
    const detour = graph(feature('8', 'BVB', [A, [7.6, 47.59], [7.62, 47.59], B]))
    expect(matchBaselSegment(detour, A, B).reason).toBe('implausible-detour')
    expect(() => graph(feature('8', 'BVB', [[47.55, 7.6], B]))).toThrow('WGS84')
  })

  it('accepts multi-part source features without connecting separate parts with artificial edges', () => {
    const f = feature()
    f.geometry = { type: 'MultiLineString', coordinates: [[A, [7.601, 47.55]], [[7.619, 47.55], B]] }
    expect(matchBaselSegment(graph(f), A, B).reason).toBe('disconnected-line')
  })

  it('counts repeated movements and unique directed pairs separately while preserving identities', () => {
    const stops = [[...A, 'Swiss stop', '', 'ch:stop'], [...B, 'Foreign stop', '', 'foreign:stop']]
    const route = { agencyId: '823' }
    const train = { id: 'one', routeId: 'bvb-8', route: '8', category: 'tram', stops: [[0, 10, 10], [1, 100, 100]] }
    const snapshot = { stops, edges: [[0, 1]], trains: [train, { ...train, id: 'two' }, { ...train, id: 'reverse', stops: [...train.stops].reverse() }, { ...train, id: 'blt', routeId: 'blt-8' }] }
    const result = applyBaselGeometry(snapshot, new Map([['bvb-8', route], ['blt-8', { agencyId: '37' }]]), baselGraphs([collection(feature())]))
    expect(result.segments).toHaveLength(3)
    expect(result.groups.find(g => g.id === 'BVB-tram')).toMatchObject({ trips: 3, matched: 3, total: 3 })
    expect(result.groups.find(g => g.id === 'BLT-tram')).toMatchObject({ trips: 1, matched: 0, total: 1 })
    expect(result.trains[0].stops).toEqual(train.stops)
    expect(result.trains[3].pathSegments).toEqual([null])
    expect(result.paths).toHaveLength(2)
    expect(result.edgePaths[0]).toBe(result.trains[0].pathSegments[0])
  })

  it('requires all four operator/mode groups and keeps existing transfer budgets', () => {
    const groups = ['BVB-tram', 'BVB-bus', 'BLT-tram', 'BLT-bus'].map(id => ({ id, trips: 1, coverage: 0.95 }))
    const payload = { manifestGzipBytes: 650 * 1024, morningGzipBytes: 1600 * 1024, chunks: [{ id: 'day', gzipBytes: 450 * 1024 }] }
    expect(baselGate(groups, payload)).toEqual([])
    expect(baselGate(groups.slice(0, 3), payload)).toHaveLength(1)
    expect(baselGate([...groups.slice(0, 3), { id: 'BLT-bus', trips: 1000, coverage: 0.1 }], payload)).toHaveLength(1)
    expect(baselGate(groups, { ...payload, manifestGzipBytes: payload.manifestGzipBytes + 1 })).toHaveLength(1)
  })
})

describe('Basel tram 19 infrastructure isolation', () => {
  const network = () => ({
    nodes: new Map([
      ['w', { id: 'w', number: '8500087', name: 'Waldenburg' }],
      ['m', { id: 'm', number: 'middle', name: 'Intermediate stop' }],
      ['l', { id: 'l', number: '8519350', name: 'Liestal [Gleis 4]' }],
      ['s', { id: 's', number: '8500023', name: 'Liestal' }],
      ['x', { id: 'x', number: 'other', name: 'SBB track' }],
    ]),
    segments: [
      { id: 'wm', start: 'w', end: 'm', points: [A, [7.61, 47.55]] },
      { id: 'ml', start: 'm', end: 'l', points: [[7.61, 47.55], B] },
      { id: 'sbb', start: 's', end: 'x', points: [B, [7.63, 47.55]] },
    ],
  })

  it('selects the anchored branch and excludes even a geographically coincident SBB line', () => {
    const { graph, corridor } = baselTram19Graph(network())
    expect(corridor.segmentIds).toEqual(['wm', 'ml'])
    expect(corridor.nodes.map(node => node.number)).not.toContain('8500023')
    expect(matchBaselSegment(graph, A, B).path).toContainEqual([7.61, 47.55])
    expect(matchBaselSegment(graph, A, [7.63, 47.55]).reason).toBe('endpoint-gap')
  })

  it('fails closed when anchor identity, branch topology or source coordinates change', () => {
    const missing = network(); missing.nodes.delete('l')
    expect(() => baselTram19Graph(missing)).toThrow('anchor')
    const joined = network(); joined.segments.push({ id: 'join', start: 'l', end: 's', points: [B, B] })
    expect(() => baselTram19Graph(joined)).toThrow('isolated chain')
    const broken = network(); broken.segments[1].points[0] = [7.61001, 47.55]
    expect(() => baselTram19Graph(broken)).toThrow('Disconnected tram 19 source coordinates')
  })
})

describe('Basel source completeness', () => {
  it('removes unused topology without clipping a retained foreign terminal or changing its times', () => {
    const from = [...A, 'Basel', '', 'ch'], to = [...B, 'Foreign terminal', '', 'foreign']
    const snapshot = { stops: [[7.5, 47.5, 'Unused', '', 'unused'], from, to], trains: [{ id: 'trip', stops: [[1, 86300, 86300], [2, 87000, 87000]] }], edges: [[0, 1], [1, 2]] }
    const compact = compactBaselSnapshot(snapshot)
    expect(compact.stops).toEqual([from, to])
    expect(compact.trains[0].stops).toEqual([[0, 86300, 86300], [1, 87000, 87000]])
    expect(compact.edges).toEqual([[0, 1]])
  })

  it('rejects a truncated collection and repeated complete features', () => {
    expect(() => validateBaselDownload(collection(feature()), 2)).toThrow('Truncated')
    expect(() => validateBaselDownload(collection(feature(), feature()), 2)).toThrow('Duplicate')
  })

  it('rejects counts changing during acquisition without writing an accepted source catalogue', async () => {
    const output = await mkdtemp(join(tmpdir(), 'basel-download-test-'))
    const calls = new Map()
    const fetchData = async url => {
      const params = new URL(url).searchParams, layer = params.get('TYPENAMES')
      if (params.get('RESULTTYPE') === 'hits') {
        const count = (calls.get(layer) ?? 0) + 1; calls.set(layer, count)
        return new Response(`<wfs:FeatureCollection numberMatched="${count}"/>`)
      }
      return new Response(JSON.stringify(collection(feature())))
    }
    try {
      await expect(downloadBaselSources(output, fetchData)).rejects.toThrow('changed during download')
      expect(await readdir(output)).toEqual([])
    } finally { await rm(output, { recursive: true, force: true }) }
  })
})
