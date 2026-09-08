import {test,expect} from 'vitest'
import {aargauRoadMatcher} from './aargau-road-geometry.mjs'
import {roadPatternId} from './prepare-postbus-road-feed.mjs'
import {lineIndex} from './aargau-line-geometry.mjs'
import {applyAargauGeometry} from './build-aargau-study.mjs'
const stops=[[8.1,47.4,'A','','A'],[8.11,47.4,'B','','B'],[8.12,47.4,'C','','C']]
const train={id:'t',routeId:'r',agencyId:'801',route:'1',category:'bus',stops:[[0,0,0],[1,60,60],[2,120,120]]}
const id=roadPatternId(train,stops)
function bundle(){return {schemaVersion:1,agencyCaches:{'801':{schemaVersion:1,metadata:{agencyId:'801',license:'ODbL-1.0',matcher:{completed:true,noTrie:true,warnings:true}},report:{maxSnapMetres:10,issues:[]},identities:{[id]:{routeId:'r',stopIds:['A','B','C']}},patterns:{[id]:[0,1]},paths:[[stops[0].slice(0,2),[8.105,47.401],stops[1].slice(0,2)],[stops[1].slice(0,2),stops[2].slice(0,2)]]}}}}
test('road lookup requires agency, route and the entire ordered platform/coordinate pattern',()=>{
 const m=aargauRoadMatcher(bundle())
 expect(m.matchPattern(train,stops)).toHaveLength(2)
 expect(m.matchPattern({...train,agencyId:'899'},stops)).toBeUndefined()
 expect(m.matchPattern({...train,routeId:'another'},stops)).toBeUndefined()
 expect(m.matchPattern({...train,stops:[train.stops[0],train.stops[2]]},stops)).toBeUndefined()
 expect(m.matchPattern(train,stops.map((s,i)=>i===1?[s[0]+.00001,...s.slice(1)]:s))).toBeUndefined()
 expect(m.matchPattern({...train,category:'rail'},stops)).toBeUndefined()
})
test('road lookup fails closed on rejected hops, incomplete provenance and moved cache endpoints',()=>{
 let b=bundle();b.agencyCaches['801'].report.issues=[{pattern:id,segment:1,reason:'matcher-fallback'}]
 expect(()=>aargauRoadMatcher(b).matchPattern(train,stops)).toThrow('Rejected matcher hop')
 b=bundle();b.agencyCaches['801'].metadata.matcher.noTrie=false
 expect(()=>aargauRoadMatcher(b)).toThrow()
 b=bundle();b.agencyCaches['801'].metadata.license='unknown'
 expect(()=>aargauRoadMatcher(b)).toThrow()
 b=bundle();b.agencyCaches['801'].paths[1][0]=[8.2,47.4]
 expect(()=>aargauRoadMatcher(b).matchPattern(train,stops)).toThrow('Cached endpoints')
})
test('an explicit routing failure stays null and reports its reason',()=>{
 const b=bundle();b.agencyCaches['801'].patterns[id][1]=null;b.agencyCaches['801'].report.issues=[{pattern:id,segment:1,reason:'matcher-fallback'}]
 expect(aargauRoadMatcher(b).matchPattern(train,stops)[1]).toEqual({roadPatternId:id,roadFailure:'matcher-fallback'})
})
test('OSM fills only missing official segments and reconciles separate source counts',()=>{
 const raw={metadata:{feed:{feed_version:'test'},serviceDate:'2026-09-06'},stops,trains:[{...train,mode:'bus',directionId:'0',start:0,end:120,calls:train.stops.map(([i,a,d])=>[stops[i][4],a,d,'0','0'])}]}
 const col={type:'FeatureCollection',features:[{id:1,properties:{GO_NR:'801',VM_NAME:'Bus',NR:'1',RICHTUNG:'Hinfahrt'},geometry:{type:'MultiLineString',coordinates:[[stops[0].slice(0,2),stops[1].slice(0,2)]]}}]}
 const base=applyAargauGeometry(raw,lineIndex(col),['A','B','C'])
 const next=applyAargauGeometry(raw,lineIndex(col),['A','B','C'],aargauRoadMatcher(bundle()))
 expect(next.snapshot.paths[next.snapshot.trains[0].pathSegments[0]]).toEqual(base.snapshot.paths[base.snapshot.trains[0].pathSegments[0]])
 expect(next.groups[0]).toMatchObject({officialMatched:1,roadMatched:1,matched:2,total:2})
 expect(next.patterns[0].segments[1]).toMatchObject({geometrySource:'osm',agisRejection:'endpoint-gap'})
 expect(next.snapshot.trains[0].stops).toEqual(base.snapshot.trains[0].stops)
})
