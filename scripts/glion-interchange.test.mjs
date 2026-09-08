import {describe, expect, it} from 'vitest'
import {readFileSync} from 'node:fs'
import {auditGlionInterchange, buildGlionAudit, eligibleGlionTransfer, GLION} from './audit-glion-interchange.mjs'

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url)))
const input = () => ['glion-transfer-source', 'territet-journey-source', 'rochers-journey-source'].map(read)

describe('Glion dated interchange audit', () => {
  it('reproduces 20 connections with separate station identities and original sliced calls', () => {
    const result = buildGlionAudit()
    expect(result).toEqual(read('glion-interchange-audit'))
    expect(result.summary).toEqual({ascents: 10, descents: 10})
    const up = result.connections.filter(c => c.direction === 'ascent')
    expect(up.map(c => c.transfer.intervalSeconds)).toEqual([780, ...Array(9).fill(240)])
    expect(result.connections.filter(c => c.direction === 'descent').map(c => c.transfer.intervalSeconds)).toEqual(Array(10).fill(540))
    for (const c of result.connections) {
      expect(c.transfer.guaranteed).toBe(false)
      expect(c.transfer.path).toBe(null)
      expect(c.legs[0].calls.at(-1).stopId).not.toBe(c.legs[1].calls[0].stopId)
      expect(c.transfer.spareSeconds).toBe(c.transfer.intervalSeconds - 60)
    }
  })
  it('uses railway arrival when changing downhill, without adding the train dwell', () => {
    const c = buildGlionAudit().connections.find(c => c.railwayTripId === '.ojp-91-37-F.1.TA.89.j26')
    expect(c.transfer.arrival).toBe(47400)
    expect(c.legs[0].calls.at(-1).departure).toBe(47460)
    expect(c.transfer.departure).toBe(47940)
  })
  it('admits exactly the minimum, rejecting short, nonfinite or restricted transfers', () => {
    const arriving = {arrival: 100, dropOff: '0'}, departing = {departure: 160, pickup: '0'}
    expect(eligibleGlionTransfer(arriving, departing, 60)).toBe(true)
    expect(eligibleGlionTransfer(arriving, {...departing, departure: 159}, 60)).toBe(false)
    for (const pickup of ['1', '2', '3']) expect(eligibleGlionTransfer(arriving, {...departing, pickup}, 60)).toBe(false)
    expect(eligibleGlionTransfer({...arriving, dropOff: '1'}, departing, 60)).toBe(false)
    expect(eligibleGlionTransfer(arriving, {...departing, departure: NaN}, 60)).toBe(false)
  })
  it('chooses the next qualifying funicular if the nearest downhill boarding is restricted', () => {
    const args = input(), original = auditGlionInterchange(...args).connections.find(c => c.direction === 'descent')
    args[1].trips[original.funicularTripId].calls[0].pickup = '1'
    const changed = auditGlionInterchange(...args).connections.find(c => c.railwayTripId === original.railwayTripId)
    expect(changed.funicularTripId).not.toBe(original.funicularTripId)
    expect(changed.transfer.departure).toBeGreaterThan(original.transfer.departure)
  })
  it('omits summit legs without ordinary public boarding or alighting', () => {
    const args = input()
    args[2].trips['.ojp-91-37-F.1.TA.45.j26'].calls.at(-1).dropOff = '1'
    args[2].trips['.ojp-91-37-F.1.TA.89.j26'].calls[0].pickup = '1'
    expect(auditGlionInterchange(...args).summary).toEqual({ascents: 9, descents: 9})
  })
  it('rejects changed transfer precedence, minimum, stop family, dates and pathways', () => {
    for (const change of [
      a => { a[0].files['transfers.txt'].rows.push({...a[0].files['transfers.txt'].rows.find(r => r.from_stop_id === GLION.railway && r.to_stop_id === GLION.funicular), transfer_type: '3', from_trip_id: 'restricted'}) },
      a => { a[0].files['transfers.txt'].rows.find(r => r.from_stop_id === GLION.funicular && r.to_stop_id === GLION.railway).min_transfer_time = '120' },
      a => { a[0].files['stops.txt'].rows.find(s => s.stop_id === GLION.funicular).parent_station = 'Parentch:1:sloid:1370' },
      a => { a[2].metadata.serviceDate = '2026-09-05' },
      a => { a[0].pathwaysPresent = true },
    ]) {
      const args = input(); change(args)
      expect(() => auditGlionInterchange(...args)).toThrow()
    }
  })
})
