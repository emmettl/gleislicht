import { test, expect } from 'vitest'
import { loadAargauPlatforms, orderedRelation, terminalExtension } from './aargau-platform-geometry.mjs'
const m=await loadAargauPlatforms('2026-09-04')
const train=p=>({agencyId:p.agencyId,category:p.mode,routeId:p.routeId,route:p.line,directionId:p.directionId})
test('Brugg fixes the service-road loop only for the exact full outbound pattern',()=>{
 const p=m.policy.patterns.find(p=>p.fix==='brugg-service-loop'),t=train(p),result=m.matchPattern(t,p.stops)
 expect(result.flatMap((s,i)=>s?[i]:[])).toEqual([6,7])
 expect(result[6].maximumSnapMetres).toBeLessThan(3)
 expect(result[7].pathMetres).toBeGreaterThan(3000)
 for(const [i,s]of result.entries())if(s){expect(s.path[0]).toEqual(p.stops[i].slice(0,2));expect(s.path.at(-1)).toEqual(p.stops[i+1].slice(0,2))}
 for(const change of [{agencyId:'899'},{routeId:'other'},{directionId:'other'},{category:'rail'}])expect(m.matchPattern({...t,...change},p.stops)).toBeUndefined()
 expect(m.matchPattern(t,[...p.stops].reverse())).toBeUndefined()
 const moved=structuredClone(p.stops);moved[7][0]+=.00001;expect(m.matchPattern(t,moved)).toBeUndefined()
})
test('Bern platform 49 follows the western source segment with a short terminal snap',()=>{
 const p=m.policy.patterns.find(p=>p.date==='2026-09-04'&&p.fix==='bern-platform-49'),r=m.matchPattern(train(p),p.stops)
 expect(r.filter(Boolean)).toHaveLength(1)
 const s=r.at(-1)
 expect(s.originalStationDistanceMetres).toBeGreaterThan(440)
 expect(s.terminalAttachment.snapMetres).toBeLessThan(35)
 expect(s.terminalAttachment.fromSourceDistanceMetres).toBeGreaterThan(s.terminalAttachment.projectionDistanceMetres)
 expect(s.path.at(-1)).toEqual(p.stops.at(-1).slice(0,2))
 expect(s.stationAttachmentsMetres[1]).toEqual(s.terminalAttachment.snapMetres)
})
test('platform fixes cannot leak into an unreviewed date',async()=>{
 const other=await loadAargauPlatforms('2026-09-14')
 for(const p of m.policy.patterns)expect(other.matchPattern(train(p),p.stops)).toBeUndefined()
})
test('ordered relations reject disconnections and reverse one-way traversal',()=>{
 const node=point=>({point})
 const source={nodes:{a:node([8,47]),b:node([8.01,47]),c:node([8.02,47]),d:node([8.03,47])},ways:[{id:'1',nodes:['a','b'],tags:{}},{id:'2',nodes:['b','c'],tags:{oneway:'yes'}}]}
 expect(orderedRelation(source).points).toHaveLength(3)
 source.ways[1].nodes=['c','b'];expect(()=>orderedRelation(source)).toThrow()
 source.ways[1].nodes=['c','d'];expect(()=>orderedRelation(source)).toThrow()
})
test('terminal extensions reject far platforms and unrelated topology nodes',()=>{
 const network={nodes:new Map([['a',{coordinate:[8,47]}],['b',{coordinate:[8.01,47]}],['c',{coordinate:[8.02,47]}]]),segments:[{id:'ab',start:'a',end:'b',points:[[8,47],[8.01,47]]}]}
 expect(terminalExtension(network,'ab','a',[8.005,47.01])).toBeUndefined()
 expect(()=>terminalExtension(network,'ab','c',[8.005,47])).toThrow()
})
