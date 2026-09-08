import {describe,expect,it} from 'vitest'
import {gzipSync} from 'node:zlib'
import type {NetworkSnapshot} from '@motionstudies/core/domain/network'
import fixture from '../public/data/rochers-day.json'
import evidence from '../data/rochers-journey-source.json'
import audit from '../data/rochers-study-audit.json'
import {rochersJourneys} from '../src/studies/rochers.ts'
const network=fixture as unknown as NetworkSnapshot
describe('Rochers-de-Naye source journeys',()=>{
 it('retains all 37 trains but offers only ten complete summit journeys in each direction',()=>{
  expect(network.trains).toHaveLength(37);expect(network.stops).toHaveLength(16)
  for(const direction of ['ascent','descent'] as const){
   const choices=rochersJourneys(network,direction);expect(choices).toHaveLength(10)
   for(const t of choices){
    const calls=evidence.trips[t.id as keyof typeof evidence.trips].calls
    expect(t.stops).toHaveLength(16)
    expect(t.stops.map(([i,a,d])=>[network.stops[i][4],a,d])).toEqual(calls.map(c=>[c.stopId,c.arrival,c.departure]))
   }
  }
  const up=rochersJourneys(network,'ascent').find(t=>t.start===41640)!,down=rochersJourneys(network,'descent').find(t=>t.start===44820)!
  expect(up.shortName).toBe('3363');expect(up.stops.at(-1)![1]).toBe(44520)
  expect(down.shortName).toBe('3366');expect(down.stops.at(-1)![1]).toBe(48240)
  expect(up.stops.find(([i])=>network.stops[i][2]==='Caux')?.slice(1)).toEqual([42960,43080])
  expect(down.stops.find(([i])=>network.stops[i][2]==='Glion')?.slice(1)).toEqual([47400,47460])
  expect(audit.geometry.matched).toBe(452);expect(gzipSync(JSON.stringify(fixture)).length).toBeLessThan(40*1024)
 })
 it('rejects changed dates, route classification, missing paths and altered calls',()=>{
  expect(rochersJourneys({...network,metadata:{...network.metadata,serviceDate:'2026-09-05'}},'ascent')).toEqual([])
  expect(rochersJourneys({...network,paths:[]},'descent')).toEqual([])
  const bad=structuredClone(network),train=rochersJourneys(bad,'ascent')[0];train.stops[8][2]++
  expect(rochersJourneys(bad,'ascent').some(t=>t.id===train.id)).toBe(false)
  const wrong=structuredClone(fixture);wrong.trains.forEach(t=>t.routeType=116)
  expect(rochersJourneys(wrong as unknown as NetworkSnapshot,'ascent')).toEqual([])
 })
})
