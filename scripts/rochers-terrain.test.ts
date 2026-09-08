import {describe,expect,it} from 'vitest'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gzipSync} from 'node:zlib'
import type {NetworkSnapshot} from '@motionstudies/core/domain/network'
import fixture from '../public/data/rochers-day.json'
import terrain from '../public/data/rochers-ascent-terrain.json'
import audit from '../data/rochers-terrain-audit.json'
import {rochersJourneys} from '../src/studies/rochers.ts'
import {bindRochersTerrain} from '../src/studies/rochers-terrain.ts'
import {measuredTerrainPosition,railPoint,railSamples} from '../src/studies/measured-terrain.ts'
const network=fixture as unknown as NetworkSnapshot
const up=rochersJourneys(network,'ascent'),down=rochersJourneys(network,'descent')
describe('Rochers measured terrain binding',()=>{
 it('preserves every source call and rail height in both directions',()=>{
  expect(up).toHaveLength(10);expect(down).toHaveLength(10)
  for(const train of [...up,...down]){
   const binding=bindRochersTerrain(terrain,network,train)!
   expect(binding).toBeDefined()
   expect(binding.routes[0].calls.map(c=>[c.name,c.arrival,c.departure])).toEqual(train.stops.map(([i,a,d])=>[network.stops[i][2],a,d]))
   for(const call of binding.routes[0].calls){
    const station=audit.routes[0].stops.find(s=>s.name===call.name)!
    const route=binding.routes[0].route
    expect(railPoint(route.points,railSamples(route.points),call.progress)[2]).toBeCloseTo(station.railHeight,1)
   }
   expect(measuredTerrainPosition(binding,train.stops[0][2]-1)).toBeUndefined()
   expect(measuredTerrainPosition(binding,train.stops.at(-1)![1])).toBeUndefined()
   expect(measuredTerrainPosition(binding,train.stops[1][1])?.stopped).toBe(true)
  }
 })
 it('reverses audited positions and structure masks, keeping every masked interval out of 3D',()=>{
  for(const train of [...up, ...down]){
   const binding=bindRochersTerrain(terrain,network,train)!
   expect(binding.windows).toHaveLength(12)
   if(down.includes(train)){
    expect(binding.routes[0].route.points).toEqual([...terrain.routes[0].points].reverse())
    expect(binding.routes[0].route.maskedRanges).toEqual([...terrain.routes[0].maskedRanges].reverse().map(r=>({...r,start:1-r.end,end:1-r.start})))
   }
   for(const w of binding.windows){
    expect(measuredTerrainPosition(binding,w.start+.001)?.mask).toBeUndefined()
    expect(measuredTerrainPosition(binding,w.end-.001)?.mask).toBeUndefined()
   }
   for(let t=train.stops[0][2];t<train.stops.at(-1)![1];t+=3){
    const pos=measuredTerrainPosition(binding,t)!
    if(pos.mask)expect(binding.windows.some(w=>t>w.start && t<w.end)).toBe(false)
   }
  }
 })
 it('requires explicit audited train IDs and valid dated source data',()=>{
  for(const train of [up[0],down[0]]){
   const key=up.includes(train)?'forwardTripIds':'reverseTripIds'
   const missing=structuredClone(terrain);missing.routes[0][key]=[]
   expect(bindRochersTerrain(missing,network,train)).toBeUndefined()
   const bad:unknown[]=[null,{}, {...terrain,id:'gornergrat-ascent-terrain'},{...terrain,metadata:{...terrain.metadata,serviceDate:'2026-09-05'}},{...terrain,routes:[null]}]
   for(const mutate of [(v:typeof terrain)=>{v.routes[0].points[1]=v.routes[0].points[0]},(v:typeof terrain)=>{v.routes[0].stops.pop()},(v:typeof terrain)=>{v.terrain.elevations[0]=NaN},(v:typeof terrain)=>{v.routes[0].maskedRanges[0].end=2}]){const v=structuredClone(terrain);mutate(v);bad.push(v)}
   for(const data of bad)expect(bindRochersTerrain(data,network,train)).toBeUndefined()
  }
 })
 it('pins source hashes and keeps the optional 42 m mesh below 120 KiB',()=>{
  const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex')
  expect(terrain.metadata.networkSha256).toBe(hash('public/data/rochers-day.json'))
  expect(terrain.metadata.railSourceSha256).toBe(hash('data/rochers-terrain-source.json'))
  expect(gzipSync(readFileSync('public/data/rochers-ascent-terrain.json')).length).toBeLessThan(120*1024)
  expect(audit.routes[0].maxOffsetMetres).toBeLessThan(13)
  expect(audit.routes[0].stops.at(-1)!.railHeight).toBeCloseTo(1967.937,2)
  expect(terrain.metadata.gridSpacingMetres.every(n=>n>41 && n<42)).toBe(true)
 })
})
