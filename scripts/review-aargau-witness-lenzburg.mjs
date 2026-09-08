import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { readJson,readGzipJson,loadSeasonalContext,assertPriorGeometryPreserved } from './aargau-seasonal.mjs'
import { applyAargauGeometry } from './build-aargau-study.mjs'
import { loadWitnessRail } from './aargau-witness-rail.mjs'
import { loadWitnessInterlaken } from './aargau-witness-interlaken.mjs'
import { loadWitnessEdges } from './aargau-witness-edges.mjs'
import { loadWitnessAva } from './aargau-witness-ava.mjs'
import { loadWitnessOberentfelden } from './aargau-witness-oberentfelden.mjs'
import { loadWitnessSchupfart } from './aargau-witness-schupfart.mjs'
import { LENZBURG_POLICY,loadWitnessLenzburg } from './aargau-witness-lenzburg.mjs'
const root='data/aargau-witnesses',input=await readGzipJson(`${root}/source-patterns.json.gz`),inventory=await readJson(`${root}/inventory.json`)
const prior=await readGzipJson(`${root}/schupfart-review-patterns.json.gz`),priorSummary=await readJson(`${root}/schupfart-review-summary.json`)
const context=await loadSeasonalContext('data/aargau-seasonal/input'),rail=await loadWitnessRail(),interlaken=await loadWitnessInterlaken(),edges=await loadWitnessEdges(),ava=await loadWitnessAva(),ober=await loadWitnessOberentfelden(),schup=await loadWitnessSchupfart(),lenz=await loadWitnessLenzburg()
assert.equal(priorSummary.policySha256,await hashFile('data/aargau-witness-schupfart-policy.json'))
assert.equal(priorSummary.geometryPatternsSha256,await hashFile(`${root}/schupfart-review-patterns.json.gz`))
const raw={metadata:{archiveSha256:inventory.archiveSha256,feed:inventory.feed,serviceDate:null,dayModel:'Archived trip templates counted once; not a civil-day feed'},stops:input.stops,trains:input.trains.map(t=>({...t,id:t.sourceTripId}))}
for(const t of raw.trains){const stops=t.calls.map(c=>raw.stops.find(s=>s[4]===c[0]));rail.assertTemplate(t,stops);interlaken.assertTemplate(t,stops);edges.assertTemplate(t,stops);ava.assertTemplate(t,stops);ober.assertTemplate(t,stops);schup.assertTemplate(t,stops);lenz.assertTemplate(t,stops)}
const rails={matchPattern:(t,stops)=>context.rails.matchPattern(t,stops)??rail.matchPattern(t,stops)}
const previousPlatforms={matchPattern:(t,stops)=>{
 const previous=edges.matchPattern(t,stops)??ava.matchPattern(t,stops),extra=ober.matchPattern(t,stops)
 return (extra?.map((s,i)=>previous?.[i]?.path?previous[i]:s??previous?.[i])??previous)??schup.matchPattern(t,stops)
}}
const before=applyAargauGeometry(raw,context.index,context.inventory.cantonStopIds,context.roads,rails,interlaken,previousPlatforms)
assert.deepEqual(before.patterns,prior.patterns);assert.deepEqual(before.snapshot.paths,prior.paths);assert.deepEqual(before.pairs,prior.pairs)
const platforms={matchPattern:(t,stops)=>previousPlatforms.matchPattern(t,stops)??lenz.matchPattern(t,stops)}
const after=applyAargauGeometry(raw,context.index,context.inventory.cantonStopIds,context.roads,rails,interlaken,platforms)
const regression=assertPriorGeometryPreserved(before,after)
assert.equal(regression.preservedOccurrences,priorSummary.compatibleOccurrences);assert.equal(regression.addedOccurrences,lenz.policy.expected.addedOccurrences)
assert.deepEqual(after.snapshot.stops,before.snapshot.stops)
for(const [i,t] of after.snapshot.trains.entries()){
 const {pathSegments:_a,...identity}=t,{pathSegments:_b,...old}=before.snapshot.trains[i];assert.deepEqual(identity,old)
 assert.deepEqual(t.stops.map(([i,a,d])=>[raw.stops[i][4],a,d]),raw.trains[i].calls.map(c=>c.slice(0,3)))
 for(const [j,index] of t.pathSegments.entries())if(index!==null){assert.deepEqual(after.snapshot.paths[index][0],raw.stops[t.stops[j][0]].slice(0,2));assert.deepEqual(after.snapshot.paths[index].at(-1),raw.stops[t.stops[j+1][0]].slice(0,2))}
}
const oldById=new Map(prior.patterns.map(p=>[p.id,p])),ruleById=new Map(lenz.policy.patterns.map(p=>[p.id,p])),unresolved=[],failures={},addedByDirection={}
let added=0,railMissing=0,busMissing=0
for(const p of after.patterns)for(const [i,s] of p.segments.entries()){
 const old=oldById.get(p.id).segments[i]
 if(s.witnessLenzburgPatternId){
  assert.equal(s.witnessLenzburgPatternId,p.id);assert.equal(old.pathIndex,null)
  const rule=ruleById.get(p.id);assert.deepEqual(rule.segments.find(s=>s.index===i).priorAssessment,old)
  added+=p.occurrences;addedByDirection[p.gtfsDirectionId]=(addedByDirection[p.gtfsDirectionId]??0)+p.occurrences
 }else {
  const {pathIndex:_a,...assessment}=s,{pathIndex:_b,...oldAssessment}=old;assert.deepEqual(assessment,oldAssessment)
 }
 if(s.pathIndex===null){
  unresolved.push({patternId:p.id,routeId:p.routeId,agencyId:p.agencyId,line:p.line,mode:p.mode,segmentIndex:i,fromId:s.fromId,toId:s.toId,archivedTripTemplates:p.occurrences,agisRejection:s.reason??null,railFailure:s.railFailure??null})
  if(p.mode==='rail'){railMissing+=p.occurrences;failures[s.railFailure]=(failures[s.railFailure]??0)+p.occurrences}else busMissing+=p.occurrences
 }
}
assert.equal(added,582);assert.equal(railMissing,0);assert.equal(busMissing,priorSummary.busMissingOccurrences-added)
const routes=priorSummary.routes.map(r=>{const g=after.routes.find(g=>g.routeId===r.routeId),ps=after.patterns.filter(p=>p.routeId===r.routeId);return {...r,fullyCompatiblePatterns:ps.filter(p=>p.completeGeometry).length,compatibleOccurrences:g.matched,missingOccurrences:g.total-g.matched,officialOccurrences:g.officialMatched,roadOccurrences:g.roadMatched,railOccurrences:g.railMatched,addedLenzburgOccurrences:g.matched-r.compatibleOccurrences}})
const detail={schemaVersion:1,stops:raw.stops,paths:after.snapshot.paths,patterns:after.patterns,pairs:after.pairs},file=`${root}/lenzburg-review-patterns.json.gz`
if(process.argv.includes('--check'))assert.deepEqual(await readGzipJson(file),detail)
else await writeFile(file,gzipSync(JSON.stringify(detail),{level:9}))
const summary={schemaVersion:1,policySha256:await hashFile(LENZBURG_POLICY),previousReviewSha256:await hashFile(`${root}/schupfart-review-summary.json`),previousPatternsSha256:await hashFile(`${root}/schupfart-review-patterns.json.gz`),inventorySha256:await hashFile(`${root}/inventory.json`),sourceVerificationSha256:await hashFile(`${root}/source-verification.json`),geometryPatternsFile:'lenzburg-review-patterns.json.gz',geometryPatternsSha256:await hashFile(file),
 scope:'Separate annual witness-template candidate. The SBB notice of 22 April confirms the May Lenzburg closure and replacement-bus corridors. Eight exact directed patterns retain all 300 independently verified GTFS templates. Admit 582 inferred OSM road occurrences while holding 77 stop-distance failures; later EV4 services remain outside this review. Every prior accepted path, other assessment, full GTFS identity, coordinate, calendar and call remains unchanged. These are archived trip-template counts, not additional daily feeds or certified operating itineraries.',
 attribution:priorSummary.attribution,source:lenz.policy.source,lenzburgDispositionOccurrences:lenz.policy.expected.occurrences,regression:{...regression,completeSourceTemplatesAndCallsPreserved:true,allOtherAssessmentsPreserved:true,previousCandidateReplayed:true},addedByDirection,
 targetRoutes:routes.length,directedPatterns:after.patterns.length,fullyCompatiblePatterns:after.patterns.filter(p=>p.completeGeometry).length,archivedTripTemplates:raw.trains.length,segmentOccurrences:priorSummary.segmentOccurrences,compatibleOccurrences:regression.preservedOccurrences+added,missingOccurrences:railMissing+busMissing,railMissingOccurrences:railMissing,busMissingOccurrences:busMissing,rejectedRailOccurrencesByReason:failures,routes,unresolved,dateScopedExceptionsApplied:false,publicationReady:false}
assert.equal(summary.compatibleOccurrences+summary.missingOccurrences,summary.segmentOccurrences)
assert.equal(summary.compatibleOccurrences,8880);assert.equal(summary.busMissingOccurrences,2108);assert.equal(summary.fullyCompatiblePatterns,207)
if(process.argv.includes('--check'))assert.deepEqual(await readJson(`${root}/lenzburg-review-summary.json`),summary)
else await writeFile(`${root}/lenzburg-review-summary.json`,JSON.stringify(summary,null,2)+'\n')
console.log({added,addedByDirection,compatible:summary.compatibleOccurrences,completePatterns:summary.fullyCompatiblePatterns,railMissing,busMissing})
