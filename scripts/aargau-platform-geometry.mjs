import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { aargauRailMatcher } from './aargau-rail-geometry.mjs'
import { projectRailStop } from './lausanne-rail-geometry.mjs'
import { lineIndex, matchAargauPattern } from './aargau-line-geometry.mjs'
import { distanceMetres, sliceShape } from './enrich-postbus-roads.mjs'
const lengthOf = points => points.slice(1).reduce((sum,p,i)=>sum+distanceMetres(points[i],p),0)

// Keep relation member order and exact OSM node connectivity. A roundabout
// member is sliced between its entry and the following member's exit node.
export function orderedRelation(source) {
  const ways=source.ways, solutions=[]
  for(const reversed of [false,true]) {
    let path=reversed?[...ways[0].nodes].reverse():[...ways[0].nodes], valid=true
    const traversals=[]
    for(let i=0;i<ways.length;i++) {
      const way=ways[i], refs=way.nodes
      let part=i===0?path:undefined, reverse=i===0&&reversed
      if(i && refs[0]===refs.at(-1) && refs.includes(path.at(-1))) {
        let ring=refs.slice(0,-1)
        if(way.tags.oneway==='-1')ring.reverse()
        const start=ring.indexOf(path.at(-1)), next=ways[i+1]?.nodes
        if(!next){valid=false;break}
        const exits=[...new Set([next[0],next.at(-1)].filter(n=>ring.includes(n)))]
        if(exits.length!==1){valid=false;break}
        ring=[...ring.slice(start),...ring.slice(0,start),ring[start]]
        part=ring.slice(0,ring.findIndex((n,j)=>j>0&&n===exits[0])+1)
        reverse=way.tags.oneway==='-1'
      } else if(i && path.at(-1)===refs[0])part=refs
      else if(i && path.at(-1)===refs.at(-1)){part=[...refs].reverse();reverse=true}
      if(!part?.length || (way.tags.oneway==='yes'&&reverse) || (way.tags.oneway==='-1'&&!reverse)){valid=false;break}
      traversals.push({wayId:way.id,nodeIds:part})
      if(i)path.push(...part.slice(1))
    }
    if(valid)solutions.push({points:path.map(id=>source.nodes[id].point),traversals})
  }
  assert.equal(solutions.length,1,'OSM relation must form one unambiguous, connected directed chain')
  return solutions[0]
}

export function terminalExtension(network, segmentId, anchorId, stop) {
  const segment=network.segments.find(s=>s.id===segmentId),anchor=network.nodes.get(anchorId)
  assert(segment && anchor && [segment.start,segment.end].includes(anchorId))
  let distance=0
  const shape=segment.points.map((p,i)=>[...p,distance+=i?distanceMetres(segment.points[i-1],p):0])
  const projected=projectRailStop(stop,[{...segment,shape}],120)
  if(!projected)return undefined
  const start=network.nodes.get(segment.start),forward=distanceMetres(start.coordinate,segment.points[0])<distanceMetres(start.coordinate,segment.points.at(-1))
  const anchorAtStart=(anchorId===segment.start)===forward
  const attachmentMetres=distanceMetres(anchor.coordinate,segment.points[anchorAtStart?0:segment.points.length-1])
  if(attachmentMetres>120)return undefined
  const sliced=anchorAtStart?sliceShape(shape,0,projected.distance):sliceShape(shape,projected.distance,distance)?.reverse()
  if(!sliced)return undefined
  return {path:[anchor.coordinate,...sliced,stop.slice(0,2)],evidence:{sourceSegmentId:segmentId,anchorNodeId:anchorId,sourceStartNode:segment.start,sourceEndNode:segment.end,fromSourceDistanceMetres:anchorAtStart?0:distance,projectionDistanceMetres:projected.distance,sourceLengthMetres:distance,projectionPoint:projected.point,snapMetres:projected.snapMetres,topologyAttachmentMetres:attachmentMetres}}
}

export function aargauPlatformMatcher(policy, relation, network, railPolicy, date) {
  const chain=orderedRelation(relation)
  assert.equal(relation.relation.tags['gtfs:route_id'],'96-160-2-j26-1')
  assert.equal(relation.nodes['311095760'].tags.uic_ref,'8500575')
  const busParts=lineIndex({features:[{id:10832272,properties:{GO_NR:'801',VM_NAME:'Bus',NR:'368'},geometry:{type:'MultiLineString',coordinates:[chain.points]}}]}).get('801:bus:368')
  const rail=aargauRailMatcher(network,railPolicy)
  return { matchPattern(train,stops) {
    const approved=policy.patterns.find(p=>p.date===date && p.agencyId===train.agencyId && p.mode===train.category && p.routeId===train.routeId && p.line===train.route && p.directionId===train.directionId && JSON.stringify(p.stops)===JSON.stringify(stops))
    if(!approved)return undefined
    assert(['brugg-service-loop','bern-platform-49'].includes(approved.fix))
    const output=stops.slice(1).map(()=>undefined)
    if(approved.fix==='brugg-service-loop') {
      const {segments,...projection}=matchAargauPattern(busParts,stops)
      if(!segments.every(s=>s.path)||projection.coordinateOrder!=='forward')return undefined
      for(const i of [6,7])output[i]={...segments[i],geometrySource:'osm',platformFixId:approved.fix,relationId:relation.relation.id,relationProjection:projection}
    } else {
      const index=stops.length-1,anchorId='ch14uvag00088813'
      assert.equal(stops[index][4],'ch:1:sloid:7000:55:49')
      const extension=terminalExtension(network,'ch14uvag00087328',anchorId,stops[index])
      if(!extension)return undefined
      // Resolve the train to its exact Bern operating point, then continue on
      // the reviewed western station segment to platform 49. Published calls
      // and coordinates are never rewritten.
      const routing=stops.map(s=>[...s]);routing[index].splice(0,2,...network.nodes.get(anchorId).coordinate)
      const result=rail.matchPattern({...train,stops:routing.map((_,i)=>[i,0,0])},routing)?.[index-1]
      if(!result?.path)return undefined
      const path=[...result.path,...extension.path.slice(1)].filter((p,i,all)=>!i||p[0]!==all[i-1][0]||p[1]!==all[i-1][1])
      const pathMetres=lengthOf(path)
      if(pathMetres>Math.max(3000,4.5*distanceMetres(stops[index-1],stops[index])))return undefined
      output[index-1]={...result,path,pathMetres,stationAttachmentsMetres:[result.stationAttachmentsMetres[0],extension.evidence.snapMetres],maximumTopologyAttachmentMetres:Math.max(result.maximumTopologyAttachmentMetres,extension.evidence.topologyAttachmentMetres),platformFixId:approved.fix,terminalAttachment:extension.evidence,originalStationDistanceMetres:distanceMetres(stops[index],network.nodes.get(anchorId).coordinate)}
    }
    return output
  }, relationEvidence:{source:relation.source,traversals:chain.traversals} }
}

export async function loadAargauPlatforms(date) {
  const policy=JSON.parse(await readFile('data/aargau-platform-policy.json','utf8'))
  for(const [file,sha]of Object.entries(policy.files))assert.equal(await hashFile(file),sha)
  const relation=JSON.parse(await readFile('data/aargau-platform-sources/brugg-relation.json','utf8'))
  const network=parseRailNetworkXtf(gunzipSync(await readFile('data/aargau-rail-sources/network.xtf.gz')).toString(),5)
  const railPolicy=JSON.parse(await readFile('data/aargau-rail-policy.json','utf8'))
  return {...aargauPlatformMatcher(policy,relation,network,railPolicy,date),policy}
}
