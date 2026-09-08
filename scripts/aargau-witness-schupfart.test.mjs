import { expect,test } from 'vitest'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { avaRoadEvaluator } from './aargau-witness-ava.mjs'
import { loadWitnessSchupfart,schupfartMatcher,schupfartTiming,validateSchupfartAdvertised } from './aargau-witness-schupfart.mjs'
const matcher=await loadWitnessSchupfart(),policy=matcher.policy,input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz')
const advertised=await readJson('data/aargau-witness-schupfart-sources/advertised-calls.json'),evaluate=avaRoadEvaluator(await readGzipJson('data/aargau-witness-schupfart-sources/cache.json.gz'))
const byTrip=new Map(input.trains.map(t=>[t.sourceTripId,t])),train=r=>byTrip.get(r.templates[0].sourceTripId)

test('all 32 trips preserve full directed endpoints and the 12 zero-second source exclusions',()=>{
 let added=0,held=0;const directions=new Set(),dates=new Set()
 for(const r of policy.patterns)for(const j of r.templates){
  const t=byTrip.get(j.sourceTripId);matcher.assertTemplate(t,r.stops)
  const result=matcher.matchPattern(t,r.stops);expect(result).toHaveLength(r.stops.length-1)
  for(const [i,s]of result.entries()){
   if(!s){held++;expect(t.calls[i+1][1]-t.calls[i][2]).toBe(0);continue}
   added++;expect(s.path[0]).toEqual(r.stops[i].slice(0,2));expect(s.path.at(-1)).toEqual(r.stops[i+1].slice(0,2));expect(s.geometrySource).toBe('osm')
   expect(s.sourceTimeScreen.maximumRequiredMeanKmh).toBeLessThanOrEqual(80);expect(s.sourceTimeScreen.minimumSourceSeconds).toBeGreaterThan(0)
  }
  directions.add(r.directionId);t.activeServiceDates.forEach(d=>dates.add(d))
 }
 expect({added,held}).toEqual({added:195,held:12});expect(directions).toEqual(new Set(['0','1']));expect(dates).toEqual(new Set(['2026-09-25','2026-09-26','2026-09-27']))
})

test('independent printed timetable binds 113 calls uniquely and preserves after-midnight event-day meaning',()=>{
 const rows=validateSchupfartAdvertised(input,advertised)
 expect(rows).toEqual(policy.advertisedVerification);expect(rows.reduce((n,r)=>n+r.calls.length,0)).toBe(113)
 expect(rows.some(r=>r.eventClock==='25:33'&&r.printedClock==='01:33'&&r.civilDayOffset===1&&r.eventDate==='2026-09-25')).toBe(true)
 const changed=structuredClone(advertised);changed.groups.find(g=>g.id==='moehlin-back-via-oberdorf').departures[0].time='01:33'
 expect(()=>validateSchupfartAdvertised(input,changed)).toThrow('Advertised trip must bind uniquely')
 const shifted=structuredClone(advertised);shifted.groups[0].offsetMinutes[1]++
 expect(()=>validateSchupfartAdvertised(input,shifted)).toThrow('Advertised arrival mismatch')
 const duplicate=structuredClone(advertised);duplicate.groups.push(duplicate.groups[0]);expect(()=>validateSchupfartAdvertised(input,duplicate)).toThrow('Duplicate advertised trip')
 const omitted=structuredClone(advertised);omitted.groups.pop();expect(()=>validateSchupfartAdvertised(input,omitted)).toThrow()
})

test('zero and negative intervals remain held without non-finite JSON values or rounding allowances',()=>{
 const t={calls:[['a',0,0],['b',0,0]]}
 expect(schupfartTiming([t],0,300)).toMatchObject({holdReason:'nonpositive-source-interval',maximumRequiredMeanKmh:null})
 expect(schupfartTiming([{calls:[['a',0,60],['b',0,0]]}],0,300).holdReason).toBe('nonpositive-source-interval')
 expect(schupfartTiming([{calls:[['a',0,0],['b',60,60]]}],0,1400).holdReason).toBe('source-mean-speed')
 const r=policy.patterns.find(r=>r.segments.some(s=>s.timing.holdReason)),changed=structuredClone(policy)
 changed.patterns.find(p=>p.id===r.id).segments.forEach(s=>s.disposition='admit-inferred-event-road')
 expect(()=>schupfartMatcher(changed,evaluate).matchPattern(train(r),r.stops)).toThrow()
})

test('another calendar, mode, platform, course, source call or daily instance cannot inherit a festival path',()=>{
 const r=policy.patterns[0],t=train(r),calls=structuredClone(t.calls);calls[0][2]++
 for(const change of [{agencyId:'7244'},{routeId:'other'},{route:'89'},{directionId:'other'},{category:'rail'},{sourceTripId:'other'},{shortName:'other'},{calls},{activeServiceDates:['2025-09-25']},{sourceServiceDate:'2026-09-25'},{serviceOffset:0}])expect(matcher.matchPattern({...t,...change},r.stops)).toBeUndefined()
 expect(()=>matcher.assertTemplate({...t,calls},r.stops)).toThrow('Unreviewed Schupfart template')
 const moved=structuredClone(r.stops);moved[0][0]+=.00001
 for(const stops of [moved,r.stops.slice(1),[...r.stops].reverse()])expect(matcher.matchPattern(t,stops)).toBeUndefined()
})

test('replayed measurements tolerate binary rounding but reject meaningful drift',()=>{
 const r=policy.patterns[0],t=train(r),actual=evaluate(t,r.stops)
 const rounded=structuredClone(actual);rounded[0].pathMetres+=1e-10
 expect(()=>schupfartMatcher(policy,()=>rounded).matchPattern(t,r.stops)).not.toThrow()
 for(const value of [actual[0].pathMetres+0.001,NaN,Infinity]){
  const changed=structuredClone(actual);changed[0].pathMetres=value
  expect(()=>schupfartMatcher(policy,()=>changed).matchPattern(t,r.stops)).toThrow('Changed Schupfart road evidence')
 }
})

test('changed admitted or held geometry and source evidence fail closed',()=>{
 const r=policy.patterns.find(r=>r.segments.some(s=>s.timing.holdReason)),t=train(r),actual=evaluate(t,r.stops)
 for(const i of [0,r.segments.find(s=>s.timing.holdReason).index]){
  const path=structuredClone(actual);path[i].path[1][0]+=.00001
  expect(()=>schupfartMatcher(policy,()=>path).matchPattern(t,r.stops)).toThrow('Changed Schupfart diagnostic path')
  const evidence=structuredClone(actual);evidence[i].roadPatternId='other'
  expect(()=>schupfartMatcher(policy,()=>evidence).matchPattern(t,r.stops)).toThrow('Changed Schupfart road evidence')
 }
 for(const change of [p=>p.meanSpeedReviewKmh=100,p=>p.roadLimits.snapMetres=200]){const relaxed=structuredClone(policy);change(relaxed);expect(()=>schupfartMatcher(relaxed,evaluate)).toThrow()}
})
