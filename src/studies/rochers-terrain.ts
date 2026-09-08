import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import { rochersAscents, rochersDescents } from './rochers.ts'
import { bindMeasuredTerrain, type MeasuredTerrain } from './measured-terrain.ts'
export function bindRochersTerrain(value: unknown, network: NetworkSnapshot, train: NetworkSnapshot['trains'][number]) {
 const ascent=rochersAscents(network).includes(train)
 if(!ascent && !rochersDescents(network).includes(train))return
 try {
  const data=value as MeasuredTerrain
  if(!data || !Array.isArray(data.routes) || data.routes.length!==1)return
  const audited=data.routes[0] as MeasuredTerrain['routes'][number] & {forwardTripIds?:string[];reverseTripIds?:string[]}
  if(ascent && (!Array.isArray(audited.forwardTripIds) || !audited.forwardTripIds.includes(train.id)))return
  let oriented=value
  if(!ascent){
   if(!data || !Array.isArray(data.routes) || data.routes.length!==1)return
   const route=data.routes[0] as MeasuredTerrain['routes'][number] & {reverseTripIds?:string[]}
   // Older ascent-only artifacts cannot authorise reversed terrain. Generation
   // checks every listed downhill trip against the full source XYZ polyline.
   if(!Array.isArray(route.reverseTripIds) || !route.reverseTripIds.includes(train.id))return
   oriented={...data,routes:[{...route,points:[...route.points].reverse(),stops:[...route.stops].reverse().map(s=>({...s,progress:1-s.progress})),maskedRanges:[...route.maskedRanges].reverse().map(r=>({...r,start:1-r.end,end:1-r.start}))}]}
  }
  return bindMeasuredTerrain(oriented,network,{id:'rochers-ascent-terrain',legs:[{train,departure:train.stops[0][2],arrival:train.stops.at(-1)![1],vehicle:'cogwheel'}]})
 } catch { return undefined }
}
