import { describe, it, expect } from 'vitest'
import { reviewGraubuendenRailAnchors } from './graubuenden-rail-anchors.mjs'
import { zugRailMatcher } from './zug-rail-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const a = { id: 'a', number: '8500001', name: 'Old station', coordinate: [10, 46.7] }
const b = { id: 'b', number: '8500002', name: 'B', coordinate: [10.03, 46.7] }
const points = [[10, 46.7], [10.01, 46.7], [10.02, 46.7], [10.03, 46.7]]
const edge = { id: 'ab', start: a.id, end: b.id, points, gauge: 'mm1000', infrastructureOperator: 'RhB FR VR', validFrom: '2000-01-01' }
const network = () => ({ nodes: new Map([[a.id, a], [b.id, b]]), segments: [edge] })
const stops = () => new Map([
  ['8500001', { stop_id: '8500001', stop_name: 'Station', stop_lon: 10.015, stop_lat: 46.7 }],
  ['8500002', { stop_id: '8500002', stop_name: 'B', stop_lon: 10.03, stop_lat: 46.7 }],
  ['8510003', { stop_id: '8510003', stop_name: 'A junction', stop_lon: 10, stop_lat: 46.7 }],
])
const policy = () => ({ limits: { snapMetres: 20, alternativeSeparationMetres: 100 }, anchors: [{
  id: 'station', number: '8500001', name: 'Station', replacesOperatingPoint: 'a',
  stops: [{ id: '8500001', coordinate: [10.015, 46.7] }], referenceCoordinate: [10.015, 46.7],
  segment: { id: 'ab', pointsSha256: sha256(JSON.stringify(points)), start: a, end: b },
}] })
const route = { routeId: 'r', agencyId: '72', line: 'R15' }
const config = { routes: [route], gauges: ['mm1000'], infrastructureOperators: ['RhB FR VR'], limits: { stationAttachmentMetres: 350, topologyAttachmentMetres: 120, detourRatio: 4.5, detourFloorMetres: 3000 } }
const train = ids => ({ routeId: 'r', directionId: '0', calls: ids.map(id => ({ id })) })

describe('reviewed Graubünden station anchors', () => {
  it('subdivides the pinned curve without mutating source geometry, junctions or timetable calls', () => {
    const n = network(), ss = stops(), before = structuredClone({ n, ss })
    const result = reviewGraubuendenRailAnchors(n, policy(), ss)
    expect({ n, ss }).toEqual(before)
    expect(result.nodes.get('a')).toEqual({ ...a, number: null })
    expect(result.nodes.get('gr-reviewed-anchor:station').number).toBe('8500001')
    expect(result.segments).toHaveLength(2)
    expect(result.segments[0].points.slice(0, -1).concat(result.segments[1].points.slice(1))).toEqual(points)
    expect(result.segments[0].points.at(-1)).toEqual(result.segments[1].points[0])
    expect(result.reviews[0].projection.metres).toBeLessThan(.001)
  })
  it('routes both directions along slices and retains the original junction for connecting routes', () => {
    const n = network(); n.nodes.set('a', { ...a, number: '8510003' })
    const p = policy(); p.anchors[0].replacesOperatingPoint = null; p.anchors[0].segment.start = n.nodes.get('a')
    const result = reviewGraubuendenRailAnchors(n, p, stops()), match = zugRailMatcher(result, config, ['2026-09-03', '2026-09-06'])
    const forward = match.matchPattern(train(['8500001', '8500002']), stops(), route)[0]
    const reverse = match.matchPattern(train(['8500002', '8500001']), stops(), route)[0]
    const deduplicate = path => path.filter((p, i) => !i || JSON.stringify(p) !== JSON.stringify(path[i - 1]))
    expect(deduplicate(forward.path)).toEqual(deduplicate([...reverse.path].reverse()))
    expect(forward.directedSourceSegments.map(s => s.id)).toEqual(['ab:gr:station:1'])
    const blocked = match.matchPattern(train(['8510003', '8500002', '8500001']), stops(), route)
    expect(blocked[0].path).toBeUndefined() // Cannot pass the later scheduled station early.
  })
  it('fails closed for a changed curve, endpoint identity, platform coordinate or gauge', () => {
    let p = policy(); p.anchors[0].segment.pointsSha256 = 'changed'
    expect(() => reviewGraubuendenRailAnchors(network(), p, stops())).toThrow('curve')
    p = policy(); p.anchors[0].segment.start = { ...a, name: 'Changed' }
    expect(() => reviewGraubuendenRailAnchors(network(), p, stops())).toThrow('operating point')
    const ss = stops(); ss.get('8500001').stop_lat += .001
    expect(() => reviewGraubuendenRailAnchors(network(), policy(), ss)).toThrow('coordinate')
    const n = network(); n.segments = [{ ...edge, gauge: 'mm1435' }]
    expect(() => reviewGraubuendenRailAnchors(n, policy(), stops())).toThrow()
  })
  it('rejects distant and ambiguous attachments without raising the primary limits', () => {
    const ss = stops(); ss.get('8500001').stop_lat = 46.701
    const p = policy(); p.anchors[0].stops[0].coordinate = [10.015, 46.701]; p.anchors[0].referenceCoordinate = [10.015, 46.701]
    expect(() => reviewGraubuendenRailAnchors(network(), p, ss)).toThrow('too far')
    const n = network(); n.segments.push({ ...edge, id: 'nearby', points: points.map(([x, y]) => [x, y + .0001]) })
    expect(() => reviewGraubuendenRailAnchors(n, policy(), stops())).toThrow('Ambiguous')
    expect(config.limits.stationAttachmentMetres).toBe(350)
  })
})
