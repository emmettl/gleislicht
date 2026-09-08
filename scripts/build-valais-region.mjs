import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { compactBernFeed, validateBernSnapshot, validateBernChunks } from './build-bern-region.mjs'
import { loadValaisGeometry, applyValaisGeometry, lengthMetres } from './valais-geometry.mjs'
import { GTFS_SHA256, VALAIS_DATES, hashFile } from './valais-timetable.mjs'

export const json = async path => JSON.parse(await readFile(path,'utf8'))
export const zipped = async path => JSON.parse(gunzipSync(await readFile(path)))
export async function save(path,value,pretty=false) { await mkdir(dirname(path),{recursive:true}); await writeFile(path,JSON.stringify(value,null,pretty?2:undefined)+(pretty?'\n':'')) }
export function coverage(result) {
  const admitted=result.trains.filter(t=>t.admission==='admitted'), exact=result.trains.filter(t=>t.frequency?.exactTimes!==0)
  const occurrences=trains=>trains.reduce((n,t)=>n+t.pathSegments.length,0),matched=trains=>trains.reduce((n,t)=>n+t.pathSegments.filter(p=>p!==null).length,0)
  return {trips:result.trains.length,admittedTrips:admitted.length,scheduledTrips:exact.length,representativeHeadwayTrips:result.trains.length-exact.length,
    admittedScheduledTrips:admitted.filter(t=>t.frequency?.exactTimes!==0).length,admittedRepresentativeHeadwayTrips:admitted.filter(t=>t.frequency?.exactTimes===0).length,
    patterns:result.patterns.length,admittedPatterns:result.patterns.filter(p=>p.admittedTrips).length,directedPairs:result.pairs.length,
    allContextsMatchedDirectedPairs:result.pairs.filter(p=>p.allContextsMatched).length,partiallyMatchedDirectedPairs:result.pairs.filter(p=>p.matchedOccurrences&&!p.allContextsMatched).length,
    segmentOccurrences:occurrences(result.trains),matchedSegmentOccurrences:matched(result.trains),admittedSegmentOccurrences:occurrences(admitted),
    scheduledSegmentOccurrences:occurrences(exact),matchedScheduledSegmentOccurrences:matched(exact)}
}
export const subset = (r,ids) => ({trains:r.trains.filter(t=>ids.has(t.routeId)),patterns:r.patterns.filter(p=>ids.has(p.routeId)),pairs:r.pairs.filter(p=>ids.has(p.routeId))})
export async function buildValaisRegion(output='public/data/valais-region',audit='data/valais-audit') {
  const policy=await json('data/valais-policy.json'),raw=await zipped('data/valais-audit/timetable-cache.json.gz'),boundary=await zipped('data/valais-sources/decoded.json.gz')
  assert.equal(raw.sourceHashes.archive,GTFS_SHA256);assert.deepEqual(raw.snapshots.map(s=>s.metadata.serviceDate),VALAIS_DATES)
  assert.equal(await hashFile('data/valais-audit/timetable-cache.json.gz'),policy.timetableSha256)
  assert.equal(await hashFile('data/valais-sources/decoded.json.gz'),policy.boundarySha256);assert.equal(raw.sourceHashes.source,policy.boundarySha256)
  const geometry=await loadValaisGeometry(raw,policy,{verifyEvidence:true}), routes=new Map(raw.routes.map(r=>[r.id,r]))
  const sources={schemaVersion:1,timetable:{publisher:'SBB / Open data platform mobility Switzerland',attribution:'opentransportdata.swiss',feedVersion:raw.snapshots[0].metadata.feedVersion,sha256:GTFS_SHA256,
    sourceUrl:raw.snapshots[0].metadata.sourceUrl,termsUrl:'https://opentransportdata.swiss/en/terms-of-use/',archivalStudy:true},boundary:boundary.metadata,
    rail:{...geometry.railSource,localSourceDirectory:policy.rail.sourceDirectory,limits:policy.rail.limits,review:policy.rail.groups},
    road:{...geometry.roadCache.metadata,localPathDatabase:'road-paths.json',license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',licenseUrl:'https://www.openstreetmap.org/copyright'},
    localSourceInvestigation:await json('data/valais-sources/research/review.json'),processedBy:'Gleislicht',
    modifications:'Full-canton trip selection, full-pattern road matching, gauge/operator-restricted rail graph routing, bounded endpoint connectors, source geometry simplification, WGS84 conversion, time interpolation and two-hour chunking.',
    refreshPolicy:'Pinned September 2026 archival study. A new timetable, boundary, geometry or routing policy requires a full rebuild and coverage audit.'}
  const hashes={...raw.sourceHashes,timetable:policy.timetableSha256,policy:await hashFile('data/valais-policy.json'),road:policy.road.sha256,rail:geometry.railSource.sha256}
  const days=[], routeDays=new Map(raw.routes.map(r=>[r.id,[]])), patternSets=[]
  for(const day of raw.snapshots) {
    console.log('Matching Valais',day.metadata.serviceDate,day.trains.length,'complete civil-day instances')
    const result=applyValaisGeometry(day,geometry)
    for(const t of result.trains) { const r=routes.get(t.routeId);t.transportMode=r.type===116?'cogwheel':r.mode;t.category=r.mode==='rail'?(r.type===116?'other':r.name.startsWith('IC')?'intercity':r.name.startsWith('IR')?'interregio':r.name.startsWith('RE')?'regional-express':r.name.startsWith('S')?'s-bahn':'regional'):r.mode }
    const snapshot=compactBernFeed(day,result)
    snapshot.metadata={...day.metadata,publisher:'Gleislicht',label:'Valais / Wallis — initial regional study',sourceHashes:hashes,attribution:'opentransportdata.swiss',
      model:'Scheduled interpolation along reviewed federal infrastructure and OSM-inferred bus roads; not observed vehicles.',scope:raw.census.boundaryRule,admission:policy.admission,exclusions:policy.scopeLimits,
      archivalStudy:true,geometry:{publisher:'FOT · OpenStreetMap contributors',localMetadata:'../sources.json',attribution:['© Federal Office of Transport (FOT)','© OpenStreetMap contributors'],termsUrl:'https://www.openstreetmap.org/copyright',model:'Infrastructure and road inference; full journeys only',railLimits:policy.rail.limits,roadLimits:policy.road.limits},
      frequency:{headwayTrips:snapshot.trains.filter(t=>t.frequency?.exactTimes===0).length,model:'Only exact scheduled instances admitted in this initial scope; headway candidates remain in coverage audit.'}}
    validateBernSnapshot(snapshot)
    const {manifest,chunks}=chunkNetworkSnapshot(snapshot,7200,'day-chunks');validateBernChunks(snapshot,manifest,chunks)
    const morning=extractNetworkWindow(snapshot,24300,31500,27900);validateBernSnapshot(morning)
    const destination=join(output,day.metadata.serviceDate)
    for(const {descriptor,payload} of chunks)await save(join(destination,descriptor.path),payload)
    await save(join(destination,'valais-region-day-manifest.json'),manifest);await save(join(destination,'valais-region-morning.json'),morning)
    const timing={zeroDurationSegmentOccurrences:0,maximumPositiveDurationByMode:{},note:'Source timestamps retained; zero-duration segments have no finite implied speed. Speeds diagnose geometry/timing, not observed movement.'}
    const lengths=snapshot.paths.map(lengthMetres)
    for(const t of snapshot.trains)for(let i=1;i<t.stops.length;i++){const seconds=t.stops[i][1]-t.stops[i-1][2];if(!seconds)timing.zeroDurationSegmentOccurrences++;else{const mode=routes.get(t.routeId).mode,kmh=lengths[t.pathSegments[i-1]]/seconds*3.6;if(kmh>(timing.maximumPositiveDurationByMode[mode]?.kmh??0))timing.maximumPositiveDurationByMode[mode]={kmh,tripId:t.id,routeId:t.routeId,from:snapshot.stops[t.stops[i-1][0]][2],to:snapshot.stops[t.stops[i][0]][2],seconds}}}
    const groups=[...new Set(raw.routes.map(r=>r.agencyId+':'+r.mode))].map(id=>{const rr=raw.routes.filter(r=>r.agencyId+':'+r.mode===id);return{id,agency:rr[0].agency,mode:rr[0].mode,...coverage(subset(result,new Set(rr.map(r=>r.id))))}})
    for(const r of raw.routes){const sub=subset(result,new Set([r.id]));routeDays.get(r.id).push({date:day.metadata.serviceDate,...coverage(sub),reasons:[...new Set(sub.patterns.flatMap(p=>p.reasons))]})}
    const ps=result.patterns.map(p=>({...p,results:p.results.map(({pathIndex,...r})=>({...r,matched:pathIndex!==null}))}))
    const report={schemaVersion:1,date:day.metadata.serviceDate,sourceHashes:hashes,coverage:coverage(result),groups,timing,
      carryInTrips:result.trains.filter(t=>t.sourceServiceDate!==day.metadata.serviceDate).length,admittedCarryInTrips:snapshot.trains.filter(t=>t.sourceServiceDate!==day.metadata.serviceDate).length,
      outOfCantonPlatforms:snapshot.stops.filter(s=>!raw.sourceStopInventory.some(p=>p.id===s[4])).length,
      directions:[...new Set(ps.map(p=>p.directionId))],repeatedStopPatterns:ps.filter(p=>new Set(p.stopIds).size<p.stopIds.length).length,
      admittedRepeatedStopPatterns:ps.filter(p=>p.admittedTrips&&new Set(p.stopIds).size<p.stopIds.length).length,
      nightTrips:result.trains.filter(t=>routes.get(t.routeId).type===705||/^(?:N|SN|BN)\d/.test(t.route)).length,
      admittedNightTrips:snapshot.trains.filter(t=>routes.get(t.routeId).type===705||/^(?:N|SN|BN)\d/.test(t.route)).length,
      patterns:ps,directedPairs:result.pairs,exclusions:Object.fromEntries([...new Set(result.trains.filter(t=>t.admission!=='admitted').map(t=>t.admission))].sort().map(reason=>[reason,result.trains.filter(t=>t.admission===reason).length])),
      payload:{manifestGzipBytes:gzipSync(JSON.stringify(manifest)).length,morningGzipBytes:gzipSync(JSON.stringify(morning)).length,chunks:chunks.map(({descriptor,payload})=>({...descriptor,gzipBytes:gzipSync(JSON.stringify(payload)).length}))},
      validation:{fullOriginalCalls:true,directedEndpoints:true,chunkHashesAndIdentity:true,admittedGeometryCoverage:1,completeCantonGeometry:false,yearRoundValidated:false}}
    await save(join(audit,day.metadata.serviceDate+'.json'),report)
    days.push({...report,patterns:undefined,directedPairs:undefined});patternSets.push(new Set(ps.map(p=>p.id)))
    console.log(JSON.stringify({date:report.date,...report.coverage}))
  }
  const inventory=raw.routes.map(r=>{const days=routeDays.get(r.id),total=days.reduce((n,d)=>n+d.trips,0),admitted=days.reduce((n,d)=>n+d.admittedTrips,0);return{...r,days,status:!total?'inactive-on-validation-dates':!admitted?'excluded':total===admitted?'admitted-all-dated-trips':'partially-admitted',boundarySensitive:r.inCantonStops.every(id=>raw.census.nearBoundary.some(s=>s.id===id))}})
  const districts=boundary.districts.map(d=>{const rr=inventory.filter(r=>r.districts.includes(d.properties.name));return{district:d.properties.name,calledPlatforms:new Set(rr.flatMap(r=>r.inCantonStops).filter(id=>raw.sourceStopInventory.find(s=>s.id===id)?.district===d.properties.name)).size,routeIds:rr.map(r=>r.id),admittedRouteIds:rr.filter(r=>r.days.some(d=>d.admittedTrips)).map(r=>r.id)}})
  const summary={schemaVersion:1,sourceHashes:hashes,sources,census:raw.census,routeCount:inventory.length,agencyCount:new Set(inventory.map(r=>r.agencyId)).size,districts,
    routesByStatus:Object.fromEntries([...new Set(inventory.map(r=>r.status))].map(s=>[s,inventory.filter(r=>r.status===s).length])),
    weekdaySundayPatterns:{shared:[...patternSets[0]].filter(p=>patternSets[1].has(p)).length,weekdayOnly:[...patternSets[0]].filter(p=>!patternSets[1].has(p)).length,sundayOnly:[...patternSets[1]].filter(p=>!patternSets[0].has(p)).length},days,scopeLimits:policy.scopeLimits}
  await save(join(audit,'routes.json'),inventory,true);await save(join(audit,'stops.json'),raw.sourceStopInventory);await save(join(audit,'rail-infrastructure.json'),geometry.railInventory)
  await save(join(audit,'summary.json'),summary,true);await save(join(output,'sources.json'),sources,true)
  await copyFile(policy.road.cache,join(output,'road-paths.json'))
  await save(join(output,'index.json'),{label:'Valais / Wallis initial regional study',dates:VALAIS_DATES.map(date=>({date,manifest:`${date}/valais-region-day-manifest.json`,morning:`${date}/valais-region-morning.json`})),sourceHashes:hashes,admission:policy.admission,scopeLimits:policy.scopeLimits},true)
  for(const name of ['valais-region-day-manifest.json','valais-region-morning.json'])await copyFile(join(output,VALAIS_DATES[0],name),join('public/data',name))
  // Root alias uses matching root-relative chunk paths; preserve hashes of payloads.
  const rootManifest=await json('public/data/valais-region-day-manifest.json')
  for(const c of rootManifest.chunks)c.path=`valais-region/${VALAIS_DATES[0]}/${c.path}`
  await save('public/data/valais-region-day-manifest.json',rootManifest)
  return summary
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) await buildValaisRegion()
