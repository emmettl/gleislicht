import assert from 'node:assert/strict'
import { mkdir,writeFile } from 'node:fs/promises'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
import { hashFile } from './inventory-aargau.mjs'
const output=process.argv[2];assert(output,'Supply a temporary preparation directory')
const input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz'),inventory=await readJson('data/aargau-witnesses/inventory.json')
const scope=await readJson('data/aargau-witness-lenzburg-sources/scope.json'),buses=await readJson('data/aargau-witnesses/bus-inventory.json')
const tripIds=new Set(buses.patterns.filter(r=>scope.patternIds.includes(r.id)).flatMap(r=>r.templates.map(j=>j.sourceTripId)))
const byStop=new Map(input.stops.map((s,i)=>[s[4],i]))
const trains=input.trains.filter(t=>tripIds.has(t.sourceTripId)).map(t=>({...t,id:t.sourceTripId,stops:t.calls.map(([id,a,d])=>[byStop.get(id),a,d])}))
assert.equal(trains.length,300);assert(trains.every(t=>tripIds.has(t.sourceTripId)))
const metadata={serviceDate:'2026-05-23',serviceDates:['2026-05-23','2026-05-24','2026-05-25'],feedVersion:inventory.feed.feed_version,sourceUrl:inventory.feed.feed_publisher_url,aargauRoadAgencyId:'7231',inputTimetableHashes:{'archived-templates':await hashFile('data/aargau-witnesses/source-patterns.json.gz')},note:'Routing-only union of eight May Lenzburg witness patterns, not a dated passenger feed. All source calls retained; road matching alone does not admit a segment.'}
await mkdir(output,{recursive:true})
const result=await prepareRoadFeed({manifest:{metadata,stops:input.stops},trains,output:output+'/7231',agency:{id:'7231',name:'SBB Infrastruktur AG Bahnersatz',url:'https://www.sbb.ch'}})
assert.equal(result.patterns,8)
await writeFile(output+'/preparation.json',JSON.stringify({schemaVersion:1,agencies:[{agencyId:'7231',...result}],inputTimetableHashes:metadata.inputTimetableHashes},null,2)+'\n')
console.log(result)
