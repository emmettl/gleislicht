import {describe,expect,it} from 'vitest'
import type {NetworkSnapshot} from '@motionstudies/core/domain/network'
import fixture from '../public/data/pilatus-day.json'
import evidence from '../data/pilatus-journey-source.json'
import audit from '../data/pilatus-study-audit.json'
import {pilatusJourneys} from '../src/studies/pilatus.ts'
const network=fixture as unknown as NetworkSnapshot
describe('Pilatus dated cogwheel journeys',()=>{
 it('keeps all 34 source trains, actual calls and both directions',()=>{
  expect(network.trains).toHaveLength(34);expect(network.stops).toHaveLength(3)
  for(const direction of ['ascent','descent'] as const){
   const choices=pilatusJourneys(network,direction);expect(choices).toHaveLength(17)
   for(const t of choices){
    const calls=evidence.trips[t.id as keyof typeof evidence.trips].calls
    expect(t.stops.map(([i,a,d])=>[network.stops[i][4],a,d])).toEqual(calls.map(c=>[c.stopId,c.arrival,c.departure]))
    // GTFS says ordinary calls; the operator's request-stop note stays separate.
    expect(calls.map(c=>[c.pickup,c.dropOff])).toEqual([['0','0'],['0','0'],['0','0']])
   }
  }
  const up=pilatusJourneys(network,'ascent').find(t=>t.start===44100)!,down=pilatusJourneys(network,'descent').find(t=>t.start===44040)!
  expect(up.shortName).toBe('19');expect(up.stops.at(-1)![1]).toBe(45720)
  expect(down.shortName).toBe('18');expect(down.stops.at(-1)![1]).toBe(46020)
  expect(audit.geometry.occurrences).toBe(68);expect(audit.geometry.matched).toBe(68)
 })
 it('rejects stale source dates, duplicate identities, changed calls and missing geometry',()=>{
  for(const direction of ['ascent','descent'] as const){
   expect(pilatusJourneys({...network,metadata:{...network.metadata,serviceDate:'2026-09-05'}},direction)).toEqual([])
   expect(pilatusJourneys({...network,paths:[]},direction)).toEqual([])
   expect(pilatusJourneys({...network,trains:[...network.trains,network.trains[0]]},direction)).toEqual([])
   const candidate=structuredClone(network),id=pilatusJourneys(candidate,direction)[0].id
   candidate.trains.find(t=>t.id===id)!.stops[1][1]++
   expect(pilatusJourneys(candidate,direction).some(t=>t.id===id)).toBe(false)
  }
 })
})
