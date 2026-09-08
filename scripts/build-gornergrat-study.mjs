import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { activeServices, rowsFromArchive, stopsById, parseGtfsTime } from '@motionstudies/data/gtfs'
import { createSnapshotBuilder, readStopTimes } from './ingest-gtfs.mjs'
import { readFrequencyIntervals } from './gtfs-frequencies.mjs'
import { applyRailGeometry, parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { distanceMetres } from './water-paths.mjs'
const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1]}
const checksum=async path=>{const h=createHash('sha256');for await(const bytes of createReadStream(path))h.update(bytes);return h.digest('hex')}
export const selectGornergratRoute=r=>r.route_id==='93-48-j26-1' && r.agency_id==='121' && r.route_type==='116'
export function auditGornergratGeometry(snapshot) {
 const pairs=new Map();let occurrences=0,matched=0,maxOffset=0
 for(const train of snapshot.trains)for(let i=1;i<train.stops.length;i++){
  occurrences++
  const from=snapshot.stops[train.stops[i-1][0]],to=snapshot.stops[train.stops[i][0]],path=snapshot.paths?.[train.pathSegments?.[i-1]]
  const offset=path?.length>=2 && path.every(p=>p.length===2 && p.every(Number.isFinite)) ? Math.min(Math.max(distanceMetres(from,path[0]),distanceMetres(to,path.at(-1))),Math.max(distanceMetres(from,path.at(-1)),distanceMetres(to,path[0]))) : Infinity
  if(offset<=100)matched++;maxOffset=Math.max(maxOffset,offset)
  pairs.set(`${from[4]}:${to[4]}`,{from:from[2],to:to[2],fromId:from[4],toId:to[4],path:train.pathSegments?.[i-1]??null,offsetMetres:Number.isFinite(offset)?offset:null})
 }
 return {occurrences,matched,maxOffsetMetres:Number.isFinite(maxOffset)?maxOffset:null,pairs:[...pairs.values()],passed:occurrences>0 && occurrences===matched}
}
async function main(){
 const archive=arg('archive'),railSource=arg('rail-source'),date=arg('date','2026-09-04')
 if(!archive || !railSource)throw new Error('Use --archive GTFS.zip --rail-source schienennetz.xtf')
 const [services,sourceStops,xml]=await Promise.all([activeServices(archive,date),stopsById(archive),readFile(railSource,'utf8')])
 const routes=new Map(),trips=new Map(),operators=new Map()
 for await(const r of rowsFromArchive(archive,'agency.txt'))operators.set(r.agency_id,r.agency_name)
 for await(const r of rowsFromArchive(archive,'routes.txt'))if(selectGornergratRoute(r))routes.set(r.route_id,r)
 if(routes.size!==1)throw new Error('Expected the exact Gornergrat cogwheel route')
 for await(const t of rowsFromArchive(archive,'trips.txt'))if(routes.has(t.route_id) && services.has(t.service_id))trips.set(t.trip_id,{route:'48',routeId:t.route_id,agencyId:'121',operator:operators.get('121'),category:'other',mode:'rail',headsign:t.trip_headsign,shortName:t.trip_short_name})
 const frequencies=await readFrequencyIntervals(archive,trips)
 if(frequencies.size)throw new Error('Frequency templates require a separate operating-semantics audit')
 const builder=createSnapshotBuilder({trips,sourceStops,windowStart:0,windowEnd:86400,focusTime:43200,displayBounds:{minLongitude:-180,maxLongitude:180,minLatitude:-90,maxLatitude:90}})
 await readStopTimes(archive,trips,[builder],frequencies,0,86400)
 const snapshot=builder.finish();snapshot.trains=snapshot.trains.map(t=>({...t,routeId:'93-48-j26-1',agencyId:'121',operator:operators.get('121'),routeType:116}))
 const rail=applyRailGeometry(snapshot,parseRailNetworkXtf(xml,10))
 const retained=new Map(rail.trains.map(t=>[t.id,{calls:[]}]))
 for await(const r of rowsFromArchive(archive,'stop_times.txt'))if(retained.has(r.trip_id))retained.get(r.trip_id).calls.push({stopId:r.stop_id,arrival:parseGtfsTime(r.arrival_time),departure:parseGtfsTime(r.departure_time),pickup:r.pickup_type||'0',dropOff:r.drop_off_type||'0',sequence:Number(r.stop_sequence)})
 let feed;for await(const r of rowsFromArchive(archive,'feed_info.txt')){feed=r;break}
 const metadata={publisher:feed.feed_publisher_name,feedVersion:feed.feed_version,serviceDate:date,windowStart:0,windowEnd:86400,focusTime:43200,sourceUrl:'https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/',model:'Scheduled interpolation on mapped 2D FOT railway alignment; no live positions or measured terrain.',note:'Exact Gornergratbahn route only, including short workings. Original service day; no preceding-day spillover or seasonal comparison.',sources:{timetable:{sha256:await checksum(archive)},rail:{publisher:'Federal Office of Transport',sha256:await checksum(railSource),simplificationToleranceMetres:10}}}
 const result={...snapshot,...rail,metadata};delete result.audit
 const geometry=auditGornergratGeometry(result),counts={trips:result.trains.length,stops:result.stops.length,paths:result.paths.length,gzipBytes:gzipSync(JSON.stringify(result)).length}
 const evidence={metadata,trips:Object.fromEntries([...retained].map(([id,t])=>[id,{...t,calls:t.calls.sort((a,b)=>a.sequence-b.sequence)}]))}
 for(const train of result.trains){const source=evidence.trips[train.id];if(source.calls.length!==train.stops.length || train.stops.some(([i,a,d],j)=>result.stops[i][4]!==source.calls[j].stopId || a!==source.calls[j].arrival || d!==source.calls[j].departure))throw new Error(`Unreconciled calls: ${train.id}`)}
 await writeFile(arg('audit-output','data/gornergrat-study-audit.json'),JSON.stringify({metadata,counts,geometry},null,2)+'\n')
 if(!geometry.passed || counts.gzipBytes>40*1024)throw new Error('Gornergrat geometry or payload gate failed')
 await writeFile(arg('source-output','data/gornergrat-ascent-source.json'),JSON.stringify(evidence)+'\n')
 await writeFile(arg('output','public/data/gornergrat-day.json'),JSON.stringify(result)+'\n')
 console.log(JSON.stringify({counts,geometry},null,2))
}
if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error(e);process.exitCode=1})
