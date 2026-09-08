import { assertGeometryMeasurementsEqual } from './compare-geometry-measurements.mjs'
import assert from 'node:assert/strict'
import { hashFile } from './inventory-aargau.mjs'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { aargauRoadMatcher } from './aargau-road-geometry.mjs'
import { witnessTemplateDigest } from './aargau-witness-rail.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { ROAD_LIMITS } from './enrich-postbus-roads.mjs'
export const AVA_POLICY='data/aargau-witness-ava-policy.json'
export const AVA_MEAN_SPEED_REVIEW_KMH=80
export function avaPeriod(dates){
 assert(dates.length>0)
 if(dates.every(d=>['2026-04-25','2026-04-26'].includes(d)))return 'april'
 if(dates.every(d=>['2026-09-12','2026-09-13'].includes(d)))return 'september'
 throw new Error('Unreviewed AVA service dates')
}
export function avaTiming(templates,index,pathMetres){
 const seconds=templates.map(t=>t.calls[index+1][1]-t.calls[index][2])
 assert(seconds.every(s=>Number.isFinite(s)&&s>0),'Nonpositive AVA source interval')
 const minimumSourceSeconds=Math.min(...seconds),maximumRequiredMeanKmh=pathMetres/minimumSourceSeconds*3.6
 return {minimumSourceSeconds,maximumSourceSeconds:Math.max(...seconds),maximumRequiredMeanKmh,held:maximumRequiredMeanKmh>AVA_MEAN_SPEED_REVIEW_KMH,interpretation:'Conservative review screen, not a legal speed limit or certification. Original minute-granularity calls are preserved without timing adjustments.'}
}
export function avaRoadEvaluator(bundle){
 const roads=aargauRoadMatcher(bundle)
 return (t,stops)=>roads.matchPattern({...t,stops:t.calls.map((c,i)=>[i,c[1],c[2]])},stops)
}
export function avaMatcher(policy,evaluate){
 assert.equal(policy.schemaVersion,1);assert.deepEqual(policy.roadLimits,ROAD_LIMITS);assert.equal(policy.meanSpeedReviewKmh,AVA_MEAN_SPEED_REVIEW_KMH)
 const rules=new Map(policy.patterns.map(r=>[JSON.stringify([r.agencyId,r.routeId,r.line,r.directionId,r.stops]),r]))
 const ruleFor=(t,stops)=>rules.get(JSON.stringify([t.agencyId,t.routeId,t.route,t.directionId,stops]))
 const permitted=(t,r)=>t.category==='bus'&&t.sourceServiceDate===undefined&&t.serviceOffset===undefined&&r?.templates.some(j=>j.sourceTripId===t.sourceTripId&&j.sha256===witnessTemplateDigest(t))
 return {policy,assertTemplate(t,stops){const r=ruleFor(t,stops);if(r)assert(permitted(t,r),'Unreviewed AVA witness template')},matchPattern(t,stops){
  const r=ruleFor(t,stops);if(!permitted(t,r))return undefined
  const period=avaPeriod(t.activeServiceDates);assert.equal(period,r.period)
  const actual=evaluate(t,stops);assert.equal(actual?.length,r.segments.length)
  return r.segments.map((expected,i)=>{
   const {path,...evidence}=actual[i];assert(path)
   assert.equal(geometryDigest(path),expected.pathSha256,'Changed AVA diagnostic path');assert.doesNotThrow(() => assertGeometryMeasurementsEqual(evidence, expected.evidence), 'Changed AVA road evidence')
   if(period==='september'){assert.equal(expected.disposition,'hold-september-road-diversion');return undefined}
   // A good road match cannot overrule the held source-time assessment.
   const timing=avaTiming([t],i,evidence.pathMetres)
   if(expected.disposition==='hold-source-timing'){assert(timing.held);return undefined}
   assert.equal(expected.disposition,'admit-inferred-april');assert(!timing.held,'AVA source interval requires review')
   return {...actual[i],witnessAvaPatternId:r.id,operatorNotice:'april.html.gz',sourceTimeScreen:expected.timing}
  })
 }}
}
export async function loadWitnessAva(){
 const policy=await readJson(AVA_POLICY)
 for(const [file,sha]of Object.entries(policy.files))assert.equal(await hashFile(file),sha,`Changed AVA evidence: ${file}`)
 return avaMatcher(policy,avaRoadEvaluator(await readGzipJson('data/aargau-witness-ava-sources/cache.json.gz')))
}
