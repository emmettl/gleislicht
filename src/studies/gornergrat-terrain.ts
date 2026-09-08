import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import { gornergratAscents, gornergratDescents } from './gornergrat.ts'
import { bindMeasuredTerrain, type MeasuredTerrain } from './measured-terrain.ts'
export function bindGornergratTerrain(value: unknown, network: NetworkSnapshot, train: NetworkSnapshot['trains'][number]) {
 const ascent=gornergratAscents(network).includes(train)
 if(!ascent && !gornergratDescents(network).includes(train))return
 try {
  const data=value as MeasuredTerrain
  let oriented=value
  if(!ascent){
   if(!data || !Array.isArray(data.routes) || data.routes.length!==1)return
   const route=data.routes[0] as MeasuredTerrain['routes'][number] & {reverseTripIds?:string[]}
   // Older ascent-only artifacts cannot authorise reversed terrain. Generation
   // checks every listed downhill trip against the full source XYZ polyline.
   if(!Array.isArray(route.reverseTripIds) || !route.reverseTripIds.includes(train.id))return
   oriented={...data,routes:[{...route,points:[...route.points].reverse(),stops:[...route.stops].reverse().map(s=>({...s,progress:1-s.progress})),maskedRanges:[...route.maskedRanges].reverse().map(r=>({...r,start:1-r.end,end:1-r.start}))}]}
  }
  return bindMeasuredTerrain(oriented,network,{id:'gornergrat-ascent-terrain',allowOmittedStops:true,legs:[{train,departure:train.stops[0][2],arrival:train.stops.at(-1)![1],vehicle:'cogwheel'}]})
 } catch { return undefined }
}
