import { createHash } from 'node:crypto'
import { mapTerrainRoute } from './jungfrau-terrain-geometry.mjs'
// Audit each dated trip independently before sharing a railway in either direction.
export function mappedPilatusRoutes(network, source, evidence) {
 // Short tunnel axes can otherwise be replaced by a nearby outdoor axis. Pin
 // the complete bounded extract, including structures, before nearest matching.
 if(source.archiveSha256!=='75086b5aa7e721f5ad2ea080e14e9e3f42d5e0afdee31c2e3c162f412fab4114' || createHash('sha256').update(JSON.stringify(source.features)).digest('hex')!=='db8580ab62567223558b75ffb9032f02c4ab03eda7fe5cca85534131bed65f02')throw new Error('Pinned Pilatus railway source changed; review required')
 if(network.metadata.serviceDate!==evidence.metadata.serviceDate || network.metadata.sources.timetable.sha256!==evidence.metadata.sources.timetable.sha256)throw new Error('Mismatched dated evidence')
 for(const t of network.trains){
  const calls=evidence.trips[t.id]?.calls
  if(!calls || calls.length!==3 || t.stops.length!==3 || t.stops.some(([i,a,d],j)=>network.stops[i][4]!==calls[j].stopId || a!==calls[j].arrival || d!==calls[j].departure))throw new Error('Changed source calls require a separate terrain audit')
 }
 const trains=network.trains.filter(t=>t.routeId==='93-R83-j26-1' && t.agencyId==='136' && t.routeType===116 && network.stops[t.stops[0][0]][4]==='ch:1:sloid:8458' && network.stops[t.stops.at(-1)[0]][4]==='ch:1:sloid:8456' && evidence.trips[t.id]).sort((a,b)=>b.stops.length-a.stops.length || a.start-b.start)
 if(trains.length!==17)throw new Error('Expected all 17 dated summit ascents')
 const routes=trains.map(t=>mapTerrainRoute(network,source,t,0,true)), canonical=routes[0]
 for(const route of routes) {
  if(JSON.stringify(route.matches)!==JSON.stringify(canonical.matches) || route.stops.some(s=>!canonical.stops.some(c=>s.id===c.id && s.progress===c.progress)))throw new Error('Ascent path variant requires a separate terrain audit')
 }
 const descents=network.trains.filter(t=>t.routeId==='93-R83-j26-1' && t.agencyId==='136' && t.routeType===116 && network.stops[t.stops[0][0]][4]==='ch:1:sloid:8456' && network.stops[t.stops.at(-1)[0]][4]==='ch:1:sloid:8458' && evidence.trips[t.id]).sort((a,b)=>a.start-b.start)
 if(descents.length!==17)throw new Error('Expected all 17 dated complete descents')
 let maxReverseDifferenceMetres=0
 for(const train of descents) {
  const route=mapTerrainRoute(network,source,train,0,true)
  if(route.matches.length!==canonical.matches.length)throw new Error('Descent path variant requires a separate terrain audit')
  route.matches.forEach((match,i)=>{
   const reversed=canonical.matches.at(-1-i)
   const delta=Math.hypot(...match.point.map((n,j)=>n-reversed.point[j]))
   maxReverseDifferenceMetres=Math.max(maxReverseDifferenceMetres,delta)
   if(delta>0.001 || match.id!==reversed.id || match.kind!==reversed.kind)throw new Error('Descent path variant requires a separate terrain audit')
  })
  if(route.stops.some(s=>!canonical.stops.some(c=>s.id===c.id && Math.abs(s.progress-(1-c.progress))<1e-12)))throw new Error('Descent call position requires a separate terrain audit')
 }
 const audit=trips=>({count:trips.length,patterns:[...new Set(trips.map(t=>t.stops.length))].sort(),trips:trips.map(t=>({id:t.id,calls:t.stops.length,paths:t.pathSegments}))})
 return [{...canonical,vehicle:'cogwheel',ascentAudit:audit(trains),descentAudit:{...audit(descents),maxReverseDifferenceMetres},forwardTripIds:trains.map(t=>t.id),reverseTripIds:descents.map(t=>t.id)}]
}
