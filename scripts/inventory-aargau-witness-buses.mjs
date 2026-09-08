import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { witnessTemplateDigest } from './aargau-witness-rail.mjs'
const root='data/aargau-witnesses',input=await readGzipJson(`${root}/source-patterns.json.gz`),annual=await readJson(`${root}/inventory.json`)
const prior=await readGzipJson(`${root}/edge-review-patterns.json.gz`),stopById=new Map(input.stops.map(s=>[s[4],s]))
const patterns=prior.patterns.filter(p=>p.mode==='bus').map(p=>{
 const ts=input.trains.filter(t=>t.routeId===p.routeId&&t.directionId===p.gtfsDirectionId&&JSON.stringify(t.calls.map(c=>c[0]))===JSON.stringify(p.stopIds))
 assert.equal(ts.length,p.occurrences);assert(p.segments.every(s=>s.pathIndex===null))
 return {id:p.id,agencyId:p.agencyId,routeId:p.routeId,line:p.line,directionId:p.gtfsDirectionId,stops:p.stopIds.map(id=>stopById.get(id)),archivedTripTemplates:ts.length,segmentOccurrences:p.occurrences*p.segments.length,activeServiceDates:[...new Set(ts.flatMap(t=>t.activeServiceDates))].sort(),templates:ts.map(t=>({sourceTripId:t.sourceTripId,shortName:t.shortName,sha256:witnessTemplateDigest(t),activeServiceDates:t.activeServiceDates})),priorAssessments:p.segments}
})
const routes=annual.routes.filter(r=>r.mode==='bus').map(r=>{
 const ps=patterns.filter(p=>p.routeId===r.routeId)
 return {routeId:r.routeId,agencyId:r.agencyId,operator:r.operator,line:r.line,mode:r.mode,kind:r.agencyId==='801'?'special-event':'rail-replacement',witnessCivilDate:r.witnessDate,witnessSourceServiceDate:r.witness.sourceServiceDate,witnessServiceOffset:r.witness.serviceOffset,activeCivilDates:r.activeCivilDates,activeServiceDates:[...new Set(ps.flatMap(p=>p.activeServiceDates))].sort(),directedPatterns:ps.length,archivedTripTemplates:ps.reduce((n,p)=>n+p.archivedTripTemplates,0),segmentOccurrences:ps.reduce((n,p)=>n+p.segmentOccurrences,0),patternIds:ps.map(p=>p.id),corridors:[...new Set(ps.map(p=>p.stops[0][2]+' → '+p.stops.at(-1)[2]))]}
}).sort((a,b)=>b.segmentOccurrences-a.segmentOccurrences||a.routeId.localeCompare(b.routeId))
const files=[`${root}/inventory.json`,`${root}/source-patterns.json.gz`,`${root}/source-verification.json`,`${root}/edge-review-patterns.json.gz`,`${root}/edge-review-summary.json`]
const result={schemaVersion:1,checkedOn:'2026-09-08',scope:'Complete remaining bus census after the final rail review. Each source trip template counted once, not an annual service-instance total. Full cross-canton calls, original platform coordinates, source service dates and civil-day witnesses retained. No automatic geometry admission.',files:Object.fromEntries(await Promise.all(files.map(async f=>[f,await hashFile(f)]))),targetRoutes:routes.length,directedPatterns:patterns.length,archivedTripTemplates:routes.reduce((n,r)=>n+r.archivedTripTemplates,0),segmentOccurrences:routes.reduce((n,r)=>n+r.segmentOccurrences,0),routes,patterns}
assert.equal(result.targetRoutes,16);assert.equal(result.directedPatterns,86);assert.equal(result.archivedTripTemplates,1384);assert.equal(result.segmentOccurrences,7187)
const file=`${root}/bus-inventory.json`
if(process.argv.includes('--check'))assert.deepEqual(await readJson(file),result)
else await writeFile(file,JSON.stringify(result,null,2)+'\n')
console.log({routes:result.targetRoutes,patterns:result.directedPatterns,templates:result.archivedTripTemplates,occurrences:result.segmentOccurrences})
