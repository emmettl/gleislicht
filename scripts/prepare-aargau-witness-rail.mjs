import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { hashFile } from './inventory-aargau.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { aargauRailMatcher, AARGAU_RAIL_LIMITS, loadAargauRail } from './aargau-rail-geometry.mjs'
import { seasonalGapSources } from './aargau-seasonal-gaps.mjs'
import { readJson, readGzipJson } from './aargau-seasonal.mjs'
import { WITNESS_RAIL_POLICY, witnessTemplateDigest } from './aargau-witness-rail.mjs'
const root='data/aargau-witnesses', inventory=await readJson(`${root}/inventory.json`), input=await readGzipJson(`${root}/source-patterns.json.gz`), before=await readGzipJson(`${root}/geometry-patterns.json.gz`)
const verification=await readJson(`${root}/source-verification.json`)
assert(verification.passed); assert.equal(verification.inventorySha256,await hashFile(`${root}/inventory.json`)); assert.equal(verification.sourcePatternsSha256,await hashFile(`${root}/source-patterns.json.gz`))
const existing=await loadAargauRail('data/aargau-rail-sources','data/aargau-rail-policy.json')
const { network }=await seasonalGapSources()
const routes=inventory.routes.filter(r=>r.mode==='rail').map(({routeId,agencyId,line})=>({routeId,agencyId,line}))
assert.equal(routes.length,29)
const matcher=aargauRailMatcher(network,{routes}), patterns=[], templateCounts={}, byStop=new Map(input.stops.map(s=>[s[4],s]))
let added=0,preserved=0,rejected=0
for (const p of before.patterns.filter(p=>p.mode==='rail')) {
  const stops=p.stopIds.map(id=>byStop.get(id)), trains=input.trains.filter(t=>t.category==='rail' && t.routeId===p.routeId && t.directionId===p.gtfsDirectionId && JSON.stringify(t.calls.map(c=>c[0]))===JSON.stringify(p.stopIds))
  assert.equal(trains.length,p.occurrences)
  for(const t of trains) { assert.equal(t.agencyId,p.agencyId);assert.equal(t.route,p.line);assert(t.activeServiceDates.length);templateCounts[t.sourceTripId]=(templateCounts[t.sourceTripId]??0)+1 }
  const segments=matcher.matchPattern({...trains[0],stops:stops.map((_,i)=>[i,0,0])},stops)
  patterns.push({id:p.id,agencyId:p.agencyId,routeId:p.routeId,line:p.line,directionId:p.gtfsDirectionId,stops,templates:trains.map(t=>({sourceTripId:t.sourceTripId,sha256:witnessTemplateDigest(t)})),segments:segments.map((s,i)=>{
    if(p.segments[i].pathIndex!==null) { preserved+=p.occurrences;return {preserveExistingGeometry:true} }
    const {path,...evidence}=s
    if(path) added+=p.occurrences;else rejected+=p.occurrences
    return {pathSha256:path?geometryDigest(path):null,evidence}
  })})
}
assert.equal(patterns.length,194)
assert.equal(Object.keys(templateCounts).length,input.trains.filter(t=>t.category==='rail').length)
assert(Object.values(templateCounts).every(n=>n===1))
const files=[`${root}/inventory.json`,`${root}/source-patterns.json.gz`,`${root}/source-verification.json`,`${root}/geometry-summary.json`,`${root}/geometry-patterns.json.gz`,'data/aargau-rail-policy.json','data/aargau-rail-sources/source.json',...Object.keys(existing.source.files).map(f=>'data/aargau-rail-sources/'+f)]
const policy={schemaVersion:1,checkedOn:'2026-09-08',scope:'Offline witness-template compatibility only: 29 exact national GTFS rail route identities and 194 complete directed platform-coordinate patterns. Exact source templates include course, service calendar dates, boarding rules and full calls. Fills absent geometry with pinned FOT infrastructure inference, never a service running-track certificate. No production route policy or dated gap/platform/border exception is extended.',
  files:Object.fromEntries(await Promise.all(files.map(async f=>[f,await hashFile(f)]))),source:existing.source,limits:AARGAU_RAIL_LIMITS,
  attribution:['Timetable: opentransportdata.swiss',existing.source.attribution],routes,
  expected:{patterns:patterns.length,railTemplates:Object.keys(templateCounts).length,preservedOccurrences:preserved,addedOccurrences:added,rejectedOccurrences:rejected},patterns,publicationReady:false}
if(process.argv.includes('--check')) assert.deepEqual(await readJson(WITNESS_RAIL_POLICY),policy)
else await writeFile(WITNESS_RAIL_POLICY,JSON.stringify(policy,null,2)+'\n')
console.log(policy.expected)
