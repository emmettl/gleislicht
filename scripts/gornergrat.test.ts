import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import fixture from '../public/data/gornergrat-day.json'
import evidence from '../data/gornergrat-ascent-source.json'
import audit from '../data/gornergrat-study-audit.json'
import { gornergratAscents } from '../src/studies/gornergrat.ts'
const network=fixture as unknown as NetworkSnapshot
describe('Gornergrat dated summit journeys',()=>{
 it('preserves 54 source services and offers only the 26 public complete summit ascents',()=>{
  expect(network.trains).toHaveLength(54);expect(network.stops).toHaveLength(7)
  const choices=gornergratAscents(network);expect(choices).toHaveLength(26)
  expect(choices[0].stops[0][2]).toBe(25200)
  const noon=choices.find(t=>t.stops[0][2]===43200)!
  expect(noon.shortName).toBe('237');expect(noon.stops.at(-1)![1]).toBe(45180)
  expect(new Set(choices.map(t=>t.stops.length))).toEqual(new Set([6,7]))
  expect(network.trains.some(t=>network.stops[t.stops.at(-1)![0]][2]==='Riffelalp')).toBe(true)
  for(const t of choices){const calls=evidence.trips[t.id as keyof typeof evidence.trips].calls;expect(t.stops.map(([i,a,d])=>[network.stops[i][4],a,d])).toEqual(calls.map(c=>[c.stopId,c.arrival,c.departure]))}
  expect(audit.geometry.occurrences).toBe(281);expect(audit.geometry.matched).toBe(281)
 })
 it('fails closed for changed date, source identity, timetable calls or missing route geometry',()=>{
  expect(gornergratAscents({...network,metadata:{...network.metadata,serviceDate:'2026-09-05'}})).toEqual([])
  expect(gornergratAscents({...network,paths:[]})).toEqual([])
  expect(gornergratAscents({...network,trains:[...network.trains,network.trains[0]]})).toEqual([])
  const changed=structuredClone(network),id=gornergratAscents(changed)[0].id
  changed.trains.find(t=>t.id===id)!.stops[1][1]++
  expect(gornergratAscents(changed).some(t=>t.id===id)).toBe(false)
 })
})
