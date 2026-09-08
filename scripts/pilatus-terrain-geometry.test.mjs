import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {mappedPilatusRoutes} from './pilatus-terrain-geometry.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const network=read('public/data/pilatus-day.json'),source=read('data/pilatus-terrain-source.json'),evidence=read('data/pilatus-journey-source.json')
describe('Pilatus source railway XYZ',()=>{
 it('audits all 34 dated trains against active cogwheel axes and masks covered samples',()=>{
  const [route]=mappedPilatusRoutes(network,source,evidence)
  expect(route.forwardTripIds).toHaveLength(17);expect(route.reverseTripIds).toHaveLength(17)
  expect(route.descentAudit.maxReverseDifferenceMetres).toBeLessThan(.001)
  expect(route.stops).toHaveLength(3);expect(route.matches).toHaveLength(299);expect(route.maskedRanges).toHaveLength(4)
  let length=0
  route.matches.forEach((m,i)=>{
   const f=source.features.find(f=>f.id===m.id)
   expect(f.properties.ZAHNRADBAH).toBe('Wahr');expect(f.properties.AUSSER_BET).toBe('Falsch');expect(m.offset).toBeLessThan(13)
   if(i){const a=route.matches[i-1].point,b=m.point;length+=Math.hypot(...b.map((n,j)=>n-a[j]));expect(Math.hypot(b[0]-a[0],b[1]-a[1])).toBeLessThanOrEqual(15.001)}
   if(!['Keine','Bruecke'].includes(m.kind))expect(route.maskedRanges.some(r=>length/route.length>=r.start && length/route.length<=r.end)).toBe(true)
  })
 })
 it('rejects absent tunnel axes, ordinary tracks and unverified trip variants',()=>{
  expect(()=>mappedPilatusRoutes(network,{...source,features:source.features.filter(f=>f.properties.KUNSTBAUTE!=='Tunnel')},evidence)).toThrow('Pinned Pilatus railway source changed')
  expect(()=>mappedPilatusRoutes(network,{...source,features:source.features.map(f=>({...f,properties:{...f.properties,ZAHNRADBAH:'Falsch'}}))},evidence)).toThrow('Pinned Pilatus railway source changed')
  const candidate=structuredClone(network),down=candidate.trains.find(t=>candidate.stops[t.stops[0][0]][4]==='ch:1:sloid:8456')
  down.pathSegments=[...down.pathSegments].reverse()
  expect(()=>mappedPilatusRoutes(candidate,source,evidence)).toThrow()
  const changed=structuredClone(network);changed.trains[0].stops[1][1]++
  expect(()=>mappedPilatusRoutes(changed,source,evidence)).toThrow('Changed source calls')
  expect(()=>mappedPilatusRoutes({...network,trains:network.trains.slice(1)},source,evidence)).toThrow('Expected all 17')
 })
})
