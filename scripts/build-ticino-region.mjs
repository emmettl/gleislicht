import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { applyAargauGeometry, validateAargauFeed } from './build-aargau-study.mjs'
import { compactBernFeed } from './build-bern-region.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { pointInCanton } from './aargau-line-geometry.mjs'
import { loadAargauRail } from './aargau-rail-geometry.mjs'
import { ticinoRoadMatcher, ticinoAdmission } from './ticino-geometry.mjs'

const json=async p=>JSON.parse(await readFile(p,'utf8'))
const zipped=async p=>JSON.parse(gunzipSync(await readFile(p)))
const write=async(p,v,pretty=false)=>{await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(v,null,pretty?2:undefined)+(pretty?'\n':''))}
export const TICINO_DATES=['2026-09-04','2026-09-06']

export async function buildTicinoRegion({output='public/data/ticino-region',audit='data/ticino-audit'}={}) {
  const input='data/ticino', inventory=await json(`${input}/inventory.json`), sources=await json('data/ticino-sources/sources.json')
  assert.equal(inventory.metadata.archiveSha256,'d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e')
  assert.equal(inventory.metadata.sourceCatalogueSha256,await hashFile('data/ticino-sources/sources.json'))
  assert.deepEqual(inventory.metadata.dates,TICINO_DATES)
  for(const [name,f]of Object.entries(sources.files))assert.equal(await hashFile(`data/ticino-sources/${name}`),f.sha256)
  const verification=await json(`${input}/source-verification.json`)
  assert(verification.passed)
  assert.equal(verification.archiveSha256,inventory.metadata.archiveSha256)
  assert.equal(verification.inventorySha256,await hashFile(`${input}/inventory.json`))
  const localReview=await json('data/ticino-sources/local-geometry-review.json')
  for(const f of localReview.evidence)assert.equal(await hashFile(`data/ticino-sources/${f.file}`),f.sha256)
  const cache=await zipped('data/ticino-road-cache.json.gz'), roads=ticinoRoadMatcher(cache)
  const rails=await loadAargauRail('data/aargau-rail-sources','data/ticino-rail-policy.json')
  const districts=await json('data/ticino-sources/districts.json'), inside=new Set(inventory.cantonStopIds)
  const sourceHashes={archive:inventory.metadata.archiveSha256,inventory:await hashFile(`${input}/inventory.json`),roads:await hashFile('data/ticino-road-cache.json.gz'),railPolicy:await hashFile('data/ticino-rail-policy.json'),rail:rails.source.sha256,boundary:sources.files['boundary.json'].sha256,localReview:await hashFile('data/ticino-sources/local-geometry-review.json')}
  const provenance={schemaVersion:1,timetable:{publisher:'SBB / Open data platform mobility Switzerland',attribution:'opentransportdata.swiss',sourceUrl:inventory.metadata.archiveUrl,sha256:sourceHashes.archive,feed:inventory.metadata.feed,termsUrl:'https://opentransportdata.swiss/en/terms-of-use/',processedBy:'Gleislicht',archivalStudy:true},
    boundary:sources.boundary,rail:{...rails.source,limits:rails.limits,policy:'Exact national rail route and operating-point identities; full ordered stop chains constrain infrastructure paths. Catalogue dated 2021-07-06, present alignment validity unknown. No actual running-track certification.'},
    roads:{...cache.metadata,derivedDatabase:'road-paths.json.gz',attribution:'© OpenStreetMap contributors',modifications:'Gleislicht: pfaedle matching of complete GTFS patterns, warning rejection, bounded connectors, monotone shape-distance slicing and 5 m simplification. OSM inference, not an operator alignment or diversion certificate.'},
    officialLocalInvestigation:localReview,
    refreshPolicy:'Pinned 4 and 6 September 2026 civil days only; never relabel with the current date. Refresh requires new census, geometry review and admission checks.'}
  const reports=[]
  for(const date of TICINO_DATES) {
    const path=`${input}/${date}-timetable.json.gz`, raw=await zipped(path), timetableHash=await hashFile(path)
    for(const h of [verification.fixtures[`${date}-timetable.json.gz`],cache.metadata.inputTimetableHashes[date],rails.policy.inputTimetableHashes[date]])assert.equal(timetableHash,h)
    console.log(`Matching ${date}: ${raw.trains.length} complete candidate journeys`)
    const result=applyAargauGeometry(raw,new Map(),inventory.cantonStopIds,roads,rails)
    // The shared adapter's local-line stage has no Ticino line source. Replace
    // its empty-stage labels with the actual mode-specific rejection evidence.
    for(const p of result.patterns) {
      p.source={model:p.mode==='bus'?'osm-pattern-inference':p.mode==='rail'?'fot-infrastructure-inference':'no-reviewed-geometry'}
      for(const s of p.segments) {
        if(s.pathIndex===null)s.reason=s.roadFailure??s.railFailure??'no-reviewed-geometry-for-mode'
        delete s.agisRejection
      }
    }
    const geometryPatterns=new Map(result.patterns.map(p=>[p.id,p]))
    const candidates=result.snapshot.trains.map(t=>({...t,admission:ticinoAdmission(t,geometryPatterns.get(t.geometryPatternId).segments)})), admitted=candidates.filter(t=>t.admission==='admitted'), admittedIds=new Set(admitted.map(t=>t.id))
    const snapshot=compactBernFeed(result.snapshot,{trains:candidates,paths:result.snapshot.paths})
    snapshot.metadata={publisher:'Gleislicht',timetablePublisher:'SBB',feedVersion:raw.metadata.feed.feed_version,serviceDate:date,windowStart:0,windowEnd:86400,focusTime:27900,
      sourceUrl:inventory.metadata.archiveUrl,attribution:'opentransportdata.swiss · © Federal Office of Transport · © OpenStreetMap contributors',
      label:'Ticino — initial rail and bus scope',dayModel:raw.metadata.dayModel,sourceHashes:{...sourceHashes,timetable:timetableHash},
      model:'Scheduled interpolation along reviewed FOT infrastructure and inferred OSM bus paths; not observed vehicle locations.',
      note:'Partial canton coverage. Every admitted journey keeps its entire original stop chain, including calls outside Ticino and across midnight. Entire journeys with unresolved geometry, reservation/coordination calls or bus segments implying over 110 km/h are excluded. Lake and mountain services remain inventoried. Two dates do not establish year-round service coverage.',
      modes:[...new Set(admitted.map(t=>t.mode))],geometry:{publisher:'FOT · OpenStreetMap contributors',sourceUrl:'https://www.openstreetmap.org/copyright',license:'ODbL-1.0 (bus path database); FOT terms for rail',localMetadata:'../sources.json'},archivalStudy:true}
    const {manifest,chunks}=chunkNetworkSnapshot(snapshot,7200,'day-chunks')
    const morning=extractNetworkWindow(snapshot,24300,31500,27900)
    const checks=validateAargauFeed(snapshot,{...raw,trains:raw.trains.filter(t=>admittedIds.has(t.id))},manifest,chunks)
    assert(snapshot.trains.every(t=>t.pathSegments.every(Number.isInteger)))
    assert.equal(candidates.length,raw.trains.length)
    const stats=trains=>{
      const kept=trains.filter(t=>t.admission==='admitted')
      return {candidateJourneys:trains.length,admittedJourneys:kept.length,excludedJourneys:trains.length-kept.length,
        candidateOccurrences:trains.reduce((n,t)=>n+t.pathSegments.length,0),matchedCandidateOccurrences:trains.reduce((n,t)=>n+t.pathSegments.filter(i=>i!==null).length,0),admittedOccurrences:kept.reduce((n,t)=>n+t.pathSegments.length,0),
        matchedCantonAdjacentOccurrences:trains.reduce((n,t)=>n+t.stops.slice(1).filter(([s],i)=>t.pathSegments[i]!==null&&(inside.has(raw.stops[s][4])||inside.has(raw.stops[t.stops[i][0]][4]))).length,0),
        admittedCantonAdjacentOccurrences:kept.reduce((n,t)=>n+t.stops.slice(1).filter(([s],i)=>inside.has(raw.stops[s][4])||inside.has(raw.stops[t.stops[i][0]][4])).length,0),
        candidateCantonAdjacentOccurrences:trains.reduce((n,t)=>n+t.stops.slice(1).filter(([s],i)=>inside.has(raw.stops[s][4])||inside.has(raw.stops[t.stops[i][0]][4])).length,0),
        excludedByReason:Object.fromEntries([...new Set(trains.map(t=>t.admission))].filter(s=>s!=='admitted').map(s=>[s,trains.filter(t=>t.admission===s).length]))}
    }
    const routeRows=inventory.routes.filter(r=>r.cantonSourceTrips).map(r=>({...r,days:undefined,day:r.days.find(d=>d.date===date),...stats(candidates.filter(t=>t.routeId===r.routeId))}))
    const groupRows=[...new Set(routeRows.map(r=>`${r.agencyId}:${r.mode}`))].map(id=>{
      const routes=routeRows.filter(r=>`${r.agencyId}:${r.mode}`===id),ids=new Set(routes.map(r=>r.routeId))
      return {id,operator:routes[0].operator,agencyId:routes[0].agencyId,mode:routes[0].mode,archivedRoutes:routes.length,...stats(candidates.filter(t=>ids.has(t.routeId)))}
    })
    const districtRows=districts.map(d=>{
      const ids=new Set(raw.stops.filter(s=>inside.has(s[4])&&pointInCanton(s,d.geometry)).map(s=>s[4]))
      const trains=candidates.filter(t=>t.stops.some(([i])=>ids.has(raw.stops[i][4])))
      return {name:d.name,number:d.number,platforms:ids.size,...stats(trains)}
    })
    for(const p of result.patterns) {
      const trains=candidates.filter(t=>t.geometryPatternId===p.id)
      p.admittedJourneys=trains.filter(t=>t.admission==='admitted').length
      p.admissionReasons=[...new Set(trains.map(t=>t.admission))]
    }
    const pairs=new Map()
    for(const p of result.patterns)for(const s of p.segments){
      const key=JSON.stringify([p.routeId,s.fromId,s.toId]),pair=pairs.get(key)??{routeId:p.routeId,fromId:s.fromId,toId:s.toId,occurrences:0,matched:0,admittedOccurrences:0,reasons:new Set()}
      pair.occurrences+=p.occurrences;if(s.pathIndex!==null)pair.matched+=p.occurrences;else pair.reasons.add(s.reason)
      pair.admittedOccurrences+=p.admittedJourneys;pairs.set(key,pair)
    }
    const controls=['Lugano','Bellinzona','Locarno','Mendrisio','Chiasso','Airolo','Biasca','Acquarossa','Cevio','Intragna'].map(name=>{
      const ids=new Set(raw.stops.filter(s=>s[2]===name||s[2].startsWith(name+',')).map(s=>s[4]))
      return {name,...stats(candidates.filter(t=>t.stops.some(([i])=>ids.has(raw.stops[i][4]))))}
    })
    const zero=[],fastest=new Map(),patternMap=new Map(result.patterns.map(p=>[p.id,p]))
    for(const t of admitted)for(let i=1;i<t.stops.length;i++){
      const seconds=t.stops[i][1]-t.stops[i-1][2],segment=patternMap.get(t.geometryPatternId).segments[i-1]
      const row={tripId:t.id,routeId:t.routeId,line:t.route,from:raw.stops[t.stops[i-1][0]][2],to:raw.stops[t.stops[i][0]][2],seconds,pathMetres:segment.pathMetres}
      if(seconds===0)zero.push(row)
      else {const speed=segment.pathMetres/seconds*3.6;if(speed>(fastest.get(t.mode)?.kilometresPerHour??0))fastest.set(t.mode,{...row,kilometresPerHour:speed})}
    }
    const report={schemaVersion:1,date,sourceHashes:snapshot.metadata.sourceHashes,checks:{...checks,independentSourceArchiveVerification:true,admittedGeometryCoverage:1},coverage:stats(candidates),
      definitions:{candidate:'Every eligible complete journey that calls in the full Ticino polygon. Both current and preceding service calendars included.',occurrence:'Every adjacent pair in the entire source journey, including out-of-canton calls and times outside the civil day.',pattern:'Exact route_id, direction_id and full ordered platform chain, including repeats.',admission:'Complete rail/bus journeys only: all segments accepted, no reservation/coordination calls, and no positive-duration bus segment implying over 110 km/h. This speed is a conservative review gate, not certification of actual travel speed. No geographical or temporal clipping.',district:'Actual polygon membership of source calls; journey totals overlap across districts.'},
      controls,timing:{zeroDurationOccurrences:zero.length,zeroDurationJourneys:new Set(zero.map(r=>r.tripId)).size,maximumPositiveDurationSegmentByMode:[...fastest.values()],policy:'Original minute-resolution GTFS times retained; no artificial travel seconds. Coincident timed calls have no finite implied speed.'},paths:result.snapshot.paths,routes:routeRows,groups:groupRows,districts:districtRows,patterns:result.patterns,pairs:[...pairs.values()].map(p=>({...p,reasons:[...p.reasons]})),
      excludedJourneys:candidates.filter(t=>t.admission!=='admitted').map(t=>({id:t.id,routeId:t.routeId,patternId:t.geometryPatternId,reason:t.admission})),
      border:{candidateOutsideCantonPlatforms:raw.stops.filter(s=>!inside.has(s[4])).length,admittedOutsideCantonPlatforms:snapshot.stops.filter(s=>!inside.has(s[4])).length,admittedJourneysLeavingCanton:admitted.filter(t=>t.stops.some(([i])=>!inside.has(raw.stops[i][4]))).length},
      civilDay:{candidateCarryIn:candidates.filter(t=>t.sourceServiceDate!==date).length,admittedCarryIn:admitted.filter(t=>t.sourceServiceDate!==date).length,candidateHeadway:candidates.filter(t=>t.frequency?.exactTimes===0).length,admittedHeadway:admitted.filter(t=>t.frequency?.exactTimes===0).length},
      payload:{manifestGzipBytes:gzipSync(JSON.stringify(manifest)).length,morningGzipBytes:gzipSync(JSON.stringify(morning)).length,maximumChunkGzipBytes:Math.max(...chunks.map(c=>gzipSync(JSON.stringify(c.payload)).length))}}
    assert(report.payload.manifestGzipBytes<650*1024 && report.payload.maximumChunkGzipBytes<450*1024)
    for(const c of chunks)await write(join(output,date,c.descriptor.path),c.payload)
    await write(join(output,date,'ticino-region-day-manifest.json'),manifest)
    await write(join(output,date,'ticino-region-morning.json'),morning)
    await mkdir(audit,{recursive:true})
    await writeFile(join(audit,`${date}.json.gz`),gzipSync(JSON.stringify(report)))
    reports.push({...report,paths:undefined,patterns:undefined,pairs:undefined,excludedJourneys:undefined,routes:undefined})
    console.log(JSON.stringify({date,coverage:report.coverage,groups:groupRows,districts:districtRows,payload:report.payload}))
  }
  const summary={schemaVersion:1,sourceHashes,scope:inventory.scope,nationalRows:inventory.metadata.sourceRows,cantonRoutes:inventory.routes.filter(r=>r.cantonSourceTrips).length,cantonAgencies:new Set(inventory.routes.filter(r=>r.cantonSourceTrips).map(r=>r.agencyId)).size,
    archivedInactiveRoutes:inventory.routes.filter(r=>r.cantonSourceTrips&&!r.days.some(d=>d.trips)).length,days:reports,
    initialScopeValidated:true,completeCantonGeometry:false,yearRoundValidated:false,scopeLimits:['Only this national GTFS archive is a complete census denominator; services absent from it are not counted.','No non-stopping through services or timetable outside the selected days in the app.','No ferry, cableway or funicular geometry admitted in this initial scope.','Some foreign rail termini and disconnected infrastructure remain outside complete-journey admission.','Road lane legality, specific running tracks, diversions and 2026 infrastructure currency are not certified.']}
  await write(join(audit,'summary.json'),summary,true)
  await write(join(output,'sources.json'),provenance,true)
  await copyFile('data/ticino-road-cache.json.gz',join(output,'road-paths.json.gz'))
  await write(join(output,'index.json'),{dates:TICINO_DATES.map(date=>({date,manifest:`${date}/ticino-region-day-manifest.json`,morning:`${date}/ticino-region-morning.json`})),scope:'Initial rail and bus scope; complete source journeys with accepted geometry only.'},true)
  return summary
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const arg=n=>process.argv.includes(`--${n}`)?process.argv[process.argv.indexOf(`--${n}`)+1]:undefined
  await buildTicinoRegion({output:arg('output'),audit:arg('audit')})
}
