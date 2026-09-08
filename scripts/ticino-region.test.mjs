import { test } from 'vitest'
import assert from 'node:assert/strict'
import { ticinoRoadMatcher, ticinoAdmission } from './ticino-geometry.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'

test('a missing middle segment excludes the entire source journey',()=>{
  assert.equal(ticinoAdmission({mode:'bus',pathSegments:[0,null,2]}),'excluded-incomplete-geometry')
  assert.equal(ticinoAdmission({mode:'rail',pathSegments:[0,1]}),'admitted')
  assert.equal(ticinoAdmission({mode:'bus',pathSegments:[0],boardingRules:[['0','0'],['2','0']]}),'excluded-reservation-or-coordination-required')
  assert.equal(ticinoAdmission({mode:'bus',pathSegments:[0],stops:[[0,0,0],[1,60,60]]},[{pathMetres:2500}]),'excluded-road-timing-review')
  assert.equal(ticinoAdmission({mode:'ferry',pathSegments:[0]}),'excluded-mode-without-reviewed-geometry')
})
test('road reuse rejects changed agencies, platforms and matcher fallback hops',()=>{
  const stops=[[8.9,46,'A','','a'],[8.91,46,'B','','b']]
  const train={category:'bus',agencyId:'955',routeId:'r',stops:[[0,0,0],[1,60,60]]},id=roadPatternId(train,stops)
  const cache={schemaVersion:1,metadata:{license:'ODbL-1.0',matcher:{completed:true,noTrie:true,warnings:true}},
    patterns:{[id]:[0]},identities:{[id]:{agencyId:'955',routeId:'r',stopIds:['a','b']}},paths:[[[8.9,46],[8.91,46]]],report:{issues:[]}}
  assert.equal(ticinoRoadMatcher(cache).matchPattern(train,stops)[0].geometrySource,'osm')
  assert.throws(()=>ticinoRoadMatcher(cache).matchPattern({...train,agencyId:'801'},stops))
  assert.equal(ticinoRoadMatcher(cache).matchPattern(train,[stops[0],[8.91,46,'B','','different']]),undefined)
  assert.throws(()=>ticinoRoadMatcher({...cache,report:{issues:[{pattern:id,segment:0,reason:'matcher-fallback'}]}}).matchPattern(train,stops))
})
