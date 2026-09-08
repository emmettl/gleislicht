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
 return [{...canonical,vehicle:'cogwheel',ascentAudit:{count:trains.length,patterns:[...new Set(trains.map(t=>t.stops.length))].sort(),trips:trains.map(t=>({id:t.id,calls:t.stops.length,paths:t.pathSegments}))}}]
}
