import assert from 'node:assert/strict'
import { readFile,writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { WITNESS_RAIL_POLICY,loadWitnessRail } from './aargau-witness-rail.mjs'
import { INTERLAKEN_POLICY,interlakenHierarchy,interlakenEvaluator } from './aargau-witness-interlaken.mjs'
const previous=await loadWitnessRail(),root='data/aargau-witnesses'
const before=await readGzipJson(`${root}/rail-review-patterns.json.gz`),input=await readGzipJson(`${root}/source-patterns.json.gz`)
const xml=gunzipSync(await readFile('data/aargau-rail-sources/network.xtf.gz')).toString(),hierarchy=interlakenHierarchy(xml)
const network=parseRailNetworkXtf(xml,5),routes=previous.policy.routes.filter(r=>['91-81-A-j26-1','91-4T-Y-j26-1'].includes(r.routeId)),evaluate=interlakenEvaluator(network,hierarchy,routes)
assert.equal(routes.length,2)
const patterns=[];let added=0
for(const r of previous.policy.patterns.filter(r=>r.stops.some(s=>hierarchy.platformBindings.some(b=>b.stopId===s[4])))){
  const p=before.patterns.find(p=>p.id===r.id);assert(p)
  const t=input.trains.find(t=>t.sourceTripId===r.templates[0].sourceTripId),actual=evaluate(t,r.stops),segments=[]
  for(const [index,s] of p.segments.entries())if(s.pathIndex===null){
    assert.equal(s.railFailure,'disconnected-excessive-detour-or-stop-order')
    const {path,...evidence}=actual[index];assert(path)
    segments.push({index,priorAssessment:s,pathSha256:geometryDigest(path),evidence});added+=r.templates.length
  }
  assert.equal(segments.length,1)
  patterns.push({id:r.id,agencyId:r.agencyId,routeId:r.routeId,line:r.line,directionId:r.directionId,stops:r.stops,templates:r.templates,segments})
}
assert.equal(patterns.length,59);assert.equal(added,162)
const files=[WITNESS_RAIL_POLICY,`${root}/rail-review-summary.json`,`${root}/rail-review-patterns.json.gz`,`${root}/source-patterns.json.gz`,`${root}/source-verification.json`,'data/aargau-rail-sources/source.json','data/aargau-rail-sources/network.xtf.gz']
const policy={schemaVersion:1,checkedOn:'2026-09-08',scope:'Offline annual witness templates only: exact Interlaken Ost platform 5/7 calls in 59 complete directed patterns and their archived source templates. FOT explicitly links track group 5–8 (8519309) to station 8507492 through rUebergeordnet. Internal lookup uses that child; GTFS IDs, coordinates, calls and calendars remain unchanged. Fill only 162 previously rejected Interlaken-adjacent occurrences; preserve every prior path and all other failures. No generic nearby-node, name-based, track-group or dated service alias.',files:Object.fromEntries(await Promise.all(files.map(async f=>[f,await hashFile(f)]))),source:previous.source,limits:previous.policy.limits,hierarchy,routes,expected:{patterns:59,addedOccurrences:162},patterns,publicationReady:false}
if(process.argv.includes('--check'))assert.deepEqual(await readJson(INTERLAKEN_POLICY),policy)
else await writeFile(INTERLAKEN_POLICY,JSON.stringify(policy,null,2)+'\n')
console.log(policy.expected)
