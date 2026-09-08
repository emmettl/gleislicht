import assert from 'node:assert/strict'
import { mkdir,writeFile } from 'node:fs/promises'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
import { hashFile } from './inventory-aargau.mjs'
const output=process.argv[2];assert(output,'Supply a temporary preparation directory')
const input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz'),inventory=await readJson('data/aargau-witnesses/inventory.json')
const byStop=new Map(input.stops.map((s,i)=>[s[4],i]))
const trains=input.trains.filter(t=>t.routeId==='96-138-1-j26-1').map(t=>({...t,id:t.sourceTripId,stops:t.calls.map(([id,a,d])=>[byStop.get(id),a,d])}))
assert.equal(trains.length,32);assert(trains.every(t=>t.routeId==='96-138-1-j26-1'))
const metadata={serviceDate:'2026-09-25',serviceDates:['2026-09-25','2026-09-26','2026-09-27'],feedVersion:inventory.feed.feed_version,sourceUrl:inventory.feed.feed_publisher_url,aargauRoadAgencyId:'801',inputTimetableHashes:{'archived-templates':await hashFile('data/aargau-witnesses/source-patterns.json.gz')},note:'Routing-only union of twelve Schupfart Festival witness patterns, not a dated passenger feed. All source calls retained; road matching alone does not admit a segment.'}
await mkdir(output,{recursive:true})
const result=await prepareRoadFeed({manifest:{metadata,stops:input.stops},trains,output:output+'/801',agency:{id:'801',name:'PostAuto AG',url:'https://www.postauto.ch'}})
assert.equal(result.patterns,12)
await writeFile(output+'/preparation.json',JSON.stringify({schemaVersion:1,agencies:[{agencyId:'801',...result}],inputTimetableHashes:metadata.inputTimetableHashes},null,2)+'\n')
console.log(result)
