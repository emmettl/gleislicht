import { expect,test } from 'vitest'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { readGzipJson } from './aargau-seasonal.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { BERN_PLATFORM,loadWitnessEdges,bernPlatformSplit,edgeEvaluator,edgeMatcher } from './aargau-witness-edges.mjs'
const matcher=await loadWitnessEdges(),policy=matcher.policy,input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz')
const network=parseRailNetworkXtf(gunzipSync(await readFile('data/aargau-rail-sources/network.xtf.gz')).toString(),5)
const evaluate=edgeEvaluator(network,await readGzipJson('data/aargau-sources/lines.json.gz'),policy.routes)
const byTrip=new Map(input.trains.map(t=>[t.sourceTripId,t])),train=r=>byTrip.get(r.templates[0].sourceTripId)

test('all ten exact templates resolve eleven gaps and retain original endpoint coordinates',()=>{
 let added=0,templates=0;const borderDirections=new Set(),koblenzPlatforms=new Set()
 for(const r of policy.patterns)for(const j of r.templates){
  const t=byTrip.get(j.sourceTripId);matcher.assertTemplate(t,r.stops)
  const result=matcher.matchPattern(t,r.stops);expect(result.filter(Boolean)).toHaveLength(r.segments.length)
  for(const {index:i} of r.segments){const s=result[i];added++
   expect(s.path[0]).toEqual(r.stops[i].slice(0,2));expect(s.path.at(-1)).toEqual(r.stops[i+1].slice(0,2))
   if(r.line==='S36'){
    expect(s.geometrySource).toBe('agis');expect(s.maximumSnapMetres).toBeLessThan(120)
    expect(s.gapSource.featureId).toBe(364);borderDirections.add(r.directionId)
    koblenzPlatforms.add(r.stops.find(s=>s[4].includes(':329:'))[3])
   }else{
    expect(s.geometrySource).toBe('fot');expect(s.platformProjection.projection.snapMetres).toBeLessThan(75)
    expect(s.platformProjection.gtfsStop[4]).toBe(BERN_PLATFORM)
    expect(Math.max(...s.stationAttachmentsMetres)).toBeLessThan(350)
    expect(s.maximumTopologyAttachmentMetres).toBeLessThan(120)
   }
  }
  templates++
 }
 expect(templates).toBe(10);expect(added).toBe(11)
 expect(borderDirections).toEqual(new Set(['0','1']));expect(koblenzPlatforms).toEqual(new Set(['3','4']))
})

test('Bern curve split preserves original topology and prevents a through journey from doubling back',()=>{
 const r=policy.patterns.find(r=>r.segments.length===2),stop=r.stops.find(s=>s[4]===BERN_PLATFORM)
 const before=structuredClone(network),split=bernPlatformSplit(network,stop),e=split.evidence
 expect(network).toEqual(before);expect(split.network.nodes.size).toBe(network.nodes.size+1)
 expect(split.network.segments.length).toBe(network.segments.length+1)
 for(const [id,node] of network.nodes)expect(split.network.nodes.get(id)).toEqual(node)
 expect(split.network.segments.filter(s=>!e.splitSegmentIds.includes(s.id))).toEqual(network.segments.filter(s=>s.id!==e.sourceCurve.id))
 const [west,east]=e.splitSegmentIds.map(id=>split.network.segments.find(s=>s.id===id))
 expect(west.points[0]).toEqual(e.sourceCurve.points[0]);expect(east.points.at(-1)).toEqual(e.sourceCurve.points.at(-1))
 expect(west.points.at(-1)).toEqual(east.points[0]);expect(west.end).toBe(east.start)
 expect(Math.abs(west.length+east.length-e.sourceCurve.points.slice(1).reduce((n,p,i)=>n+distanceMetres(e.sourceCurve.points[i],p),0))).toBeLessThan(.01)
 const result=matcher.matchPattern(train(r),r.stops)
 expect(result[0].directedSourceSegments.some(s=>s.id===west.id)).toBe(true)
 expect(result[0].directedSourceSegments.some(s=>[s.from,s.to].includes(e.sourceCentre.id))).toBe(false)
 expect(result[1].directedSourceSegments[0].id).toBe(east.id)
 expect(result[0].path.at(-1)).toEqual(result[1].path[0])
 expect(result[0].toOperatingPoint).toBe('8507000');expect(result[1].fromOperatingPoint).toBe('8507000')
})

test('platform 49, moved coordinates, partial patterns, changed calendars and daily feeds cannot inherit rules',()=>{
 for(const r of policy.patterns){
  const t=train(r),calls=structuredClone(t.calls);calls[0][2]++
  for(const change of [{routeId:'other'},{agencyId:'65'},{category:'bus'},{directionId:'other'},{sourceTripId:'other'},{shortName:'other'},{calls},{activeServiceDates:['2026-09-14']},{sourceServiceDate:'2026-04-13'},{serviceOffset:0}])expect(matcher.matchPattern({...t,...change},r.stops)).toBeUndefined()
  expect(()=>matcher.assertTemplate({...t,calls},r.stops)).toThrow('Unreviewed witness edge source template')
  const moved=structuredClone(r.stops);moved[0][0]+=.00001
  expect(matcher.matchPattern(t,moved)).toBeUndefined()
  expect(matcher.matchPattern(t,r.stops.slice(1))).toBeUndefined()
  expect(matcher.matchPattern(t,[...r.stops].reverse())).toBeUndefined()
  if(r.line!=='S36'){
   const wrong=structuredClone(r.stops),s=wrong.find(s=>s[4]===BERN_PLATFORM);s[3]='49';s[4]=s[4].replace(':50',':49')
   expect(matcher.matchPattern(t,wrong)).toBeUndefined()
   expect(()=>bernPlatformSplit(network,s)).toThrow()
  }
 }
 const r=policy.patterns.find(r=>r.line==='S36')
 expect(()=>evaluate({...train(r),activeServiceDates:['2026-09-14']},r.stops)).toThrow('Unreviewed Waldshut operating dates')
})

test('changed path, evidence, station curve or relaxed guards fail closed',()=>{
 for(const r of [policy.patterns.find(r=>r.line==='S36'),policy.patterns.find(r=>r.line!=='S36')]){
  const t=train(r),result=evaluate(t,r.stops),i=r.segments[0].index
  const moved=structuredClone(result);moved[i].path[1][0]+=.00001
  expect(()=>edgeMatcher(policy,()=>moved).matchPattern(t,r.stops)).toThrow('Changed witness edge path')
  const changed=structuredClone(result);changed[i].geometrySource='other'
  expect(()=>edgeMatcher(policy,()=>changed).matchPattern(t,r.stops)).toThrow('Changed witness edge source evidence')
 }
 const r=policy.patterns.find(r=>r.line!=='S36'),broken=structuredClone(network)
 broken.segments.find(s=>s.id==='ch14uvag00087328').points[2][0]+=.00001
 expect(()=>edgeMatcher(policy,edgeEvaluator(broken,{features:[{id:364,properties:{GO_NR:'11',VM_NAME:'Zug',NR:'S41'},geometry:{type:'MultiLineString',coordinates:[[[8,47],[8.01,47]]]}}]},policy.routes)).matchPattern(train(r),r.stops)).toThrow()
 for(const key of ['railLimits','agisLimits']){const changed=structuredClone(policy);changed[key].extraRelaxation=true;expect(()=>edgeMatcher(changed,evaluate)).toThrow()}
})
