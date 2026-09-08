import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { previousServiceDate } from './civil-day.mjs'

const length = points => points.slice(1).reduce((n,p,i)=>n+distanceMetres(points[i],p),0)
export const operatingPointNumber = id => {
  const sloid = String(id).match(/^ch:1:sloid:(\d+)(?=[:_]|$)/)?.[1]
  return sloid ? `85${sloid.padStart(5,'0')}` : String(id).match(/^(\d{7})(?=[:_]|$)/)?.[1]
}

export function parseZugRail(xml, tolerance) {
  const parsed = parseRailNetworkXtf(xml,tolerance)
  const attributes = new Map([...xml.matchAll(/<Schienennetz_LV95_V1_3\.Schienennetz\.Netzsegment TID="([^"]+)">([\s\S]*?)<\/Schienennetz_LV95_V1_3\.Schienennetz\.Netzsegment>/g)].map(([,id,body]) => {
    const field = name => body.match(new RegExp(`<${name}>([^<]+)</${name}>`))?.[1] ?? null
    return [id,{ gauge:field('Spurweite'), dataStand:field('Stand'), validFrom:field('BeginnGueltigkeit'), validUntil:field('EndeGueltigkeit'), infrastructureOperator:field('TUAbkuerzung') }]
  }))
  assert.equal(attributes.size,parsed.segments.length,'XTF parser skipped a source segment')
  return {...parsed,segments:parsed.segments.map(s=>({...s,...attributes.get(s.id)}))}
}

function shortest(graph,start,end,blocked,maximum) {
  const distances=new Map([[start,0]]), previous=new Map(), queue=[[0,start]]
  while(queue.length) {
    queue.sort((a,b)=>b[0]-a[0]);const [distance,node]=queue.pop()
    if(distance!==distances.get(node))continue
    if(node===end) {
      const edges=[]
      for(let n=end;n!==start;){const step=previous.get(n);edges.unshift(step);n=step.from}
      return edges
    }
    for(const edge of graph.get(node)??[]) {
      if(blocked.has(edge.to)&&edge.to!==end)continue
      const next=distance+edge.metres
      if(next>maximum||next>=(distances.get(edge.to)??Infinity))continue
      distances.set(edge.to,next);previous.set(edge.to,edge);queue.push([next,edge.to])
    }
  }
}

export function zugRailMatcher(network, config, dateRange) {
  const limits=config.limits, routes=new Map(config.routes.map(r=>[r.routeId,r])), numbers=new Map(), graph=new Map(), sourceInventory=[]
  for(const node of network.nodes.values()) {
    const values=numbers.get(node.number)??[];values.push(node);numbers.set(node.number,values)
  }
  for(const segment of network.segments) {
    const a=network.nodes.get(segment.start),b=network.nodes.get(segment.end)
    assert(a&&b&&segment.points.length>=2)
    const reverse=distanceMetres(a.coordinate,segment.points.at(-1))+distanceMetres(b.coordinate,segment.points[0]) < distanceMetres(a.coordinate,segment.points[0])+distanceMetres(b.coordinate,segment.points.at(-1))
    const points=reverse?[...segment.points].reverse():segment.points
    const attachment=Math.max(distanceMetres(a.coordinate,points[0]),distanceMetres(b.coordinate,points.at(-1)))
    const reason=!(config.gauges ?? ['mm1435']).includes(segment.gauge)?'non-standard-gauge':config.infrastructureOperators&&!config.infrastructureOperators.includes(segment.infrastructureOperator)?'unreviewed-infrastructure-operator':segment.validUntil&&segment.validUntil<dateRange[1]?'expired-source-segment':segment.validFrom>dateRange[0]?'future-source-segment':attachment>limits.topologyAttachmentMetres?'source-topology-attachment-too-far':null
    sourceInventory.push({id:segment.id,gauge:segment.gauge,dataStand:segment.dataStand,validFrom:segment.validFrom,validUntil:segment.validUntil,infrastructureOperator:segment.infrastructureOperator,attachmentMetres:attachment,reason})
    if(reason)continue
    const path=[a.coordinate,...points,b.coordinate]
    for(const [from,to,p]of[[a.id,b.id,path],[b.id,a.id,[...path].reverse()]]) {
      const edges=graph.get(from)??[];edges.push({from,to,id:segment.id,points:p,metres:length(p),attachment});graph.set(from,edges)
    }
  }
  const cache=new Map()
  return {sourceInventory,matchPattern(train,stops,route) {
    const identity=routes.get(train.routeId)
    assert(identity&&identity.agencyId===route.agencyId&&identity.line===route.line,'Unreviewed rail identity')
    const key=directedPatternKey(train)
    if(cache.has(key))return cache.get(key)
    const selected=train.calls.map(c=>stops.get(c.id))
    const coords=selected.map(s=>[Number(s.stop_lon),Number(s.stop_lat)])
    const anchors=selected.map((s,i)=>{
      const originalNumber=operatingPointNumber(s.stop_id)
      const overrides=(config.operatingPointOverrides??[]).filter(o=>o.sourceNumber===originalNumber&&(!o.routeIds||o.routeIds.includes(train.routeId)))
      assert(overrides.length<=1,'Ambiguous operating-point review')
      const override=overrides[0], number=override?.targetNumber??originalNumber, candidates=numbers.get(number)??[]
      if(candidates.length!==1)return {number,reason:candidates.length?'ambiguous-operating-point':'no-exact-operating-point'}
      const node=candidates[0],attachment=distanceMetres(coords[i],node.coordinate)
      if(override) assert.equal(node.name,override.expectedName,'Changed reviewed operating-point identity')
      return attachment>limits.stationAttachmentMetres?{number,attachment,reason:'station-attachment-too-far'}:{number,attachment,node}
    })
    const blocked=new Set(anchors.filter(a=>a.node).map(a=>a.node.id))
    const results=coords.slice(1).map((end,i)=>{
      const start=coords[i],a=anchors[i],b=anchors[i+1]
      const evidence={geometrySource:'fot',fromOperatingPoint:a.number??null,toOperatingPoint:b.number??null,stationAttachmentsMetres:[a.attachment??null,b.attachment??null]}
      const fail=reason=>({...evidence,reason:`rail-${reason}`})
      if(!a.node||!b.node)return fail(a.reason??b.reason)
      if(a.node.id===b.node.id)return fail('coincident-operating-points')
      const maximum=Math.max(limits.detourFloorMetres,distanceMetres(start,end)*limits.detourRatio)
      const edges=shortest(graph,a.node.id,b.node.id,blocked,maximum)
      if(!edges?.length)return fail('disconnected-detour-or-stop-order')
      const path=[start,...edges.flatMap(e=>e.points),end].filter((p,j,all)=>j===0||j===all.length-1||distanceMetres(all[j-1],p)>.01)
      const pathMetres=length(path)
      if(pathMetres>maximum)return fail('detour-with-station-attachments')
      return {...evidence,path,pathMetres,maximumTopologyAttachmentMetres:Math.max(...edges.map(e=>e.attachment)),directedSourceSegments:edges.map(e=>({id:e.id,from:e.from,to:e.to}))}
    })
    cache.set(key,results);return results
  }}
}

export async function loadZugRail(config, dates) {
  const bytes=await readFile(join(config.sourceDirectory,'source.json'))
  assert.equal(sha256(bytes),config.sourceMetadataSha256,'Changed rail source metadata')
  const source=JSON.parse(bytes)
  for(const [file,hash]of Object.entries(source.files))assert.equal(sha256(await readFile(join(config.sourceDirectory,file))),hash,`Changed rail source ${file}`)
  const xml=gunzipSync(await readFile(join(config.sourceDirectory,'network.xtf.gz')))
  assert.equal(sha256(xml),config.sourceSha256)
  const item=JSON.parse(await readFile(join(config.sourceDirectory,'catalogue.json')))
  assert.equal(item.assets['schienennetz_2056_de.xtf']['file:checksum'],`1220${sha256(xml)}`)
  const network=parseZugRail(xml.toString(),config.limits.simplificationMetres)
  assert.equal(network.nodes.size,source.nodes);assert.equal(network.segments.length,source.segments)
  return {...zugRailMatcher(network,config,[previousServiceDate([...dates].sort()[0]), [...dates].sort().at(-1)]),source}
}
