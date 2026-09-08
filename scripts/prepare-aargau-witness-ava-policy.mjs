import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { ROAD_LIMITS } from './enrich-postbus-roads.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { AVA_POLICY,AVA_MEAN_SPEED_REVIEW_KMH,avaPeriod,avaTiming,avaRoadEvaluator } from './aargau-witness-ava.mjs'
const root='data/aargau-witness-ava-sources',inventory=await readJson('data/aargau-witnesses/bus-inventory.json'),input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz')
const routing=await readJson(`${root}/routing.json`),notices=await readJson(`${root}/sources.json`),bundle=await readGzipJson(`${root}/cache.json.gz`),evaluate=avaRoadEvaluator(bundle)
for(const [file,sha]of Object.entries(routing.files))assert.equal(await hashFile(`${root}/${file}`),sha)
for(const source of notices.sources)assert.equal(await hashFile(`${root}/${source.file}`),source.sha256)
const patterns=inventory.patterns.filter(p=>p.agencyId==='7244').map(r=>{
 const templates=input.trains.filter(t=>r.templates.some(j=>j.sourceTripId===t.sourceTripId)),period=avaPeriod(r.activeServiceDates),actual=evaluate(templates[0],r.stops)
 assert(templates.every(t=>avaPeriod(t.activeServiceDates)===period))
 assert.equal(r.routeId,'92-A07-9-j26-1');assert.equal(r.line,'EV')
 if(period==='april'){assert(r.stops.some(s=>s[4]==='ch:1:sloid:90133'),'Missing AVA hospital substitution');assert(!r.stops.some(s=>['Aarau Torfeld','Buchs AG'].includes(s[2])),'Closed rail stop in AVA replacement pattern')}
 const segments=actual.map((s,index)=>{
  const {path,...evidence}=s;assert(path);const timing=avaTiming(templates,index,evidence.pathMetres)
  const disposition=period==='september'?'hold-september-road-diversion':timing.held?'hold-source-timing':'admit-inferred-april'
  return {index,pathSha256:geometryDigest(path),evidence,timing,disposition,priorAssessment:r.priorAssessments[index]}
 })
 return {id:r.id,agencyId:r.agencyId,routeId:r.routeId,line:r.line,directionId:r.directionId,stops:r.stops,templates:r.templates,period,segments}
})
const occurrences={};for(const r of patterns)for(const s of r.segments)occurrences[s.disposition]=(occurrences[s.disposition]??0)+r.templates.length
assert.deepEqual(occurrences,{'admit-inferred-april':2466,'hold-source-timing':161,'hold-september-road-diversion':1989})
const files=['data/aargau-witnesses/bus-inventory.json','data/aargau-witnesses/source-patterns.json.gz','data/aargau-witnesses/source-verification.json','data/aargau-witnesses/edge-review-summary.json','data/aargau-witnesses/edge-review-patterns.json.gz',`${root}/routing.json`,`${root}/sources.json`,...Object.keys(routing.files).map(f=>`${root}/${f}`),...notices.sources.map(s=>`${root}/${s.file}`)]
const policy={schemaVersion:1,checkedOn:'2026-09-08',scope:'Offline exact AVA witness templates. Road-match all six patterns. Admit only April segments backed by the dated replacement-service notice and passing the source-time review screen. Hold all September patterns pending road-diversion reconciliation and 161 April occurrences requiring more than 80 km/h mean. Do not rewrite source times, stops, calendars, existing geometry or publication feeds.',files:Object.fromEntries(await Promise.all(files.map(async f=>[f,await hashFile(f)]))),source:{routing,notices},roadLimits:ROAD_LIMITS,meanSpeedReviewKmh:AVA_MEAN_SPEED_REVIEW_KMH,expected:{patterns:6,templates:336,addedOccurrences:2466,occurrences},patterns,publicationReady:false}
if(process.argv.includes('--check'))assert.deepEqual(await readJson(AVA_POLICY),policy)
else await writeFile(AVA_POLICY,JSON.stringify(policy,null,2)+'\n')
console.log(policy.expected)
