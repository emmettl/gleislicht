import {describe,expect,it} from 'vitest'
import {gzipSync} from 'node:zlib'
import type {NetworkSnapshot} from '@motionstudies/core/domain/network'
import fixture from '../public/data/territet-day.json'
import evidence from '../data/territet-journey-source.json'
import audit from '../data/territet-study-audit.json'
import source from '../data/territet-funicular-source.json'
import {territetJourneys} from '../src/studies/territet.ts'
import {applyTerritetGeometry} from './territet-geometry.mjs'
import {selectTerritetRoute} from './build-territet-study.mjs'
const network=fixture as unknown as NetworkSnapshot

describe('Territet–Glion funicular evidence',()=>{
 it('preserves 70 actual departures each way and all 420 calls',()=>{
  expect(network.trains).toHaveLength(140);expect(network.stops).toHaveLength(3)
  expect(selectTerritetRoute({route_id:'93-TG-j26-1',agency_id:'131',route_type:'1400'})).toBe(true)
  expect(selectTerritetRoute({route_id:'91-37-F-j26-1',agency_id:'131',route_type:'106'})).toBe(false)
  const up=territetJourneys(network,'ascent'),down=territetJourneys(network,'descent')
  expect(up).toHaveLength(70);expect(down).toHaveLength(70)
  expect(up.map(t=>t.start)).toEqual(down.map(t=>t.start))
  for(const t of [...up,...down]){
   const calls=evidence.trips[t.id as keyof typeof evidence.trips].calls
   expect(t.stops).toHaveLength(3);expect(t.category).toBe('funicular')
   expect(t.stops.map(([i,a,d])=>[network.stops[i][4],a,d])).toEqual(calls.map(c=>[c.stopId,c.arrival,c.departure]))
   expect(calls.every(c=>c.pickup==='0'&&c.dropOff==='0')).toBe(true)
  }
  expect(up.find(t=>t.start===43440)?.stops.map(s=>s[1])).toEqual([43440,43500,43800])
  expect(down.find(t=>t.start===43440)?.stops.map(s=>s[1])).toEqual([43440,43620,43800])
  expect(gzipSync(JSON.stringify(fixture)).length).toBeLessThan(10*1024)
 })
 it('reproduces all 280 mapped segments from the pinned official centreline',()=>{
  const mapped=applyTerritetGeometry(fixture,source)
  expect(mapped.paths).toEqual(fixture.paths);expect(mapped.trains).toEqual(fixture.trains)
  expect(mapped.alignmentReview).toEqual(audit.alignmentReview)
  expect(audit.geometry.matched).toBe(280)
  expect(audit.alignmentReview.stopAnchors.every(a=>a.offsetMetres<3.5)).toBe(true)
  const changed=structuredClone(source);changed.results[1].geometry.coordinates[0][0]+=0.001
  expect(()=>applyTerritetGeometry(fixture,changed)).toThrow('geometry changed')
  const far=structuredClone(fixture);far.stops[1][0]=7
  expect(()=>applyTerritetGeometry(far,source)).toThrow('15 m')
  const calls=structuredClone(fixture);calls.trains[0].stops.reverse();calls.trains[0].stops[1]=calls.trains[0].stops[0]
  expect(()=>applyTerritetGeometry(calls,source)).toThrow('call pattern')
 })
 it('rejects changed dates, calls, identities and missing geometry',()=>{
  expect(territetJourneys({...network,metadata:{...network.metadata,serviceDate:'2026-09-05'}},'ascent')).toEqual([])
  const id=territetJourneys(network,'ascent')[0].id
  for(const mutate of [(t:NetworkSnapshot['trains'][number])=>{(t as unknown as {routeType:number}).routeType=106},(t:NetworkSnapshot['trains'][number])=>{(t.stops[1] as number[])[1]++},(t:NetworkSnapshot['trains'][number])=>{(t as {pathSegments:number[]}).pathSegments=[]}]){
   const copy=structuredClone(network);mutate(copy.trains.find(t=>t.id===id)!);expect(territetJourneys(copy,'ascent').some(t=>t.id===id)).toBe(false)
  }
 })
})
