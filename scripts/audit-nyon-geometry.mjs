import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { rowsFromArchive } from '@motionstudies/data/gtfs'
import { readPostbusDay } from './prepare-postbus-road-feed.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { applyLausanneRailGeometry } from './lausanne-rail-geometry.mjs'
import { applyRoadCache } from './enrich-postbus-roads.mjs'
import { combineRoadCaches } from './lausanne-mbc.mjs'
import { summarizeVaud } from './audit-vaud-study.mjs'
const [archive,railPath,weekdayPath,sundayPath,output] = process.argv.slice(2)
assert(output,'Usage: ARCHIVE RAIL WEEKDAY_MANIFEST SUNDAY_MANIFEST REPORT')
const routes=new Map();for await(const r of rowsFromArchive(archive,'routes.txt'))routes.set(r.route_id,{agencyId:r.agency_id,name:r.route_short_name,mode:['738','741'].includes(r.agency_id)?'bus':'rail'})
const railBytes=await readFile(railPath),network=parseRailNetworkXtf(railBytes.toString(),10)
const anchors=[...network.nodes.values()].filter(n=>n.number==='8501060');assert.equal(anchors.length,1)
const visited=new Set([anchors[0].id]);for(const id of visited)for(const s of network.segments){if(s.start===id)visited.add(s.end);if(s.end===id)visited.add(s.start)}
const corridor=network.segments.filter(s=>visited.has(s.start)&&visited.has(s.end))
assert([...network.nodes.values()].some(n=>n.number==='8519325'&&visited.has(n.id)), 'NStCM must reach underground Nyon station')
assert(![...network.nodes.values()].some(n=>n.number==='8501030'&&visited.has(n.id)), 'NStCM must remain separate from mainline Nyon')
const cachePaths=['738','741'].flatMap(id=>['weekday','sunday'].map(day=>`data/vaud-nyon-${id}-${day}-road-cache.json`))
const cacheBytes=await Promise.all(cachePaths.map(path=>readFile(path)))
const cache=combineRoadCaches(cacheBytes.map(bytes=>JSON.parse(bytes)))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const days=[]
for(const path of [weekdayPath,sundayPath]){
 const {manifest,trains}=await readPostbusDay(path)
 const selected=trains.filter(t=>['66','738','741'].includes(routes.get(t.routeId)?.agencyId))
 const rail=selected.filter(t=>routes.get(t.routeId).agencyId==='66'),bus=selected.filter(t=>t.category==='bus')
 const geometry=applyLausanneRailGeometry({...manifest,trains:rail},network,routes,{rail:corridor})
 const busGeometry=applyRoadCache(manifest,bus,cache),offset=geometry.paths.length
 const snapshot={...manifest,paths:[...geometry.paths,...busGeometry.paths],trains:[...geometry.trains,...busGeometry.trains.map(t=>({...t,pathSegments:t.pathSegments.map(i=>i===null?null:i+offset)}))]}
 const groups=summarizeVaud(snapshot,routes)
 days.push({date:manifest.metadata.serviceDate,trips:selected.length,groups,railProjection:geometry.projectionAudit,manifestSha256:hash(await readFile(path)),gate:{passed:groups.every(g=>g.coverage>=.95),minimumPerGroup:.95}})
}
await writeFile(output,JSON.stringify({schemaVersion:1,scope:'NStCM rail plus TPN and Nyon-Prangins buses in the existing Vaud audit. Rectangular comparison, not an application release. Complete source chains and artifacts are checked separately by build-nyon-study.mjs; see data/nyon-region/audit.json.',railSourceSha256:hash(railBytes),railAnchor:'8501060',railSegmentIds:corridor.map(s=>s.id),cacheHashes:Object.fromEntries(cachePaths.map((p,i)=>[p,hash(cacheBytes[i])])),days},null,2)+'\n')
console.log(days.map(d=>({date:d.date,trips:d.trips,groups:d.groups.map(g=>({id:g.id,trips:g.trips,coverage:g.coverage})),gate:d.gate})))
