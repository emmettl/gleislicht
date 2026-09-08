import { expect,test } from 'vitest'
import { readGzipJson } from './aargau-seasonal.mjs'
import { loadWitnessAva,avaMatcher,avaRoadEvaluator,avaTiming,avaPeriod } from './aargau-witness-ava.mjs'
const matcher=await loadWitnessAva(),policy=matcher.policy,input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz')
const evaluate=avaRoadEvaluator(await readGzipJson('data/aargau-witness-ava-sources/cache.json.gz'))
const byTrip=new Map(input.trains.map(t=>[t.sourceTripId,t])),train=r=>byTrip.get(r.templates[0].sourceTripId)

test('every one of 336 templates preserves source endpoints and all dated/timing exclusions',()=>{
 let added=0,heldTiming=0,heldSeptember=0;const directions=new Set(),dates=new Set()
 for(const r of policy.patterns)for(const j of r.templates){
  const t=byTrip.get(j.sourceTripId);matcher.assertTemplate(t,r.stops)
  const result=matcher.matchPattern(t,r.stops);expect(result).toHaveLength(r.stops.length-1)
  for(const [i,s]of result.entries()){
   if(r.period==='september'){expect(s).toBeUndefined();heldSeptember++;continue}
   if(r.segments[i].disposition==='hold-source-timing'){expect(s).toBeUndefined();heldTiming++;continue}
   expect(s.path[0]).toEqual(r.stops[i].slice(0,2));expect(s.path.at(-1)).toEqual(r.stops[i+1].slice(0,2))
   expect(s.geometrySource).toBe('osm');expect(s.sourceTimeScreen.maximumRequiredMeanKmh).toBeLessThanOrEqual(80)
   added++;directions.add(r.directionId);t.activeServiceDates.forEach(d=>dates.add(d))
  }
 }
 expect({added,heldTiming,heldSeptember}).toEqual({added:2466,heldTiming:161,heldSeptember:1989})
 expect(directions).toEqual(new Set(['0','1']));expect(dates).toEqual(new Set(['2026-04-25','2026-04-26']))
})

test('a successful numerical road match cannot bypass a closure or source-time hold',()=>{
 const september=policy.patterns.find(r=>r.period==='september'),timed=policy.patterns.find(r=>r.segments.some(s=>s.timing.held))
 expect(evaluate(train(september),september.stops).every(s=>s.path)).toBe(true)
 for(const r of [september,timed]){
  const altered=structuredClone(policy);altered.patterns.find(p=>p.id===r.id).segments.forEach(s=>s.disposition='admit-inferred-april')
  expect(()=>avaMatcher(altered,evaluate).matchPattern(train(r),r.stops)).toThrow()
 }
 const t={calls:[['from',0,0],['to',60,60]]}
 expect(avaTiming([t],0,80/3.6*60).held).toBe(false)
 expect(avaTiming([t],0,80.01/3.6*60).held).toBe(true)
 expect(()=>avaTiming([{calls:[['from',0,60],['to',60,60]]}],0,100)).toThrow('Nonpositive AVA source interval')
 expect(()=>avaPeriod(['2026-04-25','2026-09-12'])).toThrow('Unreviewed AVA service dates')
})

test('another calendar, source trip, operator, mode, direction, stop chain or daily feed cannot inherit paths',()=>{
 const r=policy.patterns[0],t=train(r),calls=structuredClone(t.calls);calls[0][2]++
 for(const change of [{agencyId:'801'},{routeId:'other'},{category:'rail'},{directionId:'other'},{route:'S14'},{sourceTripId:'other'},{shortName:'other'},{calls},{activeServiceDates:['2026-09-04']},{sourceServiceDate:'2026-04-25'},{serviceOffset:0}])expect(matcher.matchPattern({...t,...change},r.stops)).toBeUndefined()
 expect(()=>matcher.assertTemplate({...t,calls},r.stops)).toThrow('Unreviewed AVA witness template')
 const moved=structuredClone(r.stops);moved[0][0]+=.00001
 expect(matcher.matchPattern(t,moved)).toBeUndefined();expect(matcher.matchPattern(t,r.stops.slice(1))).toBeUndefined();expect(matcher.matchPattern(t,[...r.stops].reverse())).toBeUndefined()
})

test('changed admitted or held geometry, source evidence and relaxed guards fail closed',()=>{
 for(const r of [policy.patterns[0],policy.patterns.find(r=>r.period==='september')]){
  const t=train(r),result=evaluate(t,r.stops),changed=structuredClone(result)
  for (const drift of [1e-12, 1e-6]) {
   const rounded = structuredClone(result); rounded[0].endpointAdjustmentMetres += drift
   const replay = () => avaMatcher(policy, () => rounded).matchPattern(t, r.stops)
   if (drift < 1e-7) expect(replay).not.toThrow()
   else expect(replay).toThrow('Changed AVA road evidence')
  }
  changed[0].path[1][0]+=.00001
  expect(()=>avaMatcher(policy,()=>changed).matchPattern(t,r.stops)).toThrow('Changed AVA diagnostic path')
  const evidence=structuredClone(result);evidence[0].roadPatternId='other'
  expect(()=>avaMatcher(policy,()=>evidence).matchPattern(t,r.stops)).toThrow('Changed AVA road evidence')
 }
 const altered=structuredClone(policy);altered.meanSpeedReviewKmh=110
 expect(()=>avaMatcher(altered,evaluate)).toThrow()
 const relaxed=structuredClone(policy);relaxed.roadLimits.snapMetres=200
 expect(()=>avaMatcher(relaxed,evaluate)).toThrow()
})
