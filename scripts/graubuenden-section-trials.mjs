import { matchLuzernCableway } from './luzern-cableway-geometry.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

// Explicit section hypotheses; a diagnostic ceiling never grants runtime admission.
export function graubuendenSectionTrials(raw, network, review) {
  const stops = new Map(raw.stops.map(s => [s.stop_id, s]))
  const candidates = [
    ['93-291-0-j26-1','1009',[['71.003',['8509160','8509282'],['8509160','8509282']],['71.004',['8509282','8509162'],['8530998','8509162']]]],
    ['93-293-A-j26-1','1176',[['71.074',['8509682','8509683'],['8530920','8509683']]]],
    ['93-296-5-j26-1','1099',[['71.060',['8509380','8509381'],['8509380','8509381']],['71.061',['8509381','8509382'],['8530901','8509382']]]],
    ['93-77-Y-j26-1','1024',[['71.041',['8509085','8509087'],['8530539','8509087']]]],
    ['93-8-Y-j26-1','1024',[['71.033',['8509081','8509082'],['8530885','8509082']]]],
  ]
  return candidates.map(([routeId, sourceOperator, sections]) => {
    const route = raw.inventory.find(r => r.routeId === routeId)
    const identity = { routeId, agencyId: route.agencyId, line: route.line, sourceOperator, segments: sections.map(([installation,stopNumbers,sourceStationNumbers]) => ({installation,stopNumbers,sourceStationNumbers,aliasReason:'Diagnostic section hypothesis only; runtime admission requires its separate pinned review.'})) }
    const trains = [...new Map(raw.snapshots.flatMap(d => d.trains.filter(t => t.routeId === routeId)).map(t => [directedPatternKey(t),t])).values()]
    const patterns = trains.map(t => ({id:sha256(directedPatternKey(t)).slice(0,20),stopIds:t.calls.map(c=>c.id),pairs:t.calls.slice(1).map((c,i)=>matchLuzernCableway(network,{routes:[identity],limits:{...review.limits,stationAttachmentMetres:200}},route,stops.get(t.calls[i].id),stops.get(c.id),raw.dates))}))
    return {routeId,identity,disposition:routeId==='93-291-0-j26-1'?'separate-reviewed-middle-station-attachment':'withheld-needs-endpoint-and-section-review',diagnosticAttachmentCeilingMetres:200,
      days:raw.snapshots.map(d=>({date:d.date,candidates:d.trains.filter(t=>t.routeId===routeId).length})),
      installations:network.installations.filter(i=>sections.some(s=>s[0]===i.number)).map(i=>({...i,stations:network.stations.filter(s=>s.installation===i.id),segments:network.segments.filter(s=>s.installation===i.id)})),patterns}
  })
}
