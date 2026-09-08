import assert from 'node:assert/strict'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { witnessTemplateDigest } from './aargau-witness-rail.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { avaRoadEvaluator,avaTiming,AVA_MEAN_SPEED_REVIEW_KMH } from './aargau-witness-ava.mjs'
import { ROAD_LIMITS } from './enrich-postbus-roads.mjs'
export const LENZBURG_POLICY='data/aargau-witness-lenzburg-policy.json'
export const LENZBURG_DATES=['2026-05-23','2026-05-24','2026-05-25']
const corridors={
 '92-A01-N-j26-1':{line:'EV4',from:'Othmarsingen, Bahnhof',to:'Lenzburg, Bahnhof',noticeCorridor:0},
 '92-EV5-V-j26-1':{line:'EV5',from:'Beinwil am See, Bahnhof',to:'Lenzburg, Bahnhof',noticeCorridor:2},
 '92-EV7-R-j26-1':{line:'EV7',from:'Hunzenschwil, Bahnhof',to:'Lenzburg, Bahnhof',noticeCorridor:1},
 '92-EV9-I-j26-1':{line:'EV9',from:'Rupperswil, Bahnhof',to:'Othmarsingen, Bahnhof',noticeCorridor:0}
}
export function lenzburgNoticeContext(rule,templates,notice){
 assert.equal(notice.publicationDate,'2026-04-22');assert.equal(notice.facts.closureStartDate,'2026-05-23');assert.equal(notice.facts.closureEndDate,'2026-05-26');assert.equal(notice.facts.replacementBusesConfirmed,true)
 assert.deepEqual(notice.facts.closedRailCorridors,[['Rupperswil','Lenzburg','Othmarsingen'],['Hunzenschwil','Lenzburg'],['Beinwil am See','Lenzburg']])
 const context=corridors[rule.routeId];assert(context);assert.equal(rule.agencyId,'7231');assert.equal(rule.line,context.line);assert(['0','1'].includes(rule.directionId))
 const ends=rule.directionId==='0'?[context.from,context.to]:[context.to,context.from]
 assert.deepEqual([rule.stops[0][2],rule.stops.at(-1)[2]],ends)
 if(rule.line==='EV9')assert.equal(rule.stops[1][2],'Lenzburg, Bahnhof')
 for(const t of templates){assert.equal(t.agencyId,rule.agencyId);assert.equal(t.routeId,rule.routeId);assert.equal(t.directionId,rule.directionId);assert(t.activeServiceDates.length>0&&t.activeServiceDates.every(d=>LENZBURG_DATES.includes(d)),'Unreviewed Lenzburg service dates')}
 return {noticeCorridor:notice.facts.closedRailCorridors[context.noticeCorridor],endpoints:ends,serviceDates:[...new Set(templates.flatMap(t=>t.activeServiceDates))].sort(),templates:templates.length,fullCalls:templates.reduce((n,t)=>n+t.calls.length,0),noticeVerifies:'Dated disruption and replacement-bus corridor only. EV labels, complete platforms, exact calls and calendars are from independently verified GTFS; no printed bus timetable or street itinerary is claimed.'}
}
export function lenzburgMatcher(policy,evaluate){
 assert.equal(policy.schemaVersion,1);assert.deepEqual(policy.roadLimits,ROAD_LIMITS);assert.equal(policy.meanSpeedReviewKmh,AVA_MEAN_SPEED_REVIEW_KMH)
 const rules=new Map(policy.patterns.map(r=>[JSON.stringify([r.agencyId,r.routeId,r.line,r.directionId,r.stops]),r]))
 const ruleFor=(t,stops)=>rules.get(JSON.stringify([t.agencyId,t.routeId,t.route,t.directionId,stops]))
 const permitted=(t,r)=>t.category==='bus'&&t.sourceServiceDate===undefined&&t.serviceOffset===undefined&&r?.templates.some(j=>j.sourceTripId===t.sourceTripId&&j.sha256===witnessTemplateDigest(t))
 return {policy,assertTemplate(t,stops){const r=ruleFor(t,stops);if(r)assert(permitted(t,r),'Unreviewed Lenzburg template')},matchPattern(t,stops){
  const r=ruleFor(t,stops);if(!permitted(t,r))return undefined
  lenzburgNoticeContext(r,[t],policy.source.notice)
  const actual=evaluate(t,stops);assert.equal(actual?.length,r.segments.length)
  return r.segments.map((expected,i)=>{
   const {path,...evidence}=actual[i];assert.deepEqual(evidence,expected.evidence,'Changed Lenzburg road evidence')
   if(!path){assert.equal(expected.pathSha256,null);assert.equal(expected.disposition,'hold-road-geometry');return undefined}
   assert.equal(geometryDigest(path),expected.pathSha256,'Changed Lenzburg diagnostic path')
   const timing=avaTiming([t],i,evidence.pathMetres)
   if(timing.held){assert.equal(expected.disposition,'hold-source-timing');return undefined}
   assert.equal(expected.disposition,'admit-inferred-may-road')
   return {...actual[i],witnessLenzburgPatternId:r.id,operatorNotice:'SBB 2026-04-22',sourceTimeScreen:expected.timing}
  })
 }}
}
export async function loadWitnessLenzburg(){
 const policy=await readJson(LENZBURG_POLICY)
 for(const [file,sha]of Object.entries(policy.files))assert.equal(await hashFile(file),sha,`Changed Lenzburg evidence: ${file}`)
 const input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz')
 for(const r of policy.patterns){const ts=r.templates.map(j=>{const t=input.trains.find(t=>t.sourceTripId===j.sourceTripId);assert.equal(witnessTemplateDigest(t),j.sha256);return t});assert.deepEqual(lenzburgNoticeContext(r,ts,policy.source.notice),r.noticeContext)}
 return lenzburgMatcher(policy,avaRoadEvaluator(await readGzipJson('data/aargau-witness-lenzburg-sources/cache.json.gz')))
}
