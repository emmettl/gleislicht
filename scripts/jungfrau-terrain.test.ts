import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import fixture from '../public/data/jungfrau-day.json'
import terrain from '../public/data/jungfrau-ascent-terrain.json'
import audit from '../data/jungfrau-terrain-audit.json'
import { jungfrauAscents } from '../src/studies/jungfrau-ascent.ts'
import { bindJungfrauTerrain, jungfrauTerrainPosition, railPoint, railSamples } from '../src/studies/jungfrau-terrain.ts'
const network=fixture as unknown as NetworkSnapshot, choices=jungfrauAscents(network), sequence=choices.find(s=>s.start===43440)!
describe('Jungfrau outdoor terrain',()=>{
 it('binds all dated ascents and keeps station dwells and transfer waits on the same timetable',()=>{
  for(const s of choices){
   const binding=bindJungfrauTerrain(terrain,network,s)!
   expect(binding).toBeDefined()
   for(const wait of s.waits){
    expect(jungfrauTerrainPosition(binding,wait.start)).toBeUndefined()
    expect(binding.windows.some(w=>w.start<wait.end && w.end>wait.start)).toBe(false)
   }
   for(const {route,calls} of binding.routes)for(const call of calls.slice(1,-1)){
    const pos=jungfrauTerrainPosition(binding,(call.arrival+call.departure)/2)!
    expect(pos.progress).toBe(call.progress);expect(pos.stopped).toBe(true)
    expect(railPoint(route.points,railSamples(route.points),pos.progress)[2]).toBeGreaterThan(500)
   }
  }
 })
 it('switches at mask boundaries and never shows the underground Jungfraubahn in terrain',()=>{
  const binding=bindJungfrauTerrain(terrain,network,sequence)!
  for(const w of binding.windows){
   expect(jungfrauTerrainPosition(binding,w.start+.001)?.mask).toBeUndefined()
   expect(jungfrauTerrainPosition(binding,w.end-.001)?.mask).toBeUndefined()
   const next=jungfrauTerrainPosition(binding,w.end+.001)
   expect(!next || Boolean(next.mask)).toBe(true)
  }
  const tunnel=jungfrauTerrainPosition(binding,52000)!
  expect(tunnel.legIndex).toBe(2);expect(tunnel.mask?.reason).toBe('tunnel')
  expect(binding.windows.some(w=>52000>=w.start && 52000<w.end)).toBe(false)
  expect(jungfrauTerrainPosition(binding,sequence.end)).toBeUndefined()
 })
 it('rejects mismatched source versions, invalid meshes, missing calls and malformed masks',()=>{
  const bad:unknown[]=[undefined,null,{}, {...terrain,metadata:{...terrain.metadata,serviceDate:'2026-09-05'}}, {...terrain,metadata:{...terrain.metadata,timetableSha256:'wrong'}}]
  for(const mutate of [(v:typeof terrain)=>{v.routes[0].points[1]=v.routes[0].points[0]},(v:typeof terrain)=>{v.routes[0].stops.pop()},(v:typeof terrain)=>{v.terrain.elevations[0]=NaN},(v:typeof terrain)=>{v.routes[2].maskedRanges[0].end=2}]){const v=structuredClone(terrain);mutate(v);bad.push(v)}
  bad.push({...terrain,routes:[null,null,null]})
  for(const data of bad)expect(bindJungfrauTerrain(data,network,sequence)).toBeUndefined()
 })
 it('pins source evidence and optional payload; the summit rail axis is underground',()=>{
  const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex')
  expect(terrain.metadata.networkSha256).toBe(hash('public/data/jungfrau-day.json'))
  expect(terrain.metadata.railSourceSha256).toBe(hash('data/jungfrau-terrain-source.json'))
  expect(gzipSync(readFileSync('public/data/jungfrau-ascent-terrain.json')).length).toBeLessThan(220*1024)
  const summit=audit.routes[2].stops.at(-1)!
  expect(summit.railHeight).toBeCloseTo(3453.525,2)
  expect(summit.groundHeight-summit.railHeight).toBeGreaterThan(15)
  expect(terrain.routes[2].maskedRanges.at(-1)?.end).toBe(1)
 })
 it('interpolates position by actual 3D polyline distance without spline overshoot',()=>{
  const points:[number,number,number][]=[[0,0,0],[3,0,4],[3,12,4]],distances=railSamples(points)
  expect(distances).toEqual([0,5,17]);expect(railPoint(points,distances,5/17)).toEqual([3,0,4])
  expect(railPoint(points,distances,11/17)).toEqual([3,6,4])
 })
})
