import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { readJson, readGzipJson, loadSeasonalContext, assertPriorGeometryPreserved } from './aargau-seasonal.mjs'
import { applyAargauGeometry } from './build-aargau-study.mjs'
import { WITNESS_RAIL_POLICY, loadWitnessRail } from './aargau-witness-rail.mjs'
const root='data/aargau-witnesses', input=await readGzipJson(`${root}/source-patterns.json.gz`), inventory=await readJson(`${root}/inventory.json`)
const original=await readGzipJson(`${root}/geometry-patterns.json.gz`), originalSummary=await readJson(`${root}/geometry-summary.json`)
const context=await loadSeasonalContext('data/aargau-seasonal/input'), reviewed=await loadWitnessRail()
assert.deepEqual(originalSummary.sourceHashes,context.sourceHashes)
const raw={metadata:{archiveSha256:inventory.archiveSha256,feed:inventory.feed,serviceDate:null,dayModel:'Archived trip templates counted once; not a civil-day feed'},stops:input.stops,trains:input.trains.map(t=>({...t,id:t.sourceTripId}))}
for(const t of raw.trains) reviewed.assertTemplate(t,t.calls.map(c=>raw.stops.find(s=>s[4]===c[0])))
const before=applyAargauGeometry(raw,context.index,context.inventory.cantonStopIds,context.roads,context.rails)
assert.deepEqual(before.patterns,original.patterns);assert.deepEqual(before.snapshot.paths,original.paths);assert.deepEqual(before.pairs,original.pairs)
const rails={matchPattern:(t,stops)=>context.rails.matchPattern(t,stops)??reviewed.matchPattern(t,stops)}
const after=applyAargauGeometry(raw,context.index,context.inventory.cantonStopIds,context.roads,rails)
const regression=assertPriorGeometryPreserved(before,after)
assert.equal(regression.preservedOccurrences,reviewed.policy.expected.preservedOccurrences)
assert.equal(regression.addedOccurrences,reviewed.policy.expected.addedOccurrences)
assert.deepEqual(after.snapshot.stops,before.snapshot.stops)
for(const [i,t] of after.snapshot.trains.entries()) {
  const {pathSegments:_a,...identity}=t, {pathSegments:_b,...prior}=before.snapshot.trains[i]
  assert.deepEqual(identity,prior)
  assert.deepEqual(t.stops.map(([i,a,d])=>[raw.stops[i][4],a,d]),raw.trains[i].calls.map(c=>c.slice(0,3)))
  for(const [j,index] of t.pathSegments.entries()) if(index!==null) {
    assert.deepEqual(after.snapshot.paths[index][0],raw.stops[t.stops[j][0]].slice(0,2))
    assert.deepEqual(after.snapshot.paths[index].at(-1),raw.stops[t.stops[j+1][0]].slice(0,2))
  }
}
const oldPatterns=new Map(before.patterns.map(p=>[p.id,p])), unresolved=[], rejectedByReason={}
let added=0,railMissing=0,busMissing=0
for(const p of after.patterns) for(const [i,s] of p.segments.entries()) {
  const prior=oldPatterns.get(p.id).segments[i]
  assert(!s.gapMappingId&&!s.platformFixId&&!s.alignmentCorrectionId&&!s.simplonRuleId&&!s.seasonalGapRuleId)
  if(prior.pathIndex===null && s.pathIndex!==null) { assert.equal(s.witnessRailPatternId,p.id);assert.equal(s.geometrySource,'fot');added+=p.occurrences }
  if(p.mode==='bus') assert.deepEqual(s,prior)
  if(s.pathIndex===null) {
    unresolved.push({patternId:p.id,routeId:p.routeId,agencyId:p.agencyId,line:p.line,mode:p.mode,segmentIndex:i,fromId:s.fromId,toId:s.toId,archivedTripTemplates:p.occurrences,agisRejection:s.reason??null,railFailure:s.railFailure??null})
    if(p.mode==='rail') { railMissing+=p.occurrences;rejectedByReason[s.railFailure]=(rejectedByReason[s.railFailure]??0)+p.occurrences }
    else busMissing+=p.occurrences
  }
}
assert.equal(added,regression.addedOccurrences);assert.equal(railMissing,reviewed.policy.expected.rejectedOccurrences)
const routes=originalSummary.routes.map(r=>{
  const g=after.routes.find(g=>g.routeId===r.routeId),patterns=after.patterns.filter(p=>p.routeId===r.routeId)
  return {...r,fullyCompatiblePatterns:patterns.filter(p=>p.completeGeometry).length,compatibleOccurrences:g.matched,missingOccurrences:g.total-g.matched,officialOccurrences:g.officialMatched,roadOccurrences:g.roadMatched,railOccurrences:g.railMatched,addedRailOccurrences:g.matched-r.compatibleOccurrences}
})
const detail={schemaVersion:1,stops:raw.stops,paths:after.snapshot.paths,patterns:after.patterns,pairs:after.pairs}
const detailsFile=`${root}/rail-review-patterns.json.gz`
if(process.argv.includes('--check')) assert.deepEqual(await readGzipJson(detailsFile),detail)
else await writeFile(detailsFile,gzipSync(JSON.stringify(detail),{level:9}))
const summary={schemaVersion:1,policySha256:await hashFile(WITNESS_RAIL_POLICY),originalGeometrySummarySha256:await hashFile(`${root}/geometry-summary.json`),originalGeometryPatternsSha256:await hashFile(`${root}/geometry-patterns.json.gz`),inventorySha256:await hashFile(`${root}/inventory.json`),sourceVerificationSha256:await hashFile(`${root}/source-verification.json`),
  geometryPatternsFile:'rail-review-patterns.json.gz',geometryPatternsSha256:await hashFile(detailsFile),
  scope:'Separate annual witness-template candidate: exact full-pattern and source-template FOT inference for 29 rail route records. Fills only previously absent geometry. Original witness baseline, all bus assessments, original September feeds and twelve-date seasonal policies are preserved. Counts are archived trip templates, not dated service occurrences or released regional feeds.',
  attribution:originalSummary.attribution,source:reviewed.source,regression:{...regression,completeSourceTemplatesAndCallsPreserved:true,allBusAssessmentsPreserved:true,baselinePatternsAndPathsReplayed:true},
  targetRoutes:routes.length,reviewedRailRoutes:reviewed.policy.routes.length,railRoutesWithAddedGeometry:routes.filter(r=>r.addedRailOccurrences>0).length,directedPatterns:after.patterns.length,reviewedRailPatterns:reviewed.policy.patterns.length,fullyCompatiblePatterns:after.patterns.filter(p=>p.completeGeometry).length,
  archivedTripTemplates:raw.trains.length,segmentOccurrences:originalSummary.segmentOccurrences,compatibleOccurrences:regression.preservedOccurrences+added,missingOccurrences:railMissing+busMissing,railMissingOccurrences:railMissing,busMissingOccurrences:busMissing,rejectedRailOccurrencesByReason:rejectedByReason,
  routes,unresolved,dateScopedExceptionsApplied:false,publicationReady:false}
assert.equal(summary.compatibleOccurrences+summary.missingOccurrences,summary.segmentOccurrences)
if(process.argv.includes('--check')) assert.deepEqual(await readJson(`${root}/rail-review-summary.json`),summary)
else await writeFile(`${root}/rail-review-summary.json`,JSON.stringify(summary,null,2)+'\n')
console.log({added,compatible:summary.compatibleOccurrences,completePatterns:summary.fullyCompatiblePatterns,railMissing,busMissing,rejectedByReason})
