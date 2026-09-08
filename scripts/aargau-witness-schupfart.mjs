import assert from 'node:assert/strict'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { witnessTemplateDigest } from './aargau-witness-rail.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { avaRoadEvaluator,AVA_MEAN_SPEED_REVIEW_KMH } from './aargau-witness-ava.mjs'
import { ROAD_LIMITS } from './enrich-postbus-roads.mjs'
export const SCHUPFART_POLICY='data/aargau-witness-schupfart-policy.json'
export function schupfartTiming(templates,index,pathMetres){
 const seconds=templates.map(t=>t.calls[index+1][1]-t.calls[index][2]);assert(seconds.length&&seconds.every(Number.isFinite))
 const minimumSourceSeconds=Math.min(...seconds),maximumSourceSeconds=Math.max(...seconds)
 const maximumRequiredMeanKmh=minimumSourceSeconds>0?pathMetres/minimumSourceSeconds*3.6:null
 const holdReason=minimumSourceSeconds<=0?'nonpositive-source-interval':maximumRequiredMeanKmh>AVA_MEAN_SPEED_REVIEW_KMH?'source-mean-speed':null
 return {minimumSourceSeconds,maximumSourceSeconds,maximumRequiredMeanKmh,holdReason,interpretation:'Original minute-granularity intervals; no fabricated time or rounding allowance. The 80 km/h mean is a review threshold, not legal or operating certification.'}
}
export function validateSchupfartAdvertised(input,advertised){
 const trains=input.trains.filter(t=>t.routeId==='96-138-1-j26-1'),stops=new Map(input.stops.map(s=>[s[4],s[2]])),used=new Set(),rows=[]
 for(const g of advertised.groups)for(const d of g.departures){
  const [h,m]=d.time.split(':').map(Number),start=h*3600+m*60,names=g.stops.map(n=>advertised.nameBindings[n]??n)
  assert.equal(names.length,g.offsetMinutes.length)
  const candidates=trains.filter(t=>t.agencyId==='801'&&t.category==='bus'&&t.activeServiceDates.length===1&&t.activeServiceDates[0]===d.eventDate&&t.calls[0][2]===start&&stops.get(t.calls[0][0])===names[0]&&stops.get(t.calls.at(-1)[0])===names.at(-1))
  assert.equal(candidates.length,1,'Advertised trip must bind uniquely')
  const t=candidates[0];assert(!used.has(t.sourceTripId),'Duplicate advertised trip');used.add(t.sourceTripId)
  let cursor=-1
  const calls=names.map((name,j)=>{
   const index=t.calls.findIndex((c,i)=>i>cursor&&stops.get(c[0])===name);assert(index>=0,'Missing advertised call')
   const seconds=start+g.offsetMinutes[j]*60;assert.equal(t.calls[index][1],seconds,'Advertised arrival mismatch');assert.equal(t.calls[index][2],seconds,'Advertised departure mismatch');cursor=index
   return {printedName:g.stops[j],gtfsName:name,callIndex:index,stopId:t.calls[index][0],seconds}
  })
  rows.push({sourceTripId:t.sourceTripId,sha256:witnessTemplateDigest(t),course:t.shortName,directionId:t.directionId,group:g.id,eventDate:d.eventDate,eventClock:d.time,printedClock:String(h%24).padStart(2,'0')+':'+String(m).padStart(2,'0'),civilDayOffset:Math.floor(h/24),calls,fullCallCount:t.calls.length})
 }
 assert.equal(rows.length,32);assert.equal(used.size,trains.length,'Unadvertised archived event trip')
 return rows
}
export function schupfartMatcher(policy,evaluate){
 assert.equal(policy.schemaVersion,1);assert.deepEqual(policy.roadLimits,ROAD_LIMITS);assert.equal(policy.meanSpeedReviewKmh,AVA_MEAN_SPEED_REVIEW_KMH)
 const rules=new Map(policy.patterns.map(r=>[JSON.stringify([r.agencyId,r.routeId,r.line,r.directionId,r.stops]),r]))
 const ruleFor=(t,stops)=>rules.get(JSON.stringify([t.agencyId,t.routeId,t.route,t.directionId,stops]))
 const permitted=(t,r)=>t.category==='bus'&&t.sourceServiceDate===undefined&&t.serviceOffset===undefined&&r?.templates.some(j=>j.sourceTripId===t.sourceTripId&&j.sha256===witnessTemplateDigest(t))
 return {policy,assertTemplate(t,stops){const r=ruleFor(t,stops);if(r)assert(permitted(t,r),'Unreviewed Schupfart template')},matchPattern(t,stops){
  const r=ruleFor(t,stops);if(!permitted(t,r))return undefined
  const actual=evaluate(t,stops);assert.equal(actual?.length,r.segments.length)
  return r.segments.map((expected,i)=>{
   const {path,...evidence}=actual[i];assert(path)
   assert.equal(geometryDigest(path),expected.pathSha256,'Changed Schupfart diagnostic path');assert.deepEqual(evidence,expected.evidence,'Changed Schupfart road evidence')
   const timing=schupfartTiming([t],i,evidence.pathMetres)
   if(timing.holdReason){assert.equal(expected.disposition,'hold-source-timing');return undefined}
   assert.equal(expected.disposition,'admit-inferred-event-road')
   return {...actual[i],witnessSchupfartPatternId:r.id,advertisedTimetable:'timetable-2026.pdf.gz',sourceTimeScreen:expected.timing}
  })
 }}
}
export async function loadWitnessSchupfart(){
 const policy=await readJson(SCHUPFART_POLICY)
 for(const [file,sha]of Object.entries(policy.files))assert.equal(await hashFile(file),sha,`Changed Schupfart evidence: ${file}`)
 assert.deepEqual(validateSchupfartAdvertised(await readGzipJson('data/aargau-witnesses/source-patterns.json.gz'),await readJson('data/aargau-witness-schupfart-sources/advertised-calls.json')),policy.advertisedVerification)
 return schupfartMatcher(policy,avaRoadEvaluator(await readGzipJson('data/aargau-witness-schupfart-sources/cache.json.gz')))
}
