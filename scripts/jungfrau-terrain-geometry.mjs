import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1])
export const ROUTES = ['91-62-j26-1','93-63-j26-1','93-65-j26-1']
export function mappedJungfrauRoutes(network, source, ascentEvidence) {
  const features = source.features.filter(f => f.properties.OBJEKTART === 'Schmalspur' && f.properties.AUSSER_BET === 'Falsch' && f.properties.STANDSEILB === 'Falsch' && f.properties.BETRIEBSBA === 'Falsch')
  const segments = features.flatMap(f => f.paths.flatMap(path => path.slice(1).map((b,i) => ({a:path[i],b,f}))))
  return ROUTES.map((routeId,legIndex) => {
    const train = network.trains.filter(t => t.routeId === routeId && ascentEvidence.trips[t.id]).sort((a,b) => b.stops.length-a.stops.length || Math.abs(a.start-43200)-Math.abs(b.start-43200) || a.id.localeCompare(b.id))[0]
    if (!train) throw new Error(`Missing audited route ${routeId}`)
    const xy = [], stopIndices = [0]
    for (let i=0;i<train.stops.length-1;i++) {
      const path = network.paths?.[train.pathSegments?.[i]]
      if (!path || path.length<2) throw new Error('Missing FOT path')
      const points = path.map(p => wgs84ToLv95(p[0],p[1])), start = wgs84ToLv95(...network.stops[train.stops[i][0]].slice(0,2))
      if (distance(points[0],start)>distance(points.at(-1),start)) points.reverse()
      if (xy.length && distance(xy.at(-1),points[0])>30) throw new Error('Disconnected FOT path')
      for (const p of points) {
        if (!xy.length) { xy.push(p); continue }
        const a = xy.at(-1), d = distance(a,p)
        if (d<0.01) continue
        const count=Math.ceil(d/15)
        for (let j=1;j<=count;j++) xy.push([a[0]+(p[0]-a[0])*j/count,a[1]+(p[1]-a[1])*j/count])
      }
      stopIndices.push(xy.length-1)
    }
    const matches = xy.map(p => {
      let best
      for (const {a,b,f} of segments) {
        if (legIndex>0 && f.properties.ZAHNRADBAH !== 'Wahr') continue
        if (p[0]<Math.min(a[0],b[0])-60 || p[0]>Math.max(a[0],b[0])+60 || p[1]<Math.min(a[1],b[1])-60 || p[1]>Math.max(a[1],b[1])+60) continue
        const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy || 1)))
        const offset = Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)
        if (!best || offset<best.offset) best={offset,point:[...p,a[2]+(b[2]-a[2])*t],id:f.id,kind:f.properties.KUNSTBAUTE,name:f.properties.NAME,year:f.properties.HERKUNFT_J}
      }
      if (!best || best.offset>60 || !best.point.every(Number.isFinite) || best.point[2]<0 || best.point[2]>4500) throw new Error(`No valid TLM rail axis near ${p}`)
      return best
    })
    const lengths=[0]
    for(let i=1;i<matches.length;i++) { const a=matches[i-1].point,b=matches[i].point;lengths.push(lengths[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])) }
    const length=lengths.at(-1)
    const ranges=[]
    for(let i=0;i<matches.length;i++) {
      const m=matches[i]
      if (['Keine','Bruecke'].includes(m.kind) && m.offset<=25) continue
      const from=Math.max(0,(lengths[Math.max(0,i-1)]-30)/length),to=Math.min(1,(lengths[Math.min(matches.length-1,i+1)]+30)/length)
      if ((ranges.at(-1)?.end ?? -1)+60/length>=from) { ranges.at(-1).end=to;if(m.name) ranges.at(-1).names.add(m.name);ranges.at(-1).kinds.add(m.kind) }
      else ranges.push({start:from,end:to,names:new Set(m.name?[m.name]:[]),kinds:new Set([m.kind])})
    }
    return { routeId, legIndex, train, matches, length, stopIndices, stops: train.stops.map(([index],i) => ({id:network.stops[index][4],name:network.stops[index][2],progress:lengths[stopIndices[i]]/length})), maskedRanges:ranges.map(r => ({...r,names:[...r.names],kinds:[...r.kinds]})), maxOffset:Math.max(...matches.map(m=>m.offset)) }
  })
}
