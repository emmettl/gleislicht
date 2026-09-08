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
    expect(a.days.map(d => [d.candidates, d.added, d.addedHeadwayInstances, d.addedScheduledInstances, d.preservedJourneys])).toEqual([[39402,2504,2443,61,6545],[38425,2502,2443,59,5324]])
    expect(a.patterns).toHaveLength(20)
    expect(a.days.map(d => [d.priorCablewayScopeAdmitted, d.expansionAdded, d.expansionHeadways])).toEqual([[6696,2353,2299],[5471,2355,2299]])
  })
})
