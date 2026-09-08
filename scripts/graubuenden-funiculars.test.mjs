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
  it('bounds the Höhenweg alias in both directions without widening the other endpoint', () => {
    const rr = raw.inventory.find(r => r.routeId === '93-71-Y-j26-1')
    const tt = raw.snapshots[0].trains.filter(t => t.routeId === rr.routeId)
    for (const first of ['ch:1:sloid:9084', 'ch:1:sloid:9085']) {
      const trip = tt.find(t => t.calls[0].id === first)
      const run = (r = review, ss = stops) => graubuendenCablewayPattern(network, r, trip, rr, ss)[0]
      const p = run(), original = network.segments.find(s => s.id === p.sourceSegmentId).lines[0]
      expect(p.stationAliases).toHaveLength(1)
      expect(p.stationAliases[0]).toMatchObject({ timetable: '8509084', source: '8530888' })
      expect(p.path.slice(1, -1)).toEqual(first.endsWith('9084') ? original : [...original].reverse())
      expect(p.stationAttachmentLimitsMetres).toEqual(first.endsWith('9084') ? [20,10] : [10,20])
      const r = structuredClone(review); delete r.routes.find(r => r.routeId === rr.routeId).stationAttachmentReview
      expect(run(r).reason).toBe('cableway-endpoint-gap')
      for (const [id, metres] of [['ch:1:sloid:9084', 25], ['ch:1:sloid:9085', 15]]) {
        const ss = new Map(stops), s = ss.get(id), source = network.stations.find(s => s.number === (id.endsWith('9084') ? '8530888' : '8509085'))
        ss.set(id, { ...s, stop_lon: source.coordinate[0], stop_lat: source.coordinate[1] + metres / 111195 })
        expect(run(review, ss).reason).toBe('cableway-endpoint-gap'); expect(run(review, ss).path).toBeUndefined()
      }
      r.routes.find(r => r.routeId === rr.routeId).stationAttachmentReview = { ...p.stationAttachmentReview, source: 'wrong' }
      expect(() => run(r)).toThrow('exact reviewed alias')
    }
  })
  it('freezes all nine earlier routes and retains the rejected Samnaun alternative', () => {
    const a = read('data/graubuenden-audit/cableways.json'), old = read('data/graubuenden-cableway-sources/nine-route-paths.json')
    expect(old).toHaveLength(18)
    for (const p of old) expect(a.patterns.find(q => q.id === p.id)).toEqual(p)
    const trial = a.sectionReview.samnaunAlternative
    expect(trial.disposition).toBe('diagnostic-only-not-admitted'); expect(trial.patterns).toHaveLength(2)
    expect(trial.patterns.every(p => Math.max(...p.pairs[0].stationAttachmentsMetres) > 117)).toBe(true)
    expect(a.patterns.some(p => p.routeId === trial.identity.routeId)).toBe(false)
  })
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
    expect(a.days.map(d => [d.sixRouteScopeAdmitted, d.funicularAdded, d.funicularHeadways])).toEqual([[8788,261,259],[7565,261,259]])
    expect(a.funicularReview.inventory.find(r => r.routeId === '93-71-Y-j26-1').days.every(d => d.admitted === 48)).toBe(true)
  })
})
