import { expect, test } from 'vitest'
import { readGzipJson } from './aargau-seasonal.mjs'
import { loadAargauRail } from './aargau-rail-geometry.mjs'
import { loadWitnessRail, witnessRailMatcher, WITNESS_RAIL_POLICY } from './aargau-witness-rail.mjs'
const reviewed=await loadWitnessRail(),source=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz')
const byTrip=new Map(source.trains.map(t=>[t.sourceTripId,t]))
const trainFor=r=>({...byTrip.get(r.templates[0].sourceTripId),stops:r.stops.map((_,i)=>[i,0,0])})

test('all 194 reviewed patterns retain exact endpoints and pinned source assessments',()=>{
  let accepted=0,rejected=0,preserved=0
  for(const r of reviewed.policy.patterns) {
    const t=trainFor(r);expect(()=>reviewed.assertTemplate(t,r.stops)).not.toThrow()
    const segments=reviewed.matchPattern(t,r.stops)
    for(const [i,s] of segments.entries()) {
      if(r.segments[i].preserveExistingGeometry) {expect(s).toBeUndefined();preserved++;continue}
      if(s.path) {accepted++;expect(s.path[0]).toEqual(r.stops[i].slice(0,2));expect(s.path.at(-1)).toEqual(r.stops[i+1].slice(0,2));expect(s.witnessRailPatternId).toBe(r.id)}
      else {rejected++;expect(s.railFailure).toBe(r.segments[i].evidence.railFailure)}
    }
  }
  expect(accepted).toBeGreaterThan(1000);expect(rejected).toBeGreaterThan(0);expect(preserved).toBeGreaterThan(0)
})

test('changed identity, calendar, calls, direction or coordinates cannot inherit a reviewed path',()=>{
  const r=reviewed.policy.patterns[0],t=trainFor(r),calls=structuredClone(t.calls);calls[0][2]++
  for(const change of [{agencyId:'other'},{routeId:'other'},{route:'other'},{category:'bus'},{directionId:'other'},{sourceTripId:'other'},{serviceId:'other'},{shortName:'other'},{sourceServiceDate:'2026-09-04'},{serviceOffset:0},{activeServiceDates:['2026-09-04']},{calls}]) {
    expect(reviewed.matchPattern({...t,...change},r.stops)).toBeUndefined()
    if(change.category!=='bus') expect(()=>reviewed.assertTemplate({...t,...change},r.stops)).toThrow('Unreviewed witness')
  }
  const moved=structuredClone(r.stops);moved[0][0]+=.00001
  expect(reviewed.matchPattern(t,moved)).toBeUndefined()
  expect(reviewed.matchPattern(t,[...r.stops].reverse())).toBeUndefined()
  const {activeServiceDates:_calendar,serviceId:_service,...dayFeedTrain}=t
  expect(reviewed.matchPattern(dayFeedTrain,r.stops)).toBeUndefined()
})

test('both changed path bytes and changed infrastructure evidence fail closed',async()=>{
  const r=reviewed.policy.patterns.find(r=>r.segments.some(s=>s.pathSha256)),t=trainFor(r)
  const rails=await loadAargauRail('data/aargau-rail-sources',WITNESS_RAIL_POLICY)
  const original=rails.matchPattern(t,r.stops),index=r.segments.findIndex(s=>s.pathSha256)
  const moved=structuredClone(original);moved[index].path[1][0]+=.00001
  expect(()=>witnessRailMatcher(reviewed.policy,{matchPattern:()=>moved}).matchPattern(t,r.stops)).toThrow('Changed witness rail path')
  const changed=structuredClone(original);changed[index].directedSourceSegments[0].id='other'
  expect(()=>witnessRailMatcher(reviewed.policy,{matchPattern:()=>changed}).matchPattern(t,r.stops)).toThrow('Changed witness rail source evidence')
})

test('Waldshut, Bern 49 and Interlaken failures remain explicit without relaxed limits',()=>{
  const failures=new Set()
  for(const r of reviewed.policy.patterns) for(const s of reviewed.matchPattern(trainFor(r),r.stops)) if(s?.railFailure) failures.add(s.railFailure)
  expect(failures).toEqual(new Set(['no-exact-operating-point','station-attachment-too-far','disconnected-excessive-detour-or-stop-order']))
  const changed=structuredClone(reviewed.policy);changed.limits.stationAttachmentMetres=500
  expect(()=>witnessRailMatcher(changed,{})).toThrow()
})
