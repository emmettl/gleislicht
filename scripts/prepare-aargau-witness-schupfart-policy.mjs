import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { avaRoadEvaluator,AVA_MEAN_SPEED_REVIEW_KMH } from './aargau-witness-ava.mjs'
import { ROAD_LIMITS } from './enrich-postbus-roads.mjs'
import { SCHUPFART_POLICY,schupfartTiming,validateSchupfartAdvertised } from './aargau-witness-schupfart.mjs'
const root='data/aargau-witness-schupfart-sources',source=await readJson(`${root}/sources.json`),routing=await readJson(`${root}/routing.json`),advertised=await readJson(`${root}/advertised-calls.json`)
for(const s of source.sources)assert.equal(await hashFile(`${root}/${s.file}`),s.sha256)
assert.equal(await hashFile(`${root}/timetable-2026.pdf.gz`),advertised.pdfSha256)
for(const [file,sha]of Object.entries(routing.files))assert.equal(await hashFile(`${root}/${file}`),sha)
const input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz'),inventory=await readJson('data/aargau-witnesses/bus-inventory.json'),prior=await readGzipJson('data/aargau-witnesses/oberentfelden-review-patterns.json.gz'),evaluate=avaRoadEvaluator(await readGzipJson(`${root}/cache.json.gz`))
const advertisedVerification=validateSchupfartAdvertised(input,advertised)
const patterns=inventory.patterns.filter(r=>r.agencyId==='801').map(r=>{
 const templates=r.templates,ts=templates.map(j=>input.trains.find(t=>t.sourceTripId===j.sourceTripId)),actual=evaluate(ts[0],r.stops),old=prior.patterns.find(p=>p.id===r.id)
 assert.equal(r.routeId,'96-138-1-j26-1')
 const segments=actual.map((s,index)=>{const {path,...evidence}=s;assert(path);const timing=schupfartTiming(ts,index,evidence.pathMetres);return {index,pathSha256:geometryDigest(path),evidence,timing,disposition:timing.holdReason?'hold-source-timing':'admit-inferred-event-road',priorAssessment:old.segments[index]}})
 return {id:r.id,agencyId:r.agencyId,routeId:r.routeId,line:r.line,directionId:r.directionId,stops:r.stops,templates,segments}
})
const occurrences={};for(const r of patterns)for(const s of r.segments)occurrences[s.disposition]=(occurrences[s.disposition]??0)+r.templates.length
assert.deepEqual(occurrences,{'admit-inferred-event-road':195,'hold-source-timing':12})
const files=['data/aargau-witnesses/source-patterns.json.gz','data/aargau-witnesses/source-verification.json','data/aargau-witnesses/bus-inventory.json','data/aargau-witnesses/oberentfelden-review-patterns.json.gz','data/aargau-witnesses/oberentfelden-review-summary.json',`${root}/sources.json`,`${root}/routing.json`,`${root}/advertised-calls.json`,...source.sources.map(s=>`${root}/${s.file}`),...Object.keys(routing.files).map(f=>`${root}/${f}`)]
const policy={schemaVersion:1,checkedOn:'2026-09-09',scope:'Separate annual-template candidate: PostAuto route 96-138-1-j26-1 for the 25–27 September 2026 Schupfart Festival. The independently transcribed official timetable verifies all 32 trips at advertised major stops; full GTFS intermediate calls and out-of-canton stops remain intact. Inferred OSM paths require positive source intervals and the unchanged mean-speed review threshold. No daily feed expands.',files:Object.fromEntries(await Promise.all(files.map(async f=>[f,await hashFile(f)]))),roadLimits:ROAD_LIMITS,meanSpeedReviewKmh:AVA_MEAN_SPEED_REVIEW_KMH,source:{...source,routing},advertisedVerification,expected:{patterns:12,templates:32,addedOccurrences:195,occurrences},patterns,publicationReady:false}
if(process.argv.includes('--check'))assert.deepEqual(await readJson(SCHUPFART_POLICY),policy)
else await writeFile(SCHUPFART_POLICY,JSON.stringify(policy,null,2)+'\n')
console.log({...policy.expected,advertisedCalls:advertisedVerification.reduce((n,r)=>n+r.calls.length,0)})
