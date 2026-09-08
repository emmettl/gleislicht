import assert from 'node:assert/strict'
import { join } from 'node:path'
import { rowsFromArchive } from '@motionstudies/data/gtfs'
import { readPostbusDay, prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
const [archive, manifestPath, output] = process.argv.slice(2)
assert(archive && manifestPath && output, 'Usage: ARCHIVE VAUD_MANIFEST OUTPUT')
const {manifest,trains}=await readPostbusDay(manifestPath),routes=new Map()
for await(const row of rowsFromArchive(archive,'routes.txt'))routes.set(row.route_id,row.agency_id)
for(const [id,name] of [['738','Transports publics de la région nyonnaise'],['741','Bus Nyon-Prangins']]){
 const selected=trains.filter(t=>t.category==='bus'&&routes.get(t.routeId)===id)
 assert(selected.length,`Missing Nyon agency ${id}`)
 // Matching requires nonnegative times; retain the civil-day times in artifacts.
 const shifted=selected.map(t=>{const shift=-Math.floor(Math.min(0,...t.stops.flatMap(s=>s.slice(1)))/86400)*86400;return {...t,stops:t.stops.map(([i,a,d])=>[i,a+shift,d+shift])}})
 await prepareRoadFeed({manifest,trains:shifted,output:join(output,id),agency:{id,name,url:'https://www.bustpn.ch'}})
 console.log({id,trips:selected.length,date:manifest.metadata.serviceDate})
}
