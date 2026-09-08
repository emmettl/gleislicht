import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {mappedGornergratRoutes} from './gornergrat-terrain-geometry.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const network=read('public/data/gornergrat-day.json'),source=read('data/gornergrat-terrain-source.json'),evidence=read('data/gornergrat-ascent-source.json')
describe('Gornergrat source geometry',()=>{
 it('audits both call patterns, uses active cogwheel XYZ and masks all covered samples',()=>{
  const [route]=mappedGornergratRoutes(network,source,evidence)
  expect(route.stops).toHaveLength(7);expect(route.matches).toHaveLength(654)
  expect(route.maskedRanges).toHaveLength(4)
  let length=0
  route.matches.forEach((m,i)=>{
   const f=source.features.find(f=>f.id===m.id)
   expect(f.properties.ZAHNRADBAH).toBe('Wahr');expect(f.properties.AUSSER_BET).toBe('Falsch')
   expect(m.offset).toBeLessThan(15)
   if(i){const a=route.matches[i-1].point,b=m.point;length+=Math.hypot(...b.map((n,j)=>n-a[j]));expect(Math.hypot(b[0]-a[0],b[1]-a[1])).toBeLessThanOrEqual(15.001)}
   if(!['Keine','Bruecke'].includes(m.kind))expect(route.maskedRanges.some(r=>length/route.length>=r.start && length/route.length<=r.end)).toBe(true)
  })
 })
 it('rejects missing tunnel axes and ordinary rail instead of borrowing nearby MGB tracks',()=>{
  expect(()=>mappedGornergratRoutes(network,{...source,features:source.features.filter(f=>f.properties.KUNSTBAUTE!=='Tunnel')},evidence)).toThrow('No valid TLM rail axis')
  expect(()=>mappedGornergratRoutes(network,{...source,features:source.features.map(f=>({...f,properties:{...f.properties,ZAHNRADBAH:'Falsch'}}))},evidence)).toThrow('No valid TLM rail axis')
 })
 it('rejects a descent assigned to an unrelated path instead of reversing unverified geometry',()=>{
  const candidate=structuredClone(network)
  const descent=candidate.trains.find(t=>candidate.stops[t.stops[0][0]][2]==='Gornergrat')
  descent.pathSegments=[...descent.pathSegments]
  descent.pathSegments[0]=descent.pathSegments.at(-1)
  expect(()=>mappedGornergratRoutes(candidate,source,evidence)).toThrow()
 })
 it('rejects a changed path variant instead of silently reusing the canonical ascent',()=>{
  const candidate=structuredClone(network)
  // This path serves the additional Ferienhaus call; six-call trains use a combined path.
  const seven=candidate.trains.find(t=>t.stops.length===7 && candidate.stops[t.stops[0][0]][2]==='Zermatt GGB')
  candidate.paths[seven.pathSegments[0]][1][0]+=.00001
  expect(()=>mappedGornergratRoutes(candidate,source,evidence)).toThrow('path variant')
 })
})
