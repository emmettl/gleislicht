import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { selectJungfrauRoute, projectOnPath, insertJungfrauStations, jungfrauRailResolverStops, eigerExpressPath, auditJungfrauGeometry } from './build-jungfrau-study.mjs'
const read = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url)))
const n = read('public/data/jungfrau-day.json'), source = read('data/jungfrau-cableway-source.json')

describe('Jungfrau first full-day composition', () => {
  it('limits source scope to the six audited operator/type/route joins', () => {
    for (const t of n.trains) expect(selectJungfrauRoute({ agency_id: t.agencyId, route_type: String(t.routeType), route_id: t.routeId })).toBe(true)
    expect(selectJungfrauRoute({ agency_id: '157', route_type: '700', route_id: '93-63-j26-1' })).toBe(false)
    expect(selectJungfrauRoute({ agency_id: '140', route_type: '116', route_id: '93-68-j26-1' })).toBe(false)
    expect(selectJungfrauRoute({ agency_id: '200', route_type: '1300', route_id: 'unknown' })).toBe(false)
  })
  it('retains 326 rail and 1,237 cableway timetable records without creating cabin identities or frequency templates', () => {
    expect(n.metadata).toMatchObject({ feedVersion: '20260902', serviceDate: '2026-09-04', windowStart: 0, windowEnd: 86400 })
    expect(n.trains).toHaveLength(1563)
    expect(new Set(n.trains.map(t => t.id)).size).toBe(1563)
    expect(n.trains.filter(t => t.category === 'regional')).toHaveLength(130)
    expect(n.trains.filter(t => t.category === 'other')).toHaveLength(196)
    expect(n.trains.filter(t => t.category === 'cableway')).toHaveLength(1237)
    expect(n.trains.every(t => t.operator && t.routeId && t.sourceRouteShortName && !t.frequency)).toBe(true)
    expect(n.trains.filter(t => t.category === 'cableway').every(t => t.route === 'Eiger Express' && t.sourceRouteShortName === '2444')).toBe(true)
    expect(gzipSync(JSON.stringify(n)).length).toBeLessThan(100 * 1024)
  })
  it('matches every segment with finite geometry and rejects a missing path', () => {
    const audit = auditJungfrauGeometry(n)
    expect(audit.passed).toBe(true)
    expect(audit.routes).toHaveLength(6)
    expect(audit.routes.reduce((sum, r) => sum + r.segments, 0)).toBe(2564)
    for (const t of n.trains) {
      expect(t.pathSegments).toHaveLength(t.stops.length - 1)
      for (const i of t.pathSegments) expect(n.paths[i].every(p => p.length === 2 && p.every(Number.isFinite))).toBe(true)
    }
    expect(n.edgePaths.every(i => Number.isInteger(i) && n.paths[i])).toBe(true)
    const broken = structuredClone(n); broken.trains[0].pathSegments[0] = null
    expect(auditJungfrauGeometry(broken).passed).toBe(false)
  })
  it('keeps source stop IDs while resolving BOB platform 2 to the correct existing FOT node', () => {
    const input = n.stops.filter(s => s[2] === 'Interlaken Ost')
    expect(input).toHaveLength(3)
    expect(input.every(s => s[4].includes('sloid:7492'))).toBe(true)
    expect(jungfrauRailResolverStops(input).every(s => s[4] === 'ch:1:sloid:19310')).toBe(true)
    expect(input.every(s => s[4].includes('sloid:7492'))).toBe(true)
    expect(() => jungfrauRailResolverStops([[7.87, 46.69, 'Interlaken Ost', '5', 'ch:1:sloid:7492']])).toThrow('Unaudited')
  })
  it('uses interior rail projections only on verified segments and rejects a different infrastructure source', () => {
    expect(projectOnPath([8.001, 46.001], [[8, 46], [8.002, 46]])).toMatchObject({ coordinate: [8.001, 46], index: 1 })
    expect(() => insertJungfrauStations({ nodes: new Map(), segments: [] }, n.stops)).toThrow('Unverified')
    const audit = read('data/jungfrau-study-audit.json')
    expect(audit.stationCorrections.map(s => s.name)).toEqual(['Matten b. Interlaken', 'Grindelwald Terminal'])
    expect(audit.stationCorrections.every(s => s.offsetMetres < 6)).toBe(true)
  })
  it('keeps the exact cable installation and disclosed shared-stop offsets in both directions', () => {
    const t = n.trains.find(t => t.category === 'cableway'), [a, b] = t.stops.map(([i]) => n.stops[i])
    const forward = eigerExpressPath(a, b, source)
    expect(forward.installation).toBe('75.014')
    expect(forward.endpointOffsetsMetres[0]).toBeCloseTo(213.282)
    expect(forward.endpointOffsetsMetres[1]).toBeCloseTo(135.873)
    expect(eigerExpressPath(b, a, source).path).toEqual([...forward.path].reverse())
    expect(() => eigerExpressPath(a, b, { results: [] })).toThrow('exact')
    expect(() => eigerExpressPath([7, 46, ...a.slice(2)], b, source)).toThrow('endpoints')
    expect(() => eigerExpressPath([...a.slice(0, 4), 'unknown'], b, source)).toThrow('endpoints')
  })
})
