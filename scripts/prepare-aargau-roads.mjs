import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { applyAargauGeometry } from './build-aargau-study.mjs'
import { lineIndex } from './aargau-line-geometry.mjs'

export async function prepareAargauRoads(input, sources, crosswalkPath, output) {
  const inventory=JSON.parse(await readFile(join(input,'inventory.json'),'utf8'))
  const index=lineIndex(JSON.parse(gunzipSync(await readFile(join(sources,'lines.json.gz')))),JSON.parse(await readFile(crosswalkPath,'utf8')).mappings)
  const groups=new Map(), inputTimetableHashes={}
  for(const date of inventory.metadata.dates) {
    const file=join(input,`${date}-timetable.json.gz`)
    inputTimetableHashes[date]=await hashFile(file)
    const raw=JSON.parse(gunzipSync(await readFile(file)))
    const {snapshot}=applyAargauGeometry(raw,index,inventory.cantonStopIds)
    for(const train of snapshot.trains.filter(t=>t.mode==='bus' && t.pathSegments.some(p=>p===null))) {
      const group=groups.get(train.agencyId)??{stops:[],indexes:new Map(),trains:[]}
      // A routing-only union, not a new passenger calendar. Shift the entire
      // retained trip to nonnegative GTFS times without changing stop intervals.
      const shift=-Math.floor(Math.min(0,...train.stops.flatMap(s=>s.slice(1)))/86400)*86400
      const stops=train.stops.map(([i,a,d])=>{
        const stop=snapshot.stops[i],key=JSON.stringify(stop)
        if(!group.indexes.has(key)){group.indexes.set(key,group.stops.length);group.stops.push(stop)}
        return [group.indexes.get(key),a+shift,d+shift]
      })
      group.trains.push({...train,stops});groups.set(train.agencyId,group)
    }
  }
  const result=[]
  await mkdir(output,{recursive:true})
  for(const [id,group] of [...groups].sort((a,b)=>a[0].localeCompare(b[0]))) {
    const agency=inventory.agencies.find(a=>a.agency_id===id);assert(agency)
    const metadata={serviceDate:inventory.metadata.dates[0],serviceDates:inventory.metadata.dates,feedVersion:inventory.metadata.feed.feed_version,sourceUrl:'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020',aargauRoadAgencyId:id,inputTimetableHashes,crosswalkSha256:await hashFile(crosswalkPath),note:'Routing-only union of complete bus patterns with AGIS gaps. Each agency remains separate. Shifted source times are not a published passenger timetable.'}
    result.push({agencyId:id,...await prepareRoadFeed({manifest:{metadata,stops:group.stops},trains:group.trains,output:join(output,id),agency:{id,name:agency.agency_name,url:agency.agency_url}})})
  }
  await writeFile(join(output,'preparation.json'),JSON.stringify({schemaVersion:1,agencies:result,inputTimetableHashes},null,2)+'\n')
  return result
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const arg=n=>process.argv[process.argv.indexOf(`--${n}`)+1]
 for(const n of ['input','sources','crosswalk','output'])assert(process.argv.includes(`--${n}`),`Missing --${n}`)
 console.log(await prepareAargauRoads(arg('input'),arg('sources'),arg('crosswalk'),arg('output')))
}
