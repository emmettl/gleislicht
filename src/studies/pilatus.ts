import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import evidence from '../../data/pilatus-journey-source.json'
const root=(id:string | undefined)=>id?.match(/^ch:1:sloid:\d+/)?.[0]
export type PilatusDirection = 'ascent' | 'descent'
export const pilatusAscents = (network:NetworkSnapshot) => pilatusJourneys(network,'ascent')
export const pilatusDescents = (network:NetworkSnapshot) => pilatusJourneys(network,'descent')
export function pilatusJourneys(network:NetworkSnapshot, direction:PilatusDirection) {
 const meta=network.metadata as NetworkSnapshot['metadata'] & {sources?:{timetable?:{sha256?:string}}}
 if(meta.serviceDate!==evidence.metadata.serviceDate || meta.feedVersion!==evidence.metadata.feedVersion || meta.sources?.timetable?.sha256!==evidence.metadata.sources.timetable.sha256)return []
 if(new Set(network.trains.map(t=>t.id)).size!==network.trains.length)return []
 return network.trains.filter(train=>{
  const source=evidence.trips[train.id as keyof typeof evidence.trips],actual=train as typeof train & {routeId?:string;agencyId?:string;routeType?:number}
  if(actual.routeId!=='93-R83-j26-1' || actual.agencyId!=='136' || actual.routeType!==116 || !source || source.calls.length<2 || source.calls.length!==train.stops.length)return false
  const first=source.calls[0],last=source.calls.at(-1)!
  if(first.pickup!=='0' || last.dropOff!=='0' || root(network.stops[train.stops[0][0]]?.[4])!==(direction==='ascent'?'ch:1:sloid:8458':'ch:1:sloid:8456') || root(network.stops[train.stops.at(-1)![0]]?.[4])!==(direction==='ascent'?'ch:1:sloid:8456':'ch:1:sloid:8458'))return false
  return train.stops.every(([index,a,d],i)=>root(network.stops[index]?.[4])===root(source.calls[i].stopId) && a===source.calls[i].arrival && d===source.calls[i].departure && a<=d && (!i || train.stops[i-1][2]<a)) && train.stops.slice(1).every((_,i)=>{const p=network.paths?.[train.pathSegments?.[i]??-1];return p && p.length>1 && p.every(c=>c.length===2 && c.every(Number.isFinite))})
 }).sort((a,b)=>a.stops[0][2]-b.stops[0][2] || a.id.localeCompare(b.id))
}
