import { describe, it, expect } from 'vitest'
import { completeAccessPattern } from './graubuenden-access-roads.mjs'
const route={routeId:'r',agencyId:'801',line:'411'}, train={calls:[{id:'a'},{id:'b'},{id:'c'}]}
const stops=new Map([['a',{stop_lon:9,stop_lat:46}],['b',{stop_lon:9.01,stop_lat:46}],['c',{stop_lon:9.02,stop_lat:46}]])
const cache={patterns:{p:[0,1]},paths:[[[9,46],[9.005,46.001],[9.01,46]],[[9.01,46],[9.015,46.001],[9.02,46]]]}
const review={routes:[route],admittedPatternIds:['p']}, original=[{path:[[9,46],[9.01,46]],geometrySource:'osm'},{reason:'road-missing-shape'}]
const match=(a=original,c=cache,r=review,t=train,s=stops,identity=route)=>completeAccessPattern(a,'p',identity,t,s,c,r)
describe('Graubünden whole-pattern access-road recovery',()=>{
 it('retains every complete primary path and its evidence exactly',()=>{
  const a=[original[0],{...original[0],path:[[9.01,46],[9.02,46]]}]
  expect(match(a)).toBe(a)
 })
 it('replaces the entire reviewed pattern and records primary failures without mutating the source cache',()=>{
  const before=structuredClone(cache),p=match()
  expect(p.map(x=>x.path)).toEqual(cache.paths);expect(p[0].path).not.toEqual(original[0].path)
  expect(p.map(x=>[x.geometrySource,x.roadSegmentIndex,x.primaryFailure])).toEqual([['osm-access-road-inference',0,null],['osm-access-road-inference',1,'road-missing-shape']])
  expect(cache).toEqual(before);expect(p[0].path).not.toBe(cache.paths[0])
 })
 it('does not combine partial runs or use an unapproved complete trial',()=>{
  expect(()=>match(original,{...cache,patterns:{p:[null,1]}})).toThrow('Incomplete')
  expect(match(original,cache,{...review,admittedPatternIds:[]})).toBe(original)
  expect(match(original,cache,{...review,routes:[]})).toBe(original)
 })
 it('rejects changed operator identity, call count and ordered endpoints',()=>{
  expect(()=>match(original,cache,review,train,stops,{...route,agencyId:'different'})).toThrow()
  expect(()=>match(original,cache,review,{calls:[...train.calls,{id:'a'}]})).toThrow('Incomplete')
  expect(()=>match(original,cache,review,{calls:[...train.calls].reverse()})).toThrow('endpoints')
 })
})
