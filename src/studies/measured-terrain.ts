import type { NetworkSnapshot } from '@motionstudies/core/domain/network'

export type TerrainPoint = [number, number, number]
export type MeasuredTerrainRoute = { routeId: string; legIndex: number; vehicle: 'train' | 'cogwheel'; points: TerrainPoint[]; stops: { id: string; name: string; progress: number }[]; maskedRanges: { start: number; end: number; names: string[]; kinds: string[]; reason: 'tunnel' | 'covered' | 'alignment' }[] }
export type MeasuredTerrain = {
 id: string; version: 1
 metadata: { serviceDate: string; feedVersion: string; timetableSha256: string; source: string; terrainRelease: string; terrainProductUrl: string; railProductUrl: string; attribution: string }
 origin: { easting: number; northing: number }
 terrain: { rows: number; columns: number; widthMetres: number; depthMetres: number; minElevation: number; maxElevation: number; elevations: number[] }
 routes: MeasuredTerrainRoute[]
}
export type TerrainWindow = { start: number; end: number; legIndex: number }
export type MeasuredTerrainBinding = { data: MeasuredTerrain; routes: { route: MeasuredTerrainRoute; calls: { name: string; arrival: number; departure: number; progress: number }[] }[]; windows: TerrainWindow[] }
const root = (id: string | undefined) => id?.match(/^ch:1:sloid:\d+/)?.[0]
const visible = (route: MeasuredTerrainRoute, progress: number) => !route.maskedRanges.some(r => progress>=r.start && progress<=r.end)
export function bindMeasuredTerrain(value: unknown, network: NetworkSnapshot, sequence: { id: string; legs: { train: NetworkSnapshot['trains'][number]; departure: number; arrival: number; vehicle: 'train' | 'cogwheel' }[]; allowOmittedStops?: boolean }): MeasuredTerrainBinding | undefined {
 try {
 const data=value as MeasuredTerrain | undefined
 const metadata=network.metadata as NetworkSnapshot['metadata'] & {sources?: {timetable?: {sha256?: string}}}
 if (!data || data.id!==sequence.id || data.version!==1 || data.metadata?.serviceDate!==metadata.serviceDate || data.metadata?.feedVersion!==metadata.feedVersion || !metadata.sources?.timetable?.sha256 || data.metadata?.timetableSha256!==metadata.sources.timetable.sha256) return
 const grid=data.terrain
 if(!grid || !Number.isInteger(grid.rows) || !Number.isInteger(grid.columns) || grid.rows<2 || grid.columns<2 || grid.rows*grid.columns>150000 || grid.widthMetres<=0 || grid.depthMetres<=0 || ![grid.widthMetres,grid.depthMetres,grid.minElevation,grid.maxElevation,data.origin?.easting,data.origin?.northing].every(Number.isFinite) || !Array.isArray(grid.elevations) || grid.elevations.length!==grid.rows*grid.columns || grid.elevations.some(h=>!Number.isFinite(h) || h<0 || h>5000)) return
 if(!Array.isArray(data.routes) || data.routes.length!==sequence.legs.length) return
 const routes: MeasuredTerrainBinding['routes']=[], windows: TerrainWindow[]=[]
 for(let i=0;i<sequence.legs.length;i++) {
  const leg=sequence.legs[i],route=data.routes[i],actual=leg?.train as typeof leg.train & {routeId?:string}
  if(!leg || route.legIndex!==i || route.routeId!==actual.routeId || route.vehicle!==leg.vehicle || !Array.isArray(route.points) || route.points.length<2 || route.points.length>10000 || route.points.some(p=>!Array.isArray(p) || p.length!==3 || !p.every(Number.isFinite) || Math.abs(p[0])>grid.widthMetres/2 || Math.abs(p[1])>grid.depthMetres/2 || p[2]<0 || p[2]>4500)) return
  const distances=railSamples(route.points)
  if(distances.some((d,j)=>j>0 && d<=distances[j-1]))return
  if(!Array.isArray(route.stops) || route.stops.length<2 || route.stops[0].progress!==0 || route.stops.at(-1)!.progress!==1 || route.stops.some((s,j)=>!root(s.id) || typeof s.name!=='string' || !Number.isFinite(s.progress) || s.progress<0 || s.progress>1 || j>0 && s.progress<=route.stops[j-1].progress) || new Set(route.stops.map(s=>root(s.id))).size!==route.stops.length) return
  const callStops=leg.train.stops.map(([index])=>route.stops.find(s=>root(s.id)===root(network.stops[index]?.[4])))
  if(!sequence.allowOmittedStops && callStops.length!==route.stops.length || callStops[0]?.progress!==0 || callStops.at(-1)?.progress!==1 || callStops.some((s,j)=>!s || j>0 && s.progress<=callStops[j-1]!.progress))return
  if(!Array.isArray(route.maskedRanges) || route.maskedRanges.some((r,j)=>![r.start,r.end].every(Number.isFinite) || r.start<0 || r.end>1 || r.start>=r.end || j>0 && r.start<=route.maskedRanges[j-1].end || !['tunnel','covered','alignment'].includes(r.reason) || !Array.isArray(r.names) || !Array.isArray(r.kinds) || [...r.names,...r.kinds].some(v=>typeof v!=='string')))return
  const calls=leg.train.stops.map(([,arrival,departure],j)=>({name:callStops[j]!.name,arrival,departure,progress:callStops[j]!.progress}))
  const add=(start:number,end:number)=>{
   start=Math.max(leg.departure,start);end=Math.min(leg.arrival,end)
   if(end<=start)return
   const last=windows.at(-1)
   if(last?.legIndex===i && Math.abs(last.end-start)<0.001)last.end=end
   else windows.push({start,end,legIndex:i})
  }
  for(let j=0;j<calls.length-1;j++) {
   const a=calls[j],b=calls[j+1]
   if(![a.arrival,a.departure,b.arrival,b.departure].every(Number.isFinite) || a.arrival>a.departure || b.arrival>b.departure || a.departure>=b.arrival)return
   if(visible(route,a.progress))add(a.arrival,a.departure)
   const boundaries=[a.progress,...route.maskedRanges.flatMap(r=>[r.start,r.end]).filter(p=>p>a.progress && p<b.progress),b.progress].sort((x,y)=>x-y)
   const time=(p:number)=>a.departure+(b.arrival-a.departure)*(p-a.progress)/(b.progress-a.progress)
   for(let k=1;k<boundaries.length;k++)if(visible(route,(boundaries[k-1]+boundaries[k])/2))add(time(boundaries[k-1]),time(boundaries[k]))
  }
  routes.push({route,calls})
 }
 return {data,routes,windows}
 } catch { return undefined } // Optional source data must fail back to the map, including malformed nested records.
}
export function measuredTerrainPosition(binding: MeasuredTerrainBinding, time: number) {
 for(let i=0;i<binding.routes.length;i++) {
  const {route,calls}=binding.routes[i]
  if(time<calls[0].departure || time>=calls.at(-1)!.arrival)continue
  for(let j=0;j<calls.length-1;j++) {
   const a=calls[j],b=calls[j+1]
   if(time>=b.arrival)continue
   const stopped=time<=a.departure,progress=stopped?a.progress:a.progress+(b.progress-a.progress)*(time-a.departure)/(b.arrival-a.departure)
   return {legIndex:i,route,progress,stopped,from:a.name,to:stopped?a.name:b.name,mask:route.maskedRanges.find(r=>progress>=r.start && progress<=r.end)}
  }
 }
}
export function railSamples(points: TerrainPoint[]) {
 const distances=[0]
 for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(...points[i].map((n,j)=>n-points[i-1][j])))
 return distances
}
export function railPoint(points: TerrainPoint[], distances: number[], progress: number): TerrainPoint {
 const d=Math.max(0,Math.min(1,progress))*distances.at(-1)!
 let lo=1,hi=distances.length-1
 while(lo<hi){const mid=(lo+hi)>>1;if(distances[mid]<d)lo=mid+1;else hi=mid}
 const t=(d-distances[lo-1])/(distances[lo]-distances[lo-1] || 1)
 return points[lo-1].map((n,i)=>n+(points[lo][i]-n)*t) as TerrainPoint
}
