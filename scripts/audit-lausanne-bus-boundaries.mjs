import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const arg = name => process.argv[process.argv.indexOf(`--${name}`) + 1]
for (const name of ['archive', 'weekday', 'sunday', 'output']) assert(process.argv.includes(`--${name}`), `Missing --${name}`)
import {rowsFromArchive} from '@motionstudies/data/gtfs'
const snapshots=await Promise.all([arg('weekday'),arg('sunday')].map(async p=>JSON.parse(await readFile(p))))
const source=new Map()
for(const s of snapshots) for(const t of s.trains.filter(t=>t.category==='bus'))source.set(t.sourceTripId,[])
for await(const row of rowsFromArchive(arg('archive'),'stop_times.txt'))if(source.has(row.trip_id))source.get(row.trip_id).push([+row.stop_sequence,row.stop_id])
for(const stops of source.values())stops.sort((a,b)=>a[0]-b[0])
const results=snapshots.map(s=>{
 const buses=s.trains.filter(t=>t.category==='bus'), clipped=[]
 for(const t of buses){
  const full=source.get(t.sourceTripId).map(s=>s[1]), retained=t.stops.map(([i])=>s.stops[i][4])
  if(JSON.stringify(full)!==JSON.stringify(retained))clipped.push({id:t.id,sourceTripId:t.sourceTripId,route:t.route,fullStops:full.length,retainedStops:retained.length,from:s.stops[t.stops[0][0]][2],to:s.stops[t.stops.at(-1)[0]][2]})
 }
 return {date:s.metadata.serviceDate,trips:buses.length,completeSourceSequences:buses.length-clipped.length,clipped}
})
await writeFile(arg('output'),JSON.stringify({sourceHashes: Object.fromEntries(await Promise.all(['archive','weekday','sunday'].map(async key => [key,createHash('sha256').update(await readFile(arg(key))).digest('hex')]))), dates: results},null,2)+'\n')
assert(results.every(result => result.clipped.length === 0), 'Some tl bus trips are clipped at the study boundary')
console.log(results.map(({clipped,...rest})=>({...rest,clipped:clipped.length,examples:clipped.slice(0,6)})))
