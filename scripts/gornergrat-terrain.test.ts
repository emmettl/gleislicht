import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import fixture from '../public/data/gornergrat-day.json'
import terrain from '../public/data/gornergrat-ascent-terrain.json'
import audit from '../data/gornergrat-terrain-audit.json'
import { gornergratAscents, gornergratDescents } from '../src/studies/gornergrat.ts'
import { bindGornergratTerrain } from '../src/studies/gornergrat-terrain.ts'
import { measuredTerrainPosition, railPoint, railSamples } from '../src/studies/measured-terrain.ts'
const network=fixture as unknown as NetworkSnapshot, choices=gornergratAscents(network), noon=choices.find(t=>t.start===43200)!
describe('Gornergrat outdoor terrain',()=>{
 it('binds all 26 source ascents without adding the seventh call to six-call trains',()=>{
  expect(choices).toHaveLength(26)
  expect(new Set(choices.map(t=>t.stops.length))).toEqual(new Set([6,7]))
  for(const train of choices){
   const binding=bindGornergratTerrain(terrain,network,train)!
   expect(binding).toBeDefined()
   expect(binding.routes[0].calls.map(c=>[c.name,c.arrival,c.departure])).toEqual(train.stops.map(([i,a,d])=>[network.stops[i][2],a,d]))
   for(const call of binding.routes[0].calls.slice(0,-1)){
    const pos=measuredTerrainPosition(binding,call.departure)!
    expect(pos.progress).toBe(call.progress);expect(pos.stopped).toBe(true)
   }
   expect(measuredTerrainPosition(binding,train.stops[0][2]-1)).toBeUndefined()
   expect(measuredTerrainPosition(binding,train.stops.at(-1)![1])).toBeUndefined()
  }
 })
 it('keeps every tunnel and gallery interval off the outdoor clock windows',()=>{
  const binding=bindGornergratTerrain(terrain,network,noon)!
  expect(binding.windows).toHaveLength(5)
  for(const w of binding.windows){
   expect(measuredTerrainPosition(binding,w.start+.001)?.mask).toBeUndefined()
   expect(measuredTerrainPosition(binding,w.end-.001)?.mask).toBeUndefined()
   const next=measuredTerrainPosition(binding,w.end+.001)
   expect(!next || Boolean(next.mask)).toBe(true)
  }
  expect(measuredTerrainPosition(binding,43620)?.mask?.reason).toBe('tunnel')
  expect(measuredTerrainPosition(binding,44460)?.mask?.reason).toBe('covered')
  expect(measuredTerrainPosition(binding,45000)?.mask).toBeUndefined()
  for(const {route,calls} of binding.routes)for(const call of calls){
   const station=audit.routes[0].stops.find(s=>s.name===call.name)!
   expect(railPoint(route.points,railSamples(route.points),call.progress)[2]).toBeCloseTo(station.railHeight,1)
  }
 })
 it('fails back to the map for wrong data, stale dates, invalid geometry and short services',()=>{
  const bad:unknown[]=[null,{}, {...terrain,id:'jungfrau-ascent-terrain'}, {...terrain,metadata:{...terrain.metadata,serviceDate:'2026-09-05'}}, {...terrain,metadata:{...terrain.metadata,timetableSha256:'wrong'}}]
  for(const mutate of [(v:typeof terrain)=>{v.routes[0].points[1]=v.routes[0].points[0]},(v:typeof terrain)=>{v.routes[0].stops.pop()},(v:typeof terrain)=>{v.routes[0].stops[1].id='ch:1:sloid:1690'},(v:typeof terrain)=>{v.terrain.elevations[0]=NaN},(v:typeof terrain)=>{v.routes[0].maskedRanges[0].end=2},(v:typeof terrain)=>{v.routes[0].vehicle='train'}]){const v=structuredClone(terrain);mutate(v);bad.push(v)}
  bad.push({...terrain,routes:[null]})
  for(const data of bad)expect(bindGornergratTerrain(data,network,noon)).toBeUndefined()
  for(const train of network.trains.filter(t=>!choices.includes(t) && !gornergratDescents(network).includes(t)))expect(bindGornergratTerrain(terrain,network,train)).toBeUndefined()
 })
 it('binds all audited descents with reversed positions and structure masks on their own timetable',()=>{
  const reversed=[...terrain.routes[0].points].reverse()
  for(const train of gornergratDescents(network)){
   const binding=bindGornergratTerrain(terrain,network,train)!
   expect(binding).toBeDefined()
   expect(binding.routes[0].route.points).toEqual(reversed)
   expect(binding.routes[0].route.maskedRanges).toEqual([...terrain.routes[0].maskedRanges].reverse().map(r=>({...r,start:1-r.end,end:1-r.start})))
   expect(binding.routes[0].calls.map(c=>[c.name,c.arrival,c.departure])).toEqual(train.stops.map(([i,a,d])=>[network.stops[i][2],a,d]))
   for(const c of binding.routes[0].calls.slice(0,-1)){
    const pos=measuredTerrainPosition(binding,c.departure)!
    expect(pos.progress).toBe(c.progress);expect(pos.stopped).toBe(true)
    const source=audit.routes[0].stops.find(s=>s.name===c.name)!
    expect(railPoint(pos.route.points,railSamples(pos.route.points),pos.progress)[2]).toBeCloseTo(source.railHeight,1)
   }
   for(const w of binding.windows){
    expect(measuredTerrainPosition(binding,w.start+.001)?.mask).toBeUndefined()
    expect(measuredTerrainPosition(binding,w.end-.001)?.mask).toBeUndefined()
   }
   expect(measuredTerrainPosition(binding,train.stops.at(-1)![1])).toBeUndefined()
  }
  expect(audit.routes[0].descentAudit.count).toBe(26)
  expect(audit.routes[0].descentAudit.maxReverseDifferenceMetres).toBe(0)
 })
 it('retains ascent playback but rejects downhill terrain without an explicit reversed-path audit',()=>{
  const old={...terrain,routes:terrain.routes.map(r=>({...r,reverseTripIds:undefined}))}
  expect(bindGornergratTerrain(old,network,noon)).toBeDefined()
  const downhill=gornergratDescents(network)[0]
  expect(bindGornergratTerrain(old,network,downhill)).toBeUndefined()
  const unlisted={...terrain,routes:terrain.routes.map(r=>({...r,reverseTripIds:r.reverseTripIds.filter(id=>id!==downhill.id)}))}
  expect(bindGornergratTerrain(unlisted,network,downhill)).toBeUndefined()
  expect(bindGornergratTerrain({...terrain,routes:[null]},network,downhill)).toBeUndefined()
 })
 it('pins the federal source evidence and keeps the optional mesh below its budget',()=>{
  const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex')
  expect(terrain.metadata.networkSha256).toBe(hash('public/data/gornergrat-day.json'))
  expect(terrain.metadata.railSourceSha256).toBe(hash('data/gornergrat-terrain-source.json'))
  expect(gzipSync(readFileSync('public/data/gornergrat-ascent-terrain.json')).length).toBeLessThan(120*1024)
  expect(audit.routes[0].maxOffsetMetres).toBeLessThan(15)
  expect(audit.routes[0].stops.at(-1)!.railHeight).toBeCloseTo(3087.496,2)
  expect(terrain.metadata.gridSpacingMetres.every(n=>n>44 && n<45)).toBe(true)
 })
})
