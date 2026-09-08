import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseLuzernCableways, matchLuzernCableway, matchFederalFunicular } from './luzern-cableway-geometry.mjs'
import { graubuendenCablewayPattern } from './graubuenden-cableways.mjs'
const read = p => JSON.parse(readFileSync(p)), raw = JSON.parse(gunzipSync(readFileSync('data/graubuenden-audit/timetable.json.gz'))), review = read('data/graubuenden-cableway-policy.json')
const network = parseLuzernCableways(gunzipSync(readFileSync('data/luzern-cableway-sources/network.xtf.gz')).toString()), stops = new Map(raw.stops.map(s => [s.stop_id, s]))
const route = raw.inventory.find(r => r.routeId === '93-6L-Y-j26-1'), t = raw.snapshots[0].trains.find(t => t.routeId === route.routeId)
const match = (n = network, r = review) => graubuendenCablewayPattern(n, r, t, route, stops)[0]
describe('Graubünden funicular scope', () => {
  it('keeps original station identities and every oriented source vertex', () => {
    const p = match(), original = network.segments.find(s => s.id === p.sourceSegmentId).lines[0]
    expect(p.geometrySource).toBe('fot-funicular-inference'); expect(p.stationAliases).toEqual([])
    expect(p.path.slice(1, -1)).toEqual(p.sourceStationNumbers[0] === '8509275' ? original : [...original].reverse())
    expect(Math.max(...p.stationAttachmentsMetres)).toBeLessThan(1.5)
    expect(p.topologyAttachmentsMetres).toEqual([0, 0])
  })
  it('requires the funicular source class and preserves the strict aerial matcher', () => {
    const args = [network, review, route, ...t.calls.map(c => stops.get(c.id)), raw.dates]
    expect(() => matchLuzernCableway(...args)).toThrow()
    const n = structuredClone(network); n.installations.find(i => i.number === '61.031').type = 'Luftseilbahn'
    expect(() => match(n)).toThrow()
    const r = structuredClone(review); delete r.routes.find(r => r.routeId === route.routeId).routeType
    expect(() => match(network, r)).toThrow()
    expect(() => matchFederalFunicular(network, review, { ...route, routeType: 1300 }, ...t.calls.map(c => stops.get(c.id)), raw.dates)).toThrow()
  })
  it('retains every earlier cableway path and accounts for all six annual funicular routes', () => {
    const a = read('data/graubuenden-audit/cableways.json'), old = read('data/graubuenden-cableway-sources/six-route-paths.json')
    for (const p of old) expect(a.patterns.find(q => q.id === p.id)).toEqual(p)
    expect(a.funicularReview.inventory.map(r => r.routeId)).toEqual(raw.inventory.filter(r => r.routeType === 1400).map(r => r.routeId))
    expect(a.funicularReview.inventory).toHaveLength(6)
    expect(a.days.map(d => [d.sixRouteScopeAdmitted, d.funicularAdded, d.funicularHeadways])).toEqual([[8788,213,211],[7565,213,211]])
    expect(a.funicularReview.inventory.find(r => r.routeId === '93-71-Y-j26-1').days.every(d => d.admitted === 0)).toBe(true)
  })
})
