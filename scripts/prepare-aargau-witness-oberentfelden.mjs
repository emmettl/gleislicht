import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { loadWitnessAva,avaRoadEvaluator,avaTiming } from './aargau-witness-ava.mjs'
import { OBERENTFELDEN_POLICY,CLOSURE_CLEARANCE_METRES,oberentfeldenClosure,minimumPolylineDistance } from './aargau-witness-oberentfelden.mjs'
const prior=await loadWitnessAva(),root='data/aargau-witness-oberentfelden-sources',source=await readJson(`${root}/sources.json`)
for(const s of source.sources)assert.equal(await hashFile(`${root}/${s.file}`),s.sha256)
assert.equal(await hashFile(`${root}/overpass-query.txt`),source.querySha256)
const closure=oberentfeldenClosure(await readGzipJson(`${root}/osm.json.gz`)),input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz'),before=await readGzipJson('data/aargau-witnesses/ava-review-patterns.json.gz')
const evaluate=avaRoadEvaluator(await readGzipJson('data/aargau-witness-ava-sources/cache.json.gz'))
const patterns=prior.policy.patterns.filter(r=>r.period==='september').map(r=>{
 const ts=input.trains.filter(t=>r.templates.some(j=>j.sourceTripId===t.sourceTripId)),actual=evaluate(ts[0],r.stops),p=before.patterns.find(p=>p.id===r.id)
 const segments=actual.map((s,index)=>{const {path,...evidence}=s,minimumClosureDistanceMetres=minimumPolylineDistance(path,closure.points),timing=avaTiming(ts,index,evidence.pathMetres);assert(!timing.held);return {index,pathSha256:geometryDigest(path),evidence,minimumClosureDistanceMetres,timing,disposition:minimumClosureDistanceMetres<=CLOSURE_CLEARANCE_METRES?'hold-closed-road-crossing':'admit-clear-of-closure',priorAssessment:p.segments[index]}})
 assert.equal(segments.filter(s=>s.disposition==='hold-closed-road-crossing').length,1)
 return {id:r.id,agencyId:r.agencyId,routeId:r.routeId,line:r.line,directionId:r.directionId,stops:r.stops,templates:r.templates,segments}
})
const counts={};for(const r of patterns)for(const s of r.segments)counts[s.disposition]=(counts[s.disposition]??0)+r.templates.length
assert.equal(counts['admit-clear-of-closure'],1836);assert.equal(counts['hold-closed-road-crossing'],153)
const files=['data/aargau-witness-ava-policy.json','data/aargau-witness-ava-sources/cache.json.gz','data/aargau-witnesses/source-patterns.json.gz','data/aargau-witnesses/source-verification.json','data/aargau-witnesses/ava-review-summary.json','data/aargau-witnesses/ava-review-patterns.json.gz',`${root}/sources.json`,`${root}/overpass-query.txt`,...source.sources.map(s=>`${root}/${s.file}`)]
const policy={schemaVersion:1,checkedOn:'2026-09-08',scope:'Separate annual-template audit: localize September AVA road-closure holds. Every emitted polyline segment must remain more than 20 m from the exact OSM closure corridor. Hold both Uerkenbrücke–Engelplatz directions pending detour and source-time review. All April decisions and prior accepted paths remain unchanged; no new geometry is synthesized.',files:Object.fromEntries(await Promise.all(files.map(async f=>[f,await hashFile(f)]))),source,closure,clearanceMetres:CLOSURE_CLEARANCE_METRES,expected:{patterns:2,templates:153,addedOccurrences:1836,counts},patterns,publicationReady:false}
if(process.argv.includes('--check'))assert.deepEqual(await readJson(OBERENTFELDEN_POLICY),policy)
else await writeFile(OBERENTFELDEN_POLICY,JSON.stringify(policy,null,2)+'\n')
console.log({lengthMetres:closure.lengthMetres,...policy.expected,minimumAdmittedClearance:Math.min(...patterns.flatMap(r=>r.segments.filter(s=>s.disposition==='admit-clear-of-closure').map(s=>s.minimumClosureDistanceMetres)))})
