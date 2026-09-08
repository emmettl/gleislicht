import { expect,test } from 'vitest'
import { readGzipJson,readJson } from './aargau-seasonal.mjs'
import { avaRoadEvaluator } from './aargau-witness-ava.mjs'
import { loadWitnessLenzburg,lenzburgMatcher,lenzburgNoticeContext,LENZBURG_DATES } from './aargau-witness-lenzburg.mjs'
const matcher=await loadWitnessLenzburg(),policy=matcher.policy,input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz')
const inventory=await readJson('data/aargau-witnesses/bus-inventory.json'),evaluate=avaRoadEvaluator(await readGzipJson('data/aargau-witness-lenzburg-sources/cache.json.gz'))
const byTrip=new Map(input.trains.map(t=>[t.sourceTripId,t])),train=r=>byTrip.get(r.templates[0].sourceTripId)

test('all 300 May templates preserve directed endpoints and 77 distance exclusions',()=>{
 let added=0,held=0;const directions=new Set(),dates=new Set()
 for(const r of policy.patterns)for(const j of r.templates){
  const t=byTrip.get(j.sourceTripId);matcher.assertTemplate(t,r.stops)
  const result=matcher.matchPattern(t,r.stops);expect(result).toHaveLength(r.stops.length-1)
  for(const [i,s]of result.entries()){
   if(!s){held++;expect(r.segments[i]).toMatchObject({disposition:'hold-road-geometry',pathSha256:null,evidence:{roadFailure:'stop-too-far'}});expect(r.segments[i].rejection.snap).toBeGreaterThan(120);continue}
   added++;expect(s.path[0]).toEqual(r.stops[i].slice(0,2));expect(s.path.at(-1)).toEqual(r.stops[i+1].slice(0,2));expect(s.geometrySource).toBe('osm')
   expect(s.sourceTimeScreen.maximumRequiredMeanKmh).toBeLessThanOrEqual(80);expect(s.sourceTimeScreen.minimumSourceSeconds).toBeGreaterThan(0)
  }
  directions.add(r.directionId);t.activeServiceDates.forEach(d=>dates.add(d))
 }
 expect({added,held}).toEqual({added:582,held:77});expect(directions).toEqual(new Set(['0','1']));expect(dates).toEqual(new Set(LENZBURG_DATES))
})

test('EV5 retains Seon Nord only in its source direction; later EV4 services cannot inherit May evidence',()=>{
 for(const r of policy.patterns.filter(r=>r.line==='EV5'))expect(r.stops.some(s=>s[4]==='ch:1:sloid:2675:0:02')).toBe(r.directionId==='0')
 const later=inventory.patterns.filter(r=>r.routeId==='92-A01-N-j26-1'&&!policy.patterns.some(p=>p.id===r.id))
 expect(later).toHaveLength(2);expect(later.reduce((n,r)=>n+r.templates.length,0)).toBe(7)
 for(const r of later)for(const j of r.templates)expect(matcher.matchPattern(byTrip.get(j.sourceTripId),r.stops)).toBeUndefined()
})

test('notice dates and named closure corridors are required, not inferred from an EV label',()=>{
 const r=policy.patterns[0],t=train(r)
 for(const change of [n=>n.publicationDate='2026-05-23',n=>n.facts.closureEndDate='2026-05-25',n=>n.facts.replacementBusesConfirmed=false,n=>n.facts.closedRailCorridors.pop()]){
  const n=structuredClone(policy.source.notice);change(n);expect(()=>lenzburgNoticeContext(r,[t],n)).toThrow()
 }
 expect(()=>lenzburgNoticeContext(r,[{...t,activeServiceDates:['2026-09-27']}],policy.source.notice)).toThrow('Unreviewed Lenzburg service dates')
 const reverse=structuredClone(r);reverse.stops.reverse();expect(()=>lenzburgNoticeContext(reverse,[t],policy.source.notice)).toThrow()
})

test('changed calls, calendar, mode, identity, platform or daily instances cannot inherit paths',()=>{
 const r=policy.patterns[0],t=train(r),calls=structuredClone(t.calls);calls[0][2]++
 for(const change of [{agencyId:'7244'},{routeId:'other'},{route:'EV9'},{directionId:'other'},{category:'rail'},{sourceTripId:'other'},{shortName:'other'},{calls},{activeServiceDates:['2026-09-27']},{sourceServiceDate:'2026-05-23'},{serviceOffset:0}])expect(matcher.matchPattern({...t,...change},r.stops)).toBeUndefined()
 expect(()=>matcher.assertTemplate({...t,calls},r.stops)).toThrow('Unreviewed Lenzburg template')
 const moved=structuredClone(r.stops);moved[0][0]+=.00001
 for(const stops of [moved,r.stops.slice(1),[...r.stops].reverse()])expect(matcher.matchPattern(t,stops)).toBeUndefined()
})

test('changed paths, missing evidence, fabricated rejected paths or relaxed limits fail closed',()=>{
 const r=policy.patterns.find(r=>r.segments.some(s=>s.pathSha256)),t=train(r),actual=evaluate(t,r.stops),i=r.segments.find(s=>s.pathSha256).index
 const path=structuredClone(actual);path[i].path[1][0]+=.00001
 expect(()=>lenzburgMatcher(policy,()=>path).matchPattern(t,r.stops)).toThrow('Changed Lenzburg diagnostic path')
 const evidence=structuredClone(actual);evidence[i].roadPatternId='other'
 expect(()=>lenzburgMatcher(policy,()=>evidence).matchPattern(t,r.stops)).toThrow('Changed Lenzburg road evidence')
 expect(()=>lenzburgMatcher(policy,()=>undefined).matchPattern(t,r.stops)).toThrow()
 const missing=structuredClone(actual);delete missing[i].path
 expect(()=>lenzburgMatcher(policy,()=>missing).matchPattern(t,r.stops)).toThrow()
 const held=policy.patterns.find(r=>r.segments.some(s=>!s.pathSha256)),ht=train(held),hi=held.segments.find(s=>!s.pathSha256).index
 const fabricated=evaluate(ht,held.stops);fabricated[hi].path=[held.stops[hi].slice(0,2),held.stops[hi+1].slice(0,2)]
 expect(()=>lenzburgMatcher(policy,()=>fabricated).matchPattern(ht,held.stops)).toThrow('Changed Lenzburg diagnostic path')
 const changed=structuredClone(policy);changed.patterns.find(p=>p.id===held.id).segments[hi].disposition='admit-inferred-may-road'
 expect(()=>lenzburgMatcher(changed,evaluate).matchPattern(ht,held.stops)).toThrow()
 for(const change of [p=>p.meanSpeedReviewKmh=100,p=>p.roadLimits.snapMetres=200]){const relaxed=structuredClone(policy);change(relaxed);expect(()=>lenzburgMatcher(relaxed,evaluate)).toThrow()}
})
