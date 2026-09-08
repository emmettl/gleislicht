import assert from 'node:assert/strict'
import { mkdir,writeFile } from 'node:fs/promises'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
import { hashFile } from './inventory-aargau.mjs'
const output=process.argv[2];assert(output,'Supply a temporary preparation directory')
const input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz'),inventory=await readJson('data/aargau-witnesses/inventory.json')
const byStop=new Map(input.stops.map((s,i)=>[s[4],i]))
const trains=input.trains.filter(t=>t.agencyId==='7244').map(t=>({...t,id:t.sourceTripId,stops:t.calls.map(([id,a,d])=>[byStop.get(id),a,d])}))
assert.equal(trains.length,336);assert(trains.every(t=>t.routeId==='92-A07-9-j26-1'))
const metadata={serviceDate:'2026-04-25',serviceDates:['2026-04-25','2026-04-26','2026-09-12','2026-09-13'],feedVersion:inventory.feed.feed_version,sourceUrl:inventory.feed.feed_publisher_url,aargauRoadAgencyId:'7244',inputTimetableHashes:{'archived-templates':await hashFile('data/aargau-witnesses/source-patterns.json.gz')},note:'Routing-only union of six AVA witness patterns, not a dated passenger feed. September road closure requires separate review; no result is automatically admitted.'}
await mkdir(output,{recursive:true})
const result=await prepareRoadFeed({manifest:{metadata,stops:input.stops},trains,output:output+'/7244',agency:{id:'7244',name:'Aargau Verkehr AG Ersatzverkehr',url:'https://www.aargauverkehr.ch'}})
assert.equal(result.patterns,6)
await writeFile(output+'/preparation.json',JSON.stringify({schemaVersion:1,agencies:[{agencyId:'7244',...result}],inputTimetableHashes:metadata.inputTimetableHashes},null,2)+'\n')
console.log(result)
