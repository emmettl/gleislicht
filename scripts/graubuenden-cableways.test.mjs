import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseLuzernCableways } from './luzern-cableway-geometry.mjs'
import { graubuendenCablewayPattern } from './graubuenden-cableways.mjs'
const read = p => JSON.parse(readFileSync(p))
const raw = JSON.parse(gunzipSync(readFileSync('data/graubuenden-audit/timetable.json.gz')))
const review = read('data/graubuenden-cableway-policy.json'), network = parseLuzernCableways(gunzipSync(readFileSync('data/luzern-cableway-sources/network.xtf.gz')).toString())
const route = raw.inventory.find(r => r.routeId === '93-294-0-j26-1'), train = raw.snapshots[0].trains.find(t => t.routeId === route.routeId), stops = new Map(raw.stops.map(s => [s.stop_id, s]))
const match = (n = network, r = review, t = train, rr = route, ss = stops) => graubuendenCablewayPattern(n, r, t, rr, ss)
describe('Graubünden cableway admission boundaries', () => {
  it('limits the upper Chur exception to the named Känzeli alias in both directions', () => {
    const rr = raw.inventory.find(r => r.routeId === '93-288-0-j26-1')
    for (const directionId of ['0', '1']) {
      const tt = raw.snapshots[0].trains.find(t => t.routeId === rr.routeId && t.directionId === directionId)
      const run = (r = review, ss = stops) => match(network, r, tt, rr, ss)[0]
      const p = run(), source = network.segments.find(s => s.id === p.sourceSegmentId).lines[0]
      expect(p.installation).toBe('72.006')
      expect(p.path.slice(1, -1)).toEqual(directionId === '0' ? source : [...source].reverse())
      expect(p.stationAliases).toEqual([expect.objectContaining({ timetable: '8530546', source: '8531215' })])
      expect(p.stationAttachmentLimitsMetres).toEqual(directionId === '0' ? [20,10] : [10,20])
      const r = structuredClone(review); delete r.routes.find(r => r.routeId === rr.routeId).stationAttachmentReview
      expect(run(r).reason).toBe('cableway-endpoint-gap')
      for (const [id, number, metres] of [['ch:1:sloid:30546','8531215',25],['ch:1:sloid:9099','8509099',15]]) {
        const ss = new Map(stops), s = network.stations.find(s => s.number === number)
        ss.set(id, { ...ss.get(id), stop_lon: s.coordinate[0], stop_lat: s.coordinate[1] + metres / 111195 })
        expect(run(review, ss).path).toBeUndefined(); expect(run(review, ss).reason).toBe('cableway-endpoint-gap')
      }
    }
  })
  it('preserves the ten-route baseline and the complete upper Chur minute-grid encoding', () => {
    const a = read('data/graubuenden-audit/cableways.json'), old = read('data/graubuenden-cableway-sources/ten-route-paths.json')
    expect(old).toHaveLength(20)
    for (const p of old) expect(a.patterns.find(q => q.id === p.id)).toEqual(p)
    expect(a.days.map(d => [d.tenRouteScopeAdmitted, d.upperChurAdded])).toEqual([[9049,962],[7826,1022]])
    const days = a.sectionReview.upperChur.timetable
    expect(days.map(d => d.directions.map(r => r.records))).toEqual([[481,481],[511,511]])
    for (const [i,d] of days.entries()) for (const r of d.directions) {
      expect(r.departureIntervalsSeconds).toEqual([60]); expect(r.journeyDurationsSeconds).toEqual([480])
      expect(r.firstCalls[0].departure).toBe(30600)
      expect(r.lastCalls[0].departure).toBe(i ? 61200 : 59400)
      expect(r.lastCalls.at(-1).arrival).toBe(i ? 61680 : 59880)
    }
    expect(raw.snapshots.flatMap(d => d.trains.filter(t => t.routeId === '93-288-0-j26-1')).every(t => !t.frequency)).toBe(true)
  })
  it('preserves every federal vertex and full source call direction with small endpoint attachments', () => {
    const before = structuredClone(train), p = match()[0], line = network.segments.find(s => s.id === p.sourceSegmentId).lines[0]
    expect(p.path.slice(1, -1)).toEqual(line)
    expect(p.stationAliases).toEqual([]); expect(Math.max(...p.stationAttachmentsMetres)).toBeLessThan(7)
    expect(p.topologyAttachmentsMetres).toEqual([0, 0]); expect(train).toEqual(before)
  })
  it('rejects changed operators, unknown routes and unreviewed complete patterns and call rules', () => {
    expect(() => match(network, review, train, { ...route, agencyId: 'other' })).toThrow()
    expect(match(network, review, train, { ...route, routeId: 'other' })[0].reason).toBe('cableway-unreviewed-route')
    const changed = structuredClone(train); changed.calls.splice(1, 0, structuredClone(changed.calls[0]))
    expect(match(network, review, changed).every(p => p.reason === 'cableway-unreviewed-complete-pattern')).toBe(true)
    const t = structuredClone(train); t.calls[0].pickupType = '2'
    expect(match(network, review, t)[0].reason).toBe('cableway-unreviewed-complete-pattern')
  })
  it('withholds the Samnaun summer service despite an exact-number geometric pass', () => {
    const rr = raw.inventory.find(r => r.routeId === '93-7J-Y-j26-1'), tt = raw.snapshots[0].trains.find(t => t.routeId === rr.routeId)
    expect(match(network, review, tt, rr)[0].reason).toBe('cableway-summer-installation-conflict')
    const a = read('data/graubuenden-audit/cableways.json'), trial = a.expansion.trials.find(r => r.routeId === rr.routeId)
    expect(trial.geometricPass).toBe(true); expect(trial.maximumStationAttachmentMetres).toBeLessThan(7)
    expect(trial.disposition).toBe('cableway-summer-installation-conflict')
    expect(a.expansion.trials).toHaveLength(54)
    expect(a.expansion.trials.filter(r => r.disposition === 'rejected-unchanged-geometry-limits')).toHaveLength(10)
    expect(a.expansion.trials.filter(r => r.disposition === 'admitted-complete-patterns')).toHaveLength(3)
  })
  it('rejects expired infrastructure and station drift rather than widening attachments', () => {
    const n = structuredClone(network); n.installations.find(i => i.number === '71.044').validUntil = '2026-09-03'
    expect(match(n)[0].reason).toBe('cableway-source-validity')
    const ss = new Map(stops), id = train.calls[0].id; ss.set(id, { ...ss.get(id), stop_lon: 9 })
    expect(match(network, review, train, route, ss)[0].reason).toBe('cableway-endpoint-gap')
  })
  it('rejects ambiguous installations and disconnected source sections', () => {
    const n = structuredClone(network), i = n.installations.find(i => i.number === '71.044')
    n.installations.push({ ...i, id: 'duplicate' }); expect(() => match(n)).toThrow('Ambiguous')
    n.installations.pop(); const s = n.segments.find(s => s.installation === i.id); s.lines.push(s.lines[0]); expect(() => match(n)).toThrow('Disconnected')
  })
  it('accounts for every annual mountain route and preserves all existing admitted journeys', () => {
    const a = read('data/graubuenden-audit/cableways.json')
    expect(a.inventory.map(r => r.routeId)).toEqual(raw.inventory.filter(r => r.mode === 'mountain').map(r => r.routeId))
    expect(a.days.map(d => [d.candidates, d.added, d.addedHeadwayInstances, d.addedScheduledInstances, d.preservedJourneys])).toEqual([[39402,3565,2542,1023,6545],[38425,3623,2542,1081,5324]])
    expect(a.patterns).toHaveLength(26)
    expect(a.days.map(d => [d.priorCablewayScopeAdmitted, d.expansionAdded, d.expansionHeadways])).toEqual([[6696,3414,2398],[5471,3476,2398]])
  })
})
