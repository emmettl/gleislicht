import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseZugRail, zugRailMatcher } from './zug-rail-geometry.mjs'
import { projectReviewedRailPoint } from './graubuenden-rail-anchors.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { previousServiceDate } from './civil-day.mjs'
const length = p => p.slice(1).reduce((n,b,i)=>n+distanceMetres(p[i],b),0)
const compact = p => p.filter((v,i)=>!i||distanceMetres(v,p[i-1])>.001)

export function reviewedTerminalExtension(network, review, dates) {
 const segment=network.segments.find(s=>s.id===review.segment.id),anchor=network.nodes.get(review.anchor.id)
 assert.deepEqual(segment,review.segment,'Changed reviewed station curve'); assert.deepEqual(anchor,review.anchor,'Changed terminal operating point')
 assert.equal(segment.gauge,'mm1435');assert.equal(segment.infrastructureOperator,'SBB CFF FFS')
 assert([segment.start,segment.end].includes(anchor.id),'Station curve does not attach to the exact station node')
 assert(segment.validFrom<=dates[0]&&(!segment.validUntil||segment.validUntil>=dates.at(-1)),'Station curve outside reviewed dates')
 const point=[Number(review.stop.stop_lon),Number(review.stop.stop_lat)],projection=projectReviewedRailPoint(point,segment.points)
 assert(projection.fraction>0&&projection.fraction<1,'Terminal must project to the source curve interior')
 assert(projection.metres<=review.snapMetres,'Terminal too far from reviewed curve')
 const atStart=anchor.id===segment.start,oriented=distanceMetres(network.nodes.get(segment.start).coordinate,segment.points[0])<distanceMetres(network.nodes.get(segment.start).coordinate,segment.points.at(-1))
 const endpoint=(atStart===oriented)?segment.points[0]:segment.points.at(-1),attachment=distanceMetres(anchor.coordinate,endpoint)
 assert(attachment<=review.topologyAttachmentMetres,'Station curve topology attachment too far')
 const slice=atStart===oriented?[...segment.points.slice(0,projection.edgeIndex+1),projection.coordinate]:[projection.coordinate,...segment.points.slice(projection.edgeIndex+1)].reverse()
 const path=compact([anchor.coordinate,...slice,point])
 return {path,evidence:{sourceSegmentId:segment.id,anchorNodeId:anchor.id,sourceCurveSha256:sha256(JSON.stringify(segment.points)),projection,
  sourceVertexInterval:[atStart===oriented?0:segment.points.length-1,projection.edgeIndex+projection.fraction],topologyAttachmentMetres:attachment,
  originalStationDistanceMetres:distanceMetres(point,anchor.coordinate),lengthMetres:length(path)}}
}

export function graubuendenRailCompletionMatcher(network, config, review, stops, dates) {
 assert.deepEqual(review.limits,config.limits,'Changed primary rail limits')
 const routes=new Map(review.routes.map(r=>[r.routeId,r]))
 for(const r of routes.values())assert.deepEqual(config.routes.find(x=>x.routeId===r.routeId),r,'Unreviewed route/operator identity')
 assert.deepEqual(stops.get(review.bern.stop.stop_id),review.bern.stop,'Changed Bern platform record')
 const extension=reviewedTerminalExtension(network,review.bern,dates),routingStops=new Map(stops)
 routingStops.set(review.bern.stop.stop_id,{...review.bern.stop,stop_lon:review.bern.anchor.coordinate[0],stop_lat:review.bern.anchor.coordinate[1]})
 const bern=zugRailMatcher(network,{...config,routes:review.routes.filter(r=>review.bern.routeIds.includes(r.routeId))},dates)
 const foreign=network.segments.find(s=>s.id===review.basel.segment.id)
 assert.deepEqual(foreign,review.basel.segment,'Changed Basel infrastructure segment')
 assert.equal(foreign.infrastructureOperator,'DICH');assert.equal(foreign.gauge,'mm1435')
 for(const n of review.basel.nodes)assert.deepEqual(network.nodes.get(n.id),n,'Changed Basel operating point')
 assert.deepEqual([foreign.start,foreign.end],review.basel.nodes.map(n=>n.id))
 // The foreign operator is allowed for exactly this existing segment on this one route.
 const baselNetwork={...network,segments:network.segments.filter(s=>config.infrastructureOperators.includes(s.infrastructureOperator)||s.id===foreign.id)}
 const basel=zugRailMatcher(baselNetwork,{...config,routes:review.routes.filter(r=>r.routeId===review.basel.routeId),infrastructureOperators:[...config.infrastructureOperators,'DICH']},dates)
 assert.equal(basel.sourceInventory.find(s=>s.id===foreign.id).reason,null,'Basel source segment fails primary admission checks')
 const approved=new Set(review.patterns.map(p=>p.id))
 return {extension:extension.evidence,sourceInventory:basel.sourceInventory,
  match(original,train,route) {
   if(original.every(p=>p.path))return original
   const id=sha256(directedPatternKey(train)).slice(0,20)
   if(!approved.has(id))return original
   assert.deepEqual(routes.get(route.routeId),{routeId:route.routeId,agencyId:route.agencyId,line:route.line})
   if(review.bern.routeIds.includes(route.routeId)) {
    const positions=train.calls.flatMap((c,i)=>c.id===review.bern.stop.stop_id?[i]:[])
    assert.equal(positions.length,1,'Ambiguous terminal call')
    const position=positions[0];assert(position===0||position===train.calls.length-1,'Reviewed Bern platform is not a terminal')
    const index=position===0?0:position-1
    assert.equal(original[index].reason,'rail-station-attachment-too-far','Unexpected primary terminal failure')
    const candidate=bern.matchPattern(train,routingStops,route)
    if(!candidate.every(p=>p.path))return original
    // Only the failed terminal pair changes; the entire remaining source journey is identical.
    for(let i=0;i<original.length;i++)if(i!==index)assert.deepEqual(candidate[i],original[i],'Terminal review changed another pair')
    const pair=candidate[index],path=compact(position===0?[...[...extension.path].reverse(),...pair.path.slice(1)]:[...pair.path,...extension.path.slice(1)])
    const a=stops.get(train.calls[index].id),b=stops.get(train.calls[index+1].id),direct=distanceMetres([Number(a.stop_lon),Number(a.stop_lat)],[Number(b.stop_lon),Number(b.stop_lat)])
    assert(length(path)<=Math.max(config.limits.detourFloorMetres,config.limits.detourRatio*direct),'Terminal extension exceeds primary detour limit')
    const attachments=[...pair.stationAttachmentsMetres];attachments[position===0?0:1]=extension.evidence.projection.metres
    return original.map((p,i)=>i===index?{...pair,path,pathMetres:length(path),stationAttachmentsMetres:attachments,
     maximumTopologyAttachmentMetres:Math.max(pair.maximumTopologyAttachmentMetres,extension.evidence.topologyAttachmentMetres),
     geometrySource:'fot-reviewed-terminal-platform',primaryFailure:p.reason,terminalExtension:{...extension.evidence,direction:position===0?'platform-to-station':'station-to-platform'}}:p)
   }
   assert.equal(route.routeId,review.basel.routeId)
   const candidate=basel.matchPattern(train,stops,route)
   if(!candidate.every(p=>p.path))return original
   return candidate.map((p,i)=>{
    if(original[i].path){assert.deepEqual(p,original[i],'Basel review changed an already matched pair');return original[i]}
    assert(p.directedSourceSegments.some(s=>s.id===foreign.id),'Basel recovery must traverse the reviewed segment')
    return {...p,geometrySource:'fot-reviewed-basel-operator',primaryFailure:original[i].reason,reviewedInfrastructureSegment:foreign.id}
   })
  }}
}

export async function loadGraubuendenRailCompletion(policy,raw) {
 if(!policy.railCompletionReview)return null
 const dir='data/graubuenden-rail-completion',bytes=await readFile(`${dir}/policy.json`)
 assert.equal(sha256(bytes),policy.railCompletionReview.policySha256)
 const review=JSON.parse(bytes);assert.equal(review.timetableSha256,policy.timetableSha256);assert.deepEqual(review.dates,raw.dates);assert.equal(review.fotSha256,policy.rail.sourceSha256)
 for(const [file,hash]of Object.entries(review.evidenceFiles))assert.equal(sha256(await readFile(`${dir}/${file}`)),hash,'Changed completion evidence')
 const probes=JSON.parse(await readFile(`${dir}/probes.json`))
 for(const f of probes){const b=await readFile(`${dir}/${f.file}`);assert.equal(sha256(b),f.compressedSha256);assert.equal(sha256(gunzipSync(b)),f.sha256)}
 const xml=gunzipSync(await readFile(`${policy.rail.sourceDirectory}/network.xtf.gz`));assert.equal(sha256(xml),policy.rail.sourceSha256)
 const network=parseZugRail(xml.toString(),policy.rail.limits.simplificationMetres),group=policy.railGroups.find(g=>g.id==='standard')
 const actual=new Map(raw.snapshots.flatMap(d=>d.trains).map(t=>[sha256(directedPatternKey(t)).slice(0,20),t]))
 for(const p of review.patterns){const t=actual.get(p.id);assert(t,'Reviewed pattern absent from fixtures');assert.equal(t.routeId,p.routeId);assert.deepEqual(t.calls.map(c=>c.id),p.stopIds);assert.deepEqual(t.calls.map(c=>[c.pickupType,c.dropOffType]),p.callRules)}
 return {...graubuendenRailCompletionMatcher(network,{...policy.rail,...group},review,new Map(raw.stops.map(s=>[s.stop_id,s])),[previousServiceDate(raw.dates[0]),raw.dates.at(-1)]),review}
}
