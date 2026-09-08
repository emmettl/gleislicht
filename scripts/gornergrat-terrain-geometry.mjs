import { mapTerrainRoute } from './jungfrau-terrain-geometry.mjs'
// Audit every dated ascent, including the six- and seven-call patterns. The same
// source polyline must support both; an omitted public call is not an extra stop.
export function mappedGornergratRoutes(network, source, evidence) {
 const trains=network.trains.filter(t=>t.routeId==='93-48-j26-1' && t.agencyId==='121' && t.routeType===116 && network.stops[t.stops[0][0]][4]==='ch:1:sloid:1690' && network.stops[t.stops.at(-1)[0]][4]==='ch:1:sloid:1694' && evidence.trips[t.id]).sort((a,b)=>b.stops.length-a.stops.length || a.start-b.start)
 if(trains.length!==26)throw new Error('Expected all 26 dated summit ascents')
 const routes=trains.map(t=>mapTerrainRoute(network,source,t,0,true)), canonical=routes[0]
 for(const route of routes) {
  if(JSON.stringify(route.matches)!==JSON.stringify(canonical.matches) || route.stops.some(s=>!canonical.stops.some(c=>s.id===c.id && s.progress===c.progress)))throw new Error('Ascent path variant requires a separate terrain audit')
 }
 const descents=network.trains.filter(t=>t.routeId==='93-48-j26-1' && t.agencyId==='121' && t.routeType===116 && network.stops[t.stops[0][0]][4]==='ch:1:sloid:1694' && network.stops[t.stops.at(-1)[0]][4]==='ch:1:sloid:1690' && evidence.trips[t.id]).sort((a,b)=>a.start-b.start)
 if(descents.length!==26)throw new Error('Expected all 26 dated complete descents')
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
 return [{...canonical,vehicle:'cogwheel',ascentAudit:audit(trains),descentAudit:{...audit(descents),maxReverseDifferenceMetres},reverseTripIds:descents.map(t=>t.id)}]
}
