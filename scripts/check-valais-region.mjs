import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sha256, hashFile, VALAIS_DATES, GTFS_SHA256 } from './valais-timetable.mjs'
import { json, zipped } from './build-valais-region.mjs'
import { loadValaisGeometry, applyValaisGeometry } from './valais-geometry.mjs'
import { validateBernSnapshot, validateBernChunks } from './build-bern-region.mjs'
import { bernArea, bernLv95 } from './bern-spatial.mjs'

const raw=await zipped('data/valais-audit/timetable-cache.json.gz'),policy=await json('data/valais-policy.json'),summary=await json('data/valais-audit/summary.json'),inventory=await json('data/valais-audit/routes.json'),boundary=await zipped('data/valais-sources/decoded.json.gz')
assert.equal(raw.sourceHashes.archive,GTFS_SHA256);assert.equal(await hashFile('data/valais-audit/timetable-cache.json.gz'),policy.timetableSha256)
assert.equal(await hashFile('data/valais-sources/decoded.json.gz'),policy.boundarySha256)
assert.equal(raw.census.allYearTrips,2143227);assert.equal(raw.census.stopTimeRows,34499152)
assert.equal(raw.routes.length,summary.routeCount);assert.equal(new Set(raw.routes.map(r=>r.agencyId)).size,summary.agencyCount)
assert.deepEqual(inventory.map(r=>r.id).sort(),raw.routes.map(r=>r.id).sort());assert.equal(summary.districts.length,13)
const contains=bernArea(boundary.canton[0].geometry),inside=new Set(raw.sourceStopInventory.map(s=>s.id))
assert(raw.sourceStopInventory.every(s=>contains(bernLv95(s.point))))
assert.equal(new Set(summary.districts.flatMap(d=>d.routeIds)).size,inventory.length)
const geometry=await loadValaisGeometry(raw,policy,{verifyEvidence:true})
for(const receipt of await json('data/valais-sources/research/requests.json')) {assert.equal(receipt.httpStatus,'200');assert.equal(await hashFile(join('data/valais-sources/research',receipt.file)),receipt.sha256)}
const catalogue=(await Promise.all([1,2,3].map(n=>json(`data/valais-sources/research/arcgis-page-${n}.json`))))
assert.deepEqual(catalogue.map(p=>p.nextStart),[101,201,-1]);assert.equal(new Set(catalogue.flatMap(p=>p.results.map(i=>i.id))).size,catalogue[0].total)
const patternSets=[]
for(const day of raw.snapshots){
 const date=day.metadata.serviceDate,audit=await json(`data/valais-audit/${date}.json`),dir=`public/data/valais-region/${date}`
 const rebuilt=applyValaisGeometry(day,geometry),expected=new Map(rebuilt.trains.filter(t=>t.admission==='admitted').map(t=>[t.id,t]))
 assert.equal(audit.coverage.trips,day.trains.length);assert.equal(audit.coverage.admittedTrips,expected.size)
 assert.equal(audit.patterns.reduce((n,p)=>n+p.trips,0),day.trains.length)
 assert.equal(audit.directedPairs.reduce((n,p)=>n+p.occurrences,0),day.trains.reduce((n,t)=>n+t.stops.length-1,0))
 assert.equal(audit.directedPairs.reduce((n,p)=>n+p.matchedOccurrences,0),audit.coverage.matchedSegmentOccurrences)
 assert.equal(audit.directedPairs.reduce((n,p)=>n+p.admittedOccurrences,0),audit.coverage.admittedSegmentOccurrences)
 const patterns=new Map(audit.patterns.map(p=>[p.id,p]));assert.equal(patterns.size,rebuilt.patterns.length)
 for(const p of rebuilt.patterns){const a=patterns.get(p.id);assert(a);assert.deepEqual(a.stopIds,p.stopIds);assert.equal(a.trips,p.trips);assert.equal(a.admittedTrips,p.admittedTrips);assert.deepEqual(a.results,p.results.map(({pathIndex,...r})=>({...r,matched:pathIndex!==null})))}
 assert.deepEqual(audit.directedPairs,rebuilt.pairs)
 const manifest=await json(join(dir,'valais-region-day-manifest.json')),trains=new Map(),chunks=[]
 for(const descriptor of manifest.chunks){const bytes=await readFile(join(dir,descriptor.path));assert.equal(sha256(bytes),descriptor.sha256);const payload=JSON.parse(bytes);chunks.push({descriptor,payload});for(const t of payload.trains){if(trains.has(t.id))assert.deepEqual(trains.get(t.id),t);trains.set(t.id,t)}}
 assert.deepEqual([...trains.keys()].sort(),[...expected.keys()].sort(),'Feed admission must exactly reconcile against all candidates')
 const snapshot={...manifest,trains:[...trains.values()]};validateBernSnapshot(snapshot);validateBernChunks(snapshot,manifest,chunks)
 for(const t of trains.values()){
  const source=expected.get(t.id),calls=x=>x.stops.map(([i,a,d])=>[day.stops[i][4],a,d])
  assert.deepEqual(t.stops.map(([i,a,d])=>[manifest.stops[i][4],a,d]),calls(source),'Clipped or changed original calls')
  assert.deepEqual(t.callPermissions,source.callPermissions);assert.equal(t.sourceTripId,source.sourceTripId);assert.equal(t.sourceServiceDate,source.sourceServiceDate)
  assert(t.stops.some(([i])=>inside.has(manifest.stops[i][4])),'Lost canton membership')
  assert.deepEqual(t.pathSegments.map(i=>manifest.paths[i]),source.pathSegments.map(i=>rebuilt.paths[i]),'Wrong directed or context-specific geometry')
 }
 const morning=await json(join(dir,'valais-region-morning.json'));validateBernSnapshot(morning)
 const overlap=[...trains.values()].filter(t=>t.start<=morning.metadata.windowEnd&&t.end>=morning.metadata.windowStart)
 assert.deepEqual(morning.trains.map(t=>t.id).sort(),overlap.map(t=>t.id).sort())
 for(const t of morning.trains){const source=expected.get(t.id);assert.deepEqual(t.stops.map(([i,a,d])=>[morning.stops[i][4],a,d]),source.stops.map(([i,a,d])=>[day.stops[i][4],a,d]));assert.deepEqual(t.pathSegments.map(i=>morning.paths[i]),source.pathSegments.map(i=>rebuilt.paths[i]))}
 for(const r of inventory){const rd=r.days.find(d=>d.date===date),source=day.trains.filter(t=>t.routeId===r.id);assert.equal(rd.trips,source.length);assert.equal(rd.admittedTrips,[...expected.values()].filter(t=>t.routeId===r.id).length)}
 patternSets.push(new Set(patterns.keys()))
 console.log(`${date}: ${trains.size}/${day.trains.length} full journeys, ${audit.patterns.length} patterns and every directed pair reconciled; 12 chunks and morning verified`)
}
assert.deepEqual(raw.snapshots.map(d=>d.metadata.serviceDate),VALAIS_DATES)
assert.equal(summary.weekdaySundayPatterns.shared,[...patternSets[0]].filter(p=>patternSets[1].has(p)).length)
assert.equal(await hashFile('public/data/valais-region/road-paths.json'),policy.road.sha256)
console.log('Valais: complete candidate audit and offline source/matcher reconstruction passed')
