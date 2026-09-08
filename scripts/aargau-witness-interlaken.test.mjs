import { expect,test } from 'vitest'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { readGzipJson } from './aargau-seasonal.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { loadWitnessInterlaken,interlakenHierarchy,interlakenEvaluator,interlakenMatcher } from './aargau-witness-interlaken.mjs'
const matcher=await loadWitnessInterlaken(),policy=matcher.policy,input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz')
const xml=gunzipSync(await readFile('data/aargau-rail-sources/network.xtf.gz')).toString()
const byTrip=new Map(input.trains.map(t=>[t.sourceTripId,t]))
const train=r=>byTrip.get(r.templates[0].sourceTripId)

test('the binding requires the explicit FOT parent reference, not nearby names or coordinates',()=>{
 expect(interlakenHierarchy(xml).child.parentId).toBe('ch14uvag00139699')
 const changed=xml.replace(policy.hierarchy.child.sourceXml,policy.hierarchy.child.sourceXml.replace('<rUebergeordnet REF="ch14uvag00139699"></rUebergeordnet>',''))
 expect(()=>interlakenHierarchy(changed)).toThrow('Missing explicit FOT station hierarchy')
 const wrong=xml.replace(policy.hierarchy.child.sourceXml,policy.hierarchy.child.sourceXml.replace('Gleis 5-8','Gleis 1-2'))
 expect(()=>interlakenHierarchy(wrong)).toThrow()
})

test('all 59 patterns bind only their reviewed adjacent segment and retain exact endpoints',()=>{
 let added=0;const directions=new Set(),platforms=new Set()
 for(const r of policy.patterns){
  const result=matcher.matchPattern(train(r),r.stops)
  expect(result.filter(Boolean)).toHaveLength(1)
  const i=r.segments[0].index,s=result[i]
  expect(s.path[0]).toEqual(r.stops[i].slice(0,2));expect(s.path.at(-1)).toEqual(r.stops[i+1].slice(0,2))
  expect(s.stationHierarchyBinding.parentOperatingPoint).toBe('8507492')
  expect(s.stationHierarchyBinding.childOperatingPoint).toBe('8519309')
  expect(s.directedSourceSegments.some(s=>s.id==='ch14uvag00087489')).toBe(true)
  expect(Math.max(...s.stationAttachmentsMetres)).toBeLessThan(88)
  added+=r.templates.length;directions.add(r.directionId)
  platforms.add(r.stops.find(s=>s[4]===result[i].stationHierarchyBinding.gtfsStopId)[3])
 }
 expect(added).toBe(162);expect(directions).toEqual(new Set(['0','1']));expect(platforms).toEqual(new Set(['5','7']))
})

test('changed source templates, daily feeds, track groups and coordinates cannot inherit this binding',()=>{
 const r=policy.patterns[0],t=train(r),calls=structuredClone(t.calls);calls[0][2]++
 for(const change of [{routeId:'other'},{agencyId:'65'},{category:'bus'},{directionId:'other'},{sourceTripId:'other'},{shortName:'other'},{calls},{activeServiceDates:['2026-09-04']},{sourceServiceDate:'2026-09-04'},{serviceOffset:0}]) expect(matcher.matchPattern({...t,...change},r.stops)).toBeUndefined()
 const moved=structuredClone(r.stops);moved[0][0]+=.00001
 expect(matcher.matchPattern(t,moved)).toBeUndefined()
 const wrong=structuredClone(r.stops);wrong.find(s=>s[4].includes(':7492:'))[3]='4'
 expect(matcher.matchPattern(t,wrong)).toBeUndefined()
 expect(matcher.matchPattern(t,[...r.stops].reverse())).toBeUndefined()
})

test('changed track paths, hierarchy evidence and guard limits fail closed',()=>{
 const r=policy.patterns[0],t=train(r),evaluate=interlakenEvaluator(parseRailNetworkXtf(xml,5),policy.hierarchy,policy.routes)
 const result=evaluate(t,r.stops),i=r.segments[0].index
 const moved=structuredClone(result);moved[i].path[1][0]+=.00001
 expect(()=>interlakenMatcher(policy,()=>moved).matchPattern(t,r.stops)).toThrow('Changed Interlaken path')
 const changed=structuredClone(result);changed[i].stationHierarchyBinding.childNodeId='other'
 expect(()=>interlakenMatcher(policy,()=>changed).matchPattern(t,r.stops)).toThrow('Changed Interlaken source evidence')
 const limits=structuredClone(policy);limits.limits.stationAttachmentMetres=500
 expect(()=>interlakenMatcher(limits,evaluate)).toThrow()
})
