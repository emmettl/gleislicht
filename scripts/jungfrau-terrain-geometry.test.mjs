import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { mappedJungfrauRoutes } from './jungfrau-terrain-geometry.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const network=read('public/data/jungfrau-day.json'),source=read('data/jungfrau-terrain-source.json'),evidence=read('data/jungfrau-ascent-source.json')
describe('source railway elevation and coverage gates',()=>{
 it('uses the underground XYZ axis and masks its full summit approach',()=>{
  const routes=mappedJungfrauRoutes(network,source,evidence),jb=routes[2],last=jb.matches.at(-1)
  expect(last.kind).toBe('Tunnel');expect(last.point[2]).toBeCloseTo(3453.525,3)
  expect(jb.maskedRanges.at(-1).end).toBe(1)
  for(const r of routes)for(let i=0;i<r.matches.length;i++){
   const m=r.matches[i]
   expect(m.offset).toBeLessThanOrEqual(60)
   if(i){const a=r.matches[i-1].point,b=m.point;expect(Math.hypot(b[0]-a[0],b[1]-a[1])).toBeLessThanOrEqual(15.001)}
  }
 })
 it('rejects missing underground evidence instead of projecting onto the mountainside',()=>{
  expect(()=>mappedJungfrauRoutes(network,{...source,features:source.features.filter(f=>f.properties.KUNSTBAUTE!=='Tunnel')},evidence)).toThrow('No valid TLM rail axis')
  expect(()=>mappedJungfrauRoutes(network,{...source,features:source.features.map(f=>({...f,properties:{...f.properties,AUSSER_BET:'Wahr'}}))},evidence)).toThrow('No valid TLM rail axis')
 })
})
