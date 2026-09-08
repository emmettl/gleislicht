import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { zugMountainGeometry, loadZugMountain } from './zug-mountain-geometry.mjs'

const policy = JSON.parse(readFileSync('data/zug-policy.json')).mountain
const source = JSON.parse(readFileSync('data/zug-mountain-sources/identify.json'))
const raw = JSON.parse(gunzipSync(readFileSync('data/zug-timetable.json.gz')))
const route = raw.inventory.find(r => r.routeId === policy.routeId)
const [a, b] = policy.operatingPointIds.map(id => raw.stops.find(s => s.didok === id))

describe('Zugerbergbahn exact federal installation', () => {
  it('retains every source vertex and reverses the entire directed path', async () => {
    const adapter = await loadZugMountain(policy)
    const forward = adapter.matchPair(route, a, b), reverse = adapter.matchPair(route, b, a)
    expect(forward.path.slice(1, -1)).toEqual(source.results[0].geometry.coordinates)
    expect(reverse.path).toEqual([...forward.path].reverse())
    expect(forward.attachmentMetres.every(m => m < 1.4)).toBe(true)
    expect(forward.operatingPointIds).toEqual(policy.operatingPointIds)
    expect(forward.lengthMetres).toBeGreaterThan(1100)
    expect(forward.lengthMetres).toBeLessThan(1500)
  })
  it('rejects wrong operators, unknown intermediate calls and distant exact-ID stops', () => {
    const adapter = zugMountainGeometry(source, policy)
    expect(adapter.matchPair({ ...route, agencyId: '839' }, a, b).reason).toBe('no-reviewed-mountain-geometry')
    expect(adapter.matchPair(route, a, { ...b, didok: '8502293' }).reason).toBe('mountain-operating-point-identity')
    expect(adapter.matchPair(route, a, a).reason).toBe('mountain-operating-point-identity')
    expect(adapter.matchPair(route, { ...a, stop_lon: '8.6' }, b).reason).toBe('mountain-station-attachment')
  })
  it('rejects another installation, duplicated features and a point detached from the line', () => {
    const other = structuredClone(source); other.results[0].properties.anlagenr = '61.052'
    expect(() => zugMountainGeometry(other, policy)).toThrow()
    const duplicate = structuredClone(source); duplicate.results.push(duplicate.results[0])
    expect(() => zugMountainGeometry(duplicate, policy)).toThrow('inventory')
    const detached = structuredClone(source); detached.results[1].geometry.coordinates[0] += 0.00001
    expect(() => zugMountainGeometry(detached, policy)).toThrow('endpoint')
  })
})
