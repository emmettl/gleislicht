import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {mappedRochersRoutes} from './rochers-terrain-geometry.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const network=read('public/data/rochers-day.json'),source=read('data/rochers-terrain-source.json'),evidence=read('data/rochers-journey-source.json')
describe('Rochers source railway XYZ',()=>{
 it('audits all 20 summit trains against active cogwheel axes and masks covered samples',()=>{
  const [route]=mappedRochersRoutes(network,source,evidence)
  expect(route.forwardTripIds).toHaveLength(10);expect(route.reverseTripIds).toHaveLength(10)
  expect(route.descentAudit.maxReverseDifferenceMetres).toBeLessThan(.001)
  expect(route.stops).toHaveLength(16);expect(route.matches).toHaveLength(728);expect(route.maskedRanges).toHaveLength(12)
  let length=0
  route.matches.forEach((m,i)=>{
   const f=source.features.find(f=>f.id===m.id)
   expect(f.properties.ZAHNRADBAH).toBe('Wahr');expect(f.properties.AUSSER_BET).toBe('Falsch');expect(m.offset).toBeLessThan(13)
   if(i){const a=route.matches[i-1].point,b=m.point;length+=Math.hypot(...b.map((n,j)=>n-a[j]));expect(Math.hypot(b[0]-a[0],b[1]-a[1])).toBeLessThanOrEqual(15.001)}
   if(!['Keine','Bruecke'].includes(m.kind))expect(route.maskedRanges.some(r=>length/route.length>=r.start && length/route.length<=r.end)).toBe(true)
  })
 })
 it('rejects absent tunnel axes, ordinary tracks and unverified trip variants',()=>{
  expect(()=>mappedRochersRoutes(network,{...source,features:source.features.filter(f=>f.properties.KUNSTBAUTE!=='Tunnel')},evidence)).toThrow('Pinned Rochers railway source changed')
  expect(()=>mappedRochersRoutes(network,{...source,features:source.features.map(f=>({...f,properties:{...f.properties,ZAHNRADBAH:'Falsch'}}))},evidence)).toThrow('Pinned Rochers railway source changed')
  const candidate=structuredClone(network),down=candidate.trains.find(t=>candidate.stops[t.stops[0][0]][4]==='ch:1:sloid:1369')
  down.pathSegments=[...down.pathSegments].reverse()
  expect(()=>mappedRochersRoutes(candidate,source,evidence)).toThrow()
  const changed=structuredClone(network);changed.trains[0].stops[1][1]++
  expect(()=>mappedRochersRoutes(changed,source,evidence)).toThrow('Changed source calls')
  expect(()=>mappedRochersRoutes({...network,trains:network.trains.filter(t=>t.id!=='.ojp-91-37-F.1.TA.45.j26')},source,evidence)).toThrow('Expected all 10')
 })
})
