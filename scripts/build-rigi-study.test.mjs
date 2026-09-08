import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { cablewayPath, selectRigiRoute } from './build-rigi-study.mjs'
import { segmentInWater } from './water-paths.mjs'

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
const snapshot = read('public/data/rigi-day.json')

describe('Lake Lucerne–Rigi study', () => {
  it('selects supported source operators and types without admitting replacement buses or other cableways', () => {
    expect(selectRigiRoute({ agency_id: '137', route_type: '116' })).toBe(true)
    expect(selectRigiRoute({ agency_id: '185', route_type: '700' })).toBe(false)
    expect(selectRigiRoute({ agency_id: '313', route_type: '1300' })).toBe(false)
  })
  it('verifies cableway identity, endpoint compatibility and both directions', () => {
    const source = read('data/rigi-cableway-source.json')
    const train = snapshot.trains.find(t => t.category === 'cableway')
    const [a, b] = train.stops.map(([i]) => snapshot.stops[i])
    const path = cablewayPath(a, b, source)
    expect(cablewayPath(b, a, source).path).toEqual([...path.path].reverse())
    expect(Math.max(...path.endpointOffsetsMetres)).toBeLessThan(10)
    expect(() => cablewayPath([7, 46], b, source)).toThrow('endpoints')
    expect(() => cablewayPath(a, b, { results: [] })).toThrow('one official')
  })
  it('keeps the full-day fixture source-identifiable with resolved paths in each mode', () => {
    expect(gzipSync(JSON.stringify(snapshot)).length).toBeLessThan(25 * 1024)
    expect(snapshot.metadata).toMatchObject({ windowStart: 0, windowEnd: 86400, focusTime: 43200 })
    expect(snapshot.trains).toHaveLength(190)
    expect(new Set(snapshot.trains.map(t => t.id)).size).toBe(190)
    expect(['other', 'ferry', 'cableway'].map(c => snapshot.trains.filter(t => t.category === c).length)).toEqual([50, 89, 51])
    for (const train of snapshot.trains) {
      expect(train.operator).toBeTruthy()
      expect(train.routeId).toBeTruthy()
      expect(train.pathSegments).toHaveLength(train.stops.length - 1)
      expect(train.pathSegments.every(p => Number.isInteger(p) && snapshot.paths[p]?.length >= 2)).toBe(true)
    }
    expect(snapshot.trains.some(t => t.end > 86400)).toBe(true)
  })
  it('keeps every emitted boat path inside the disclosed cartographic lake polygon', () => {
    const lake = read('public/data/swiss-lakes.json').lakes.find(l => l.id === '93')
    const paths = new Set(snapshot.trains.filter(t => t.category === 'ferry').flatMap(t => t.pathSegments))
    for (const index of paths) {
      const path = snapshot.paths[index]
      expect(path.slice(1).every((p, i) => segmentInWater(path[i], p, lake.polygons[0]))).toBe(true)
    }
  })
})
