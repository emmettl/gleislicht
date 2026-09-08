import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { avaRoadEvaluator,avaTiming,AVA_MEAN_SPEED_REVIEW_KMH } from './aargau-witness-ava.mjs'
import { ROAD_LIMITS } from './enrich-postbus-roads.mjs'
import { LENZBURG_POLICY,lenzburgNoticeContext } from './aargau-witness-lenzburg.mjs'
const root='data/aargau-witness-lenzburg-sources',notice=await readJson(`${root}/notice.json`),scope=await readJson(`${root}/scope.json`),routing=await readJson(`${root}/routing.json`)
for(const [file,sha]of Object.entries(routing.files))assert.equal(await hashFile(`${root}/${file}`),sha)
const input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz'),inventory=await readJson('data/aargau-witnesses/bus-inventory.json'),prior=await readGzipJson('data/aargau-witnesses/schupfart-review-patterns.json.gz'),evaluate=avaRoadEvaluator(await readGzipJson(`${root}/cache.json.gz`))
const patterns=inventory.patterns.filter(r=>scope.patternIds.includes(r.id)).map(r=>{
 const templates=r.templates,ts=templates.map(j=>input.trains.find(t=>t.sourceTripId===j.sourceTripId)),actual=evaluate(ts[0],r.stops),old=prior.patterns.find(p=>p.id===r.id)
 const noticeContext=lenzburgNoticeContext(r,ts,notice)
 const segments=actual.map((s,index)=>{
  const {path,...evidence}=s,timing=path?avaTiming(ts,index,evidence.pathMetres):null
  const rejection=path?null:routing.report.issues.find(i=>i.pattern===evidence.roadPatternId&&i.segment===index)
  if(!path){assert(rejection);assert.equal(rejection.reason,'stop-too-far')}
  return {index,pathSha256:path?geometryDigest(path):null,evidence,timing,disposition:!path?'hold-road-geometry':timing.held?'hold-source-timing':'admit-inferred-may-road',rejection,priorAssessment:old.segments[index]}
 })
 return {id:r.id,agencyId:r.agencyId,routeId:r.routeId,line:r.line,directionId:r.directionId,stops:r.stops,templates,noticeContext,segments}
})
const occurrences={};for(const r of patterns)for(const s of r.segments)occurrences[s.disposition]=(occurrences[s.disposition]??0)+r.templates.length
assert.equal(patterns.length,8);assert.equal(patterns.reduce((n,r)=>n+r.templates.length,0),300);assert.deepEqual(occurrences,{'admit-inferred-may-road':582,'hold-road-geometry':77})
const files=['data/aargau-witnesses/source-patterns.json.gz','data/aargau-witnesses/source-verification.json','data/aargau-witnesses/bus-inventory.json','data/aargau-witnesses/schupfart-review-patterns.json.gz','data/aargau-witnesses/schupfart-review-summary.json',`${root}/notice.json`,`${root}/scope.json`,`${root}/routing.json`,...Object.keys(routing.files).map(f=>`${root}/${f}`)]
const policy={schemaVersion:1,checkedOn:'2026-09-09',scope:'Separate annual-template candidate: eight complete May Lenzburg patterns on four exact SBB replacement routes. The dated operator notice establishes closure corridors; independent GTFS verification establishes all original calls and calendars. Exclude two stop-distance failures without relaxing any guard. Later EV4 and all other unreviewed services remain excluded. No daily feed expands.',files:Object.fromEntries(await Promise.all(files.map(async f=>[f,await hashFile(f)]))),roadLimits:ROAD_LIMITS,meanSpeedReviewKmh:AVA_MEAN_SPEED_REVIEW_KMH,source:{notice,routing},expected:{patterns:8,templates:300,addedOccurrences:582,occurrences},patterns,publicationReady:false}
if(process.argv.includes('--check'))assert.deepEqual(await readJson(LENZBURG_POLICY),policy)
else await writeFile(LENZBURG_POLICY,JSON.stringify(policy,null,2)+'\n')
console.log(policy.expected)
