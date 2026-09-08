import assert from 'node:assert/strict'
import { readFile,writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { AARGAU_RAIL_LIMITS } from './aargau-rail-geometry.mjs'
import { AARGAU_LIMITS } from './aargau-line-geometry.mjs'
import { loadWitnessRail } from './aargau-witness-rail.mjs'
import { INTERLAKEN_POLICY,loadWitnessInterlaken } from './aargau-witness-interlaken.mjs'
import { EDGE_POLICY,edgeEvaluator } from './aargau-witness-edges.mjs'
const previous=await loadWitnessInterlaken(),rail=await loadWitnessRail(),root='data/aargau-witnesses'
const before=await readGzipJson(`${root}/interlaken-review-patterns.json.gz`),input=await readGzipJson(`${root}/source-patterns.json.gz`)
const network=parseRailNetworkXtf(gunzipSync(await readFile('data/aargau-rail-sources/network.xtf.gz')).toString(),5)
const routes=rail.policy.routes.filter(r=>['91-36-B-j26-1','91-3A-Y-j26-1','91-4U-Y-j26-1'].includes(r.routeId))
assert.equal(routes.length,3)
const collection=await readGzipJson('data/aargau-sources/lines.json.gz'),evaluate=edgeEvaluator(network,collection,routes),patterns=[]
let added=0
for(const p of before.patterns.filter(p=>p.mode==='rail'&&!p.completeGeometry)){
  const r=rail.policy.patterns.find(r=>r.id===p.id);assert(r)
  const t=input.trains.find(t=>t.sourceTripId===r.templates[0].sourceTripId),actual=evaluate(t,r.stops),segments=[]
  for(const [index,s] of p.segments.entries())if(s.pathIndex===null){
    const {path,...evidence}=actual[index];assert(path)
    segments.push({index,priorAssessment:s,pathSha256:geometryDigest(path),evidence});added+=r.templates.length
  }
  patterns.push({id:r.id,agencyId:r.agencyId,routeId:r.routeId,line:r.line,directionId:r.directionId,stops:r.stops,templates:r.templates,sourceCourses:r.templates.map(j=>{const t=input.trains.find(t=>t.sourceTripId===j.sourceTripId);return {sourceTripId:t.sourceTripId,shortName:t.shortName,activeServiceDates:t.activeServiceDates}}),segments})
}
assert.equal(patterns.length,7);assert.equal(added,11)
const files=[INTERLAKEN_POLICY,`${root}/interlaken-review-summary.json`,`${root}/interlaken-review-patterns.json.gz`,`${root}/source-patterns.json.gz`,`${root}/source-verification.json`,'data/aargau-rail-sources/source.json','data/aargau-rail-sources/network.xtf.gz','data/aargau-sources/sources.json','data/aargau-sources/lines.json.gz','data/aargau-witness-edge-sources/sbb-bern-plan-2026-08.pdf','data/aargau-supplemental-sources/thurbo-closures-2026.html.gz']
const plan={file:files.at(-2),sha256:await hashFile(files.at(-2)),url:'https://company.sbb.ch/content/dam/infrastruktur/trafimage/bahnhofplaene/plan-bern-a4.pdf',retrievedAt:'2026-09-08T20:18:29.309Z',documentDate:'2026-08',page:3,attribution:'© OpenStreetMap © SBB 08/2026',role:'Visually inspected station exterior plan: platforms 49/50 at western end. Not a surveyed running-track alignment; plan postdates the June/July witness templates.'}
assert.equal(plan.sha256,'fc8996f20bd75a4293448ccf96a11b443f5df2419282ab75cea80efd252486eb')
const policy={schemaVersion:1,checkedOn:'2026-09-08',scope:'Offline annual witness templates only. Seven exact full patterns: five previously missing Bern platform-50 occurrences and six April SBB S36 border occurrences. All prior geometry, original GTFS calls, coordinates and calendars preserved. Infrastructure compatibility only, not an operating-date or running-track certification.',files:Object.fromEntries(await Promise.all(files.map(async f=>[f,await hashFile(f)]))),source:{fot:previous.policy.source,agis:(await readJson('data/aargau-sources/sources.json')).lines,bernPlan:plan,waldshutFeature:collection.features.find(f=>f.id===364).properties,closureEvidence:{url:'https://www.thurbo.ch/erkunden/ausblick/thurboleben/ki-baustellen/',file:files.at(-1),closureStart:'2026-09-14',closureEnd:'2026-10-02',interpretation:'The reviewed templates are dated April 13–16, outside this closure. This notice does not prove that an April journey actually operated.'}},railLimits:AARGAU_RAIL_LIMITS,agisLimits:AARGAU_LIMITS,routes,expected:{patterns:7,addedOccurrences:11,bernOccurrences:5,waldshutOccurrences:6},patterns,publicationReady:false}
if(process.argv.includes('--check'))assert.deepEqual(await readJson(EDGE_POLICY),policy)
else await writeFile(EDGE_POLICY,JSON.stringify(policy,null,2)+'\n')
console.log(policy.expected)
