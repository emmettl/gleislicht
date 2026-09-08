import { expect,test } from 'vitest'
import { readGzipJson } from './aargau-seasonal.mjs'
import { avaRoadEvaluator } from './aargau-witness-ava.mjs'
import { loadWitnessOberentfelden,oberentfeldenMatcher,oberentfeldenClosure,minimumPolylineDistance } from './aargau-witness-oberentfelden.mjs'
const matcher=await loadWitnessOberentfelden(),policy=matcher.policy,input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz')
const source=await readGzipJson('data/aargau-witness-oberentfelden-sources/osm.json.gz'),evaluate=avaRoadEvaluator(await readGzipJson('data/aargau-witness-ava-sources/cache.json.gz'))
const byTrip=new Map(input.trains.map(t=>[t.sourceTripId,t])),train=r=>byTrip.get(r.templates[0].sourceTripId)

test('all 153 September templates hold the closure crossing in both directions and preserve other endpoints',()=>{
 let added=0,held=0;const directions=new Set(),dates=new Set()
 for(const r of policy.patterns)for(const j of r.templates){
  const t=byTrip.get(j.sourceTripId);matcher.assertTemplate(t,r.stops)
  const result=matcher.matchPattern(t,r.stops);expect(result).toHaveLength(r.stops.length-1)
  for(const [i,s] of result.entries()){
   if(!s){held++;expect([r.stops[i][2],r.stops[i+1][2]].sort()).toEqual(['Oberentfelden, Engelplatz','Oberentfelden, Uerkenbrücke']);continue}
   added++;expect(s.path[0]).toEqual(r.stops[i].slice(0,2));expect(s.path.at(-1)).toEqual(r.stops[i+1].slice(0,2))
   expect(s.geometrySource).toBe('osm');expect(s.closureClearance.minimumMetres).toBeGreaterThan(73.7)
   expect(s.sourceTimeScreen.maximumRequiredMeanKmh).toBeLessThanOrEqual(80)
  }
  directions.add(r.directionId);t.activeServiceDates.forEach(d=>dates.add(d))
 }
 expect({added,held}).toEqual({added:1836,held:153});expect(directions).toEqual(new Set(['0','1']));expect(dates).toEqual(new Set(['2026-09-12','2026-09-13']))
})

test('distance checks complete line segments, including crossings, collinear overlap and degenerate vertices',()=>{
 const vertical=[[0,-.01],[0,.01]],horizontal=[[-.01,0],[.01,0]]
 expect(minimumPolylineDistance(horizontal,vertical)).toBe(0)
 expect(minimumPolylineDistance([[0,-.02],[0,0]],vertical)).toBe(0)
 expect(minimumPolylineDistance([[0,.02],[0,.03]],vertical)).toBeCloseTo(1111.949,2)
 expect(minimumPolylineDistance([[.001,-.01],[.001,.01]],vertical)).toBeCloseTo(111.1949,3)
 expect(minimumPolylineDistance([[0,0],[0,0]],vertical)).toBe(0)
 expect(minimumPolylineDistance([[.001,0],[.001,0]],vertical)).toBeCloseTo(111.1949,3)
 for(const r of policy.patterns)for(const s of evaluate(train(r),r.stops))expect(minimumPolylineDistance([...s.path].reverse(),policy.closure.points)).toBeCloseTo(minimumPolylineDistance(s.path,policy.closure.points),8)
})

test('closure extraction binds named junctions and exact source topology',()=>{
 expect(oberentfeldenClosure(source)).toEqual(policy.closure)
 expect(policy.closure.nodeIds[0]).toBe(266859069);expect(policy.closure.nodeIds.at(-1)).toBe(266859071)
 expect(policy.closure.lengthMetres).toBeCloseTo(181.505,3)
 for(const mutate of [s=>s.elements.find(e=>e.type==='way'&&e.id===48878570).tags.name='Other',s=>s.elements.find(e=>e.type==='way'&&e.id===769045499).nodes.pop(),s=>{s.elements=s.elements.filter(e=>e.type!=='way'||e.tags?.name!=='Isegüetlistrasse')},s=>s.elements.find(e=>e.type==='node'&&e.id===266859070).lat+=.1]){
  const changed=structuredClone(source);mutate(changed);expect(()=>oberentfeldenClosure(changed)).toThrow()
 }
})

test('changed templates, calendars, platform chains and daily feed instances cannot inherit September paths',()=>{
 const r=policy.patterns[0],t=train(r),calls=structuredClone(t.calls);calls[0][2]++
 for(const change of [{agencyId:'801'},{routeId:'other'},{route:'S14'},{directionId:'other'},{category:'rail'},{sourceTripId:'other'},{shortName:'other'},{calls},{activeServiceDates:['2026-04-25']},{sourceServiceDate:'2026-09-12'},{serviceOffset:0}])expect(matcher.matchPattern({...t,...change},r.stops)).toBeUndefined()
 expect(()=>matcher.assertTemplate({...t,calls},r.stops)).toThrow('Unreviewed Oberentfelden template')
 const moved=structuredClone(r.stops);moved[0][0]+=.00001
 for(const stops of [moved,r.stops.slice(1),[...r.stops].reverse()])expect(matcher.matchPattern(t,stops)).toBeUndefined()
})

test('measurement roundoff preserves admitted and held segments but meaningful drift fails closed',()=>{
 const r=policy.patterns[0],t=train(r),actual=evaluate(t,r.stops)
 const admitted=r.segments.findIndex(s=>s.disposition==='admit-clear-of-closure'),held=r.segments.findIndex(s=>s.disposition==='hold-closed-road-crossing')
 expect(admitted).toBeGreaterThanOrEqual(0);expect(held).toBeGreaterThanOrEqual(0)
 for(const i of [admitted,held])for(const field of ['endpointAdjustmentMetres','pathMetres']){
  const rounded=structuredClone(actual);rounded[i][field]+=1e-12
  const replay=oberentfeldenMatcher(policy,()=>rounded).matchPattern(t,r.stops)
  expect(replay[admitted].path).toEqual(actual[admitted].path);expect(replay[held]).toBeUndefined()
  const changed=structuredClone(actual);changed[i][field]+=1e-6
  expect(()=>oberentfeldenMatcher(policy,()=>changed).matchPattern(t,r.stops)).toThrow('Changed Oberentfelden road evidence')
 }
})

test('edited clearance decisions, paths, evidence or relaxed buffer fail closed',()=>{
 const r=policy.patterns[0],t=train(r),actual=evaluate(t,r.stops)
 const relaxed=structuredClone(policy);relaxed.clearanceMetres=0;expect(()=>oberentfeldenMatcher(relaxed,evaluate)).toThrow()
 const changedClosure=structuredClone(policy);changedClosure.closure.points[0][0]+=.001
 expect(()=>oberentfeldenMatcher(changedClosure,evaluate).matchPattern(t,r.stops)).toThrow('Changed closure clearance')
 const admitCrossing=structuredClone(policy);admitCrossing.patterns[0].segments.find(s=>s.disposition==='hold-closed-road-crossing').disposition='admit-clear-of-closure'
 expect(()=>oberentfeldenMatcher(admitCrossing,evaluate).matchPattern(t,r.stops)).toThrow()
 for(const i of [0,r.segments.find(s=>s.disposition==='hold-closed-road-crossing').index]){
  const changed=structuredClone(actual);changed[i].path[1][0]+=.00001
  expect(()=>oberentfeldenMatcher(policy,()=>changed).matchPattern(t,r.stops)).toThrow('Changed Oberentfelden candidate path')
  const evidence=structuredClone(actual);evidence[i].roadPatternId='other'
  expect(()=>oberentfeldenMatcher(policy,()=>evidence).matchPattern(t,r.stops)).toThrow('Changed Oberentfelden road evidence')
 }
})
