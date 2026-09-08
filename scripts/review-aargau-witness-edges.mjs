import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { readJson,readGzipJson,loadSeasonalContext,assertPriorGeometryPreserved } from './aargau-seasonal.mjs'
import { applyAargauGeometry } from './build-aargau-study.mjs'
import { loadWitnessRail } from './aargau-witness-rail.mjs'
import { loadWitnessInterlaken } from './aargau-witness-interlaken.mjs'
import { EDGE_POLICY,loadWitnessEdges } from './aargau-witness-edges.mjs'
const root='data/aargau-witnesses',input=await readGzipJson(`${root}/source-patterns.json.gz`),inventory=await readJson(`${root}/inventory.json`)
const prior=await readGzipJson(`${root}/interlaken-review-patterns.json.gz`),priorSummary=await readJson(`${root}/interlaken-review-summary.json`)
const context=await loadSeasonalContext('data/aargau-seasonal/input'),rail=await loadWitnessRail(),interlaken=await loadWitnessInterlaken(),edges=await loadWitnessEdges()
assert.equal(priorSummary.policySha256,await hashFile('data/aargau-witness-interlaken-policy.json'))
assert.equal(priorSummary.geometryPatternsSha256,await hashFile(`${root}/interlaken-review-patterns.json.gz`))
const raw={metadata:{archiveSha256:inventory.archiveSha256,feed:inventory.feed,serviceDate:null,dayModel:'Archived trip templates counted once; not a civil-day feed'},stops:input.stops,trains:input.trains.map(t=>({...t,id:t.sourceTripId}))}
for(const t of raw.trains){const stops=t.calls.map(c=>raw.stops.find(s=>s[4]===c[0]));rail.assertTemplate(t,stops);interlaken.assertTemplate(t,stops);edges.assertTemplate(t,stops)}
const rails={matchPattern:(t,stops)=>context.rails.matchPattern(t,stops)??rail.matchPattern(t,stops)}
const before=applyAargauGeometry(raw,context.index,context.inventory.cantonStopIds,context.roads,rails,interlaken)
assert.deepEqual(before.patterns,prior.patterns);assert.deepEqual(before.snapshot.paths,prior.paths);assert.deepEqual(before.pairs,prior.pairs)
const after=applyAargauGeometry(raw,context.index,context.inventory.cantonStopIds,context.roads,rails,interlaken,edges)
const regression=assertPriorGeometryPreserved(before,after)
assert.equal(regression.preservedOccurrences,priorSummary.compatibleOccurrences);assert.equal(regression.addedOccurrences,edges.policy.expected.addedOccurrences)
assert.deepEqual(after.snapshot.stops,before.snapshot.stops)
for(const [i,t] of after.snapshot.trains.entries()){
 const {pathSegments:_a,...identity}=t,{pathSegments:_b,...old}=before.snapshot.trains[i];assert.deepEqual(identity,old)
 assert.deepEqual(t.stops.map(([i,a,d])=>[raw.stops[i][4],a,d]),raw.trains[i].calls.map(c=>c.slice(0,3)))
 for(const [j,index] of t.pathSegments.entries())if(index!==null){assert.deepEqual(after.snapshot.paths[index][0],raw.stops[t.stops[j][0]].slice(0,2));assert.deepEqual(after.snapshot.paths[index].at(-1),raw.stops[t.stops[j+1][0]].slice(0,2))}
}
const oldById=new Map(prior.patterns.map(p=>[p.id,p])),ruleById=new Map(edges.policy.patterns.map(p=>[p.id,p])),unresolved=[],failures={},addedByDirection={}
let added=0,railMissing=0,busMissing=0
for(const p of after.patterns)for(const [i,s] of p.segments.entries()){
 const old=oldById.get(p.id).segments[i]
 if(s.witnessEdgePatternId){
  assert.equal(s.witnessEdgePatternId,p.id);assert.equal(old.pathIndex,null)
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
assert.equal(added,11);assert.equal(railMissing,0);assert.equal(busMissing,priorSummary.busMissingOccurrences)
const routes=priorSummary.routes.map(r=>{const g=after.routes.find(g=>g.routeId===r.routeId),ps=after.patterns.filter(p=>p.routeId===r.routeId);return {...r,fullyCompatiblePatterns:ps.filter(p=>p.completeGeometry).length,compatibleOccurrences:g.matched,missingOccurrences:g.total-g.matched,officialOccurrences:g.officialMatched,roadOccurrences:g.roadMatched,railOccurrences:g.railMatched,addedEdgeOccurrences:g.matched-r.compatibleOccurrences}})
const detail={schemaVersion:1,stops:raw.stops,paths:after.snapshot.paths,patterns:after.patterns,pairs:after.pairs},file=`${root}/edge-review-patterns.json.gz`
if(process.argv.includes('--check'))assert.deepEqual(await readGzipJson(file),detail)
else await writeFile(file,gzipSync(JSON.stringify(detail),{level:9}))
const summary={schemaVersion:1,policySha256:await hashFile(EDGE_POLICY),previousReviewSha256:await hashFile(`${root}/interlaken-review-summary.json`),previousPatternsSha256:await hashFile(`${root}/interlaken-review-patterns.json.gz`),inventorySha256:await hashFile(`${root}/inventory.json`),sourceVerificationSha256:await hashFile(`${root}/source-verification.json`),geometryPatternsFile:'edge-review-patterns.json.gz',geometryPatternsSha256:await hashFile(file),
 scope:'Separate annual witness-template candidate. A pinned FOT curve split at Bern platform 50 and a scoped AGIS Waldshut corridor supply only the final eleven previously absent rail occurrences. Every prior accepted path and every other source assessment stays identical. Full GTFS IDs, coordinates, calendars and calls are preserved. These are archived trip-template counts, not date-specific regional feeds or certified running tracks.',
 attribution:priorSummary.attribution,source:edges.policy.source,regression:{...regression,completeSourceTemplatesAndCallsPreserved:true,allOtherAssessmentsPreserved:true,previousCandidateReplayed:true},addedByDirection,
 targetRoutes:routes.length,directedPatterns:after.patterns.length,fullyCompatiblePatterns:after.patterns.filter(p=>p.completeGeometry).length,archivedTripTemplates:raw.trains.length,segmentOccurrences:priorSummary.segmentOccurrences,compatibleOccurrences:regression.preservedOccurrences+added,missingOccurrences:railMissing+busMissing,railMissingOccurrences:railMissing,busMissingOccurrences:busMissing,rejectedRailOccurrencesByReason:failures,routes,unresolved,dateScopedExceptionsApplied:false,publicationReady:false}
assert.equal(summary.compatibleOccurrences+summary.missingOccurrences,summary.segmentOccurrences)
if(process.argv.includes('--check'))assert.deepEqual(await readJson(`${root}/edge-review-summary.json`),summary)
else await writeFile(`${root}/edge-review-summary.json`,JSON.stringify(summary,null,2)+'\n')
console.log({added,addedByDirection,compatible:summary.compatibleOccurrences,completePatterns:summary.fullyCompatiblePatterns,railMissing,busMissing})
