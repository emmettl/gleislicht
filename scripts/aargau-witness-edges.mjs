import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { aargauRailMatcher,AARGAU_RAIL_LIMITS } from './aargau-rail-geometry.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { witnessTemplateDigest } from './aargau-witness-rail.mjs'
import { projectRailStop } from './lausanne-rail-geometry.mjs'
import { distanceMetres,sliceShape } from './enrich-postbus-roads.mjs'
import { lineIndex,matchAargauPattern,AARGAU_LIMITS } from './aargau-line-geometry.mjs'
export const EDGE_POLICY='data/aargau-witness-edge-policy.json'
export const BERN_PLATFORM='ch:1:sloid:7000:55:50'
const curveId='ch14uvag00087328',centreId='ch14uvag00088813',virtualId='aargau:witness:bern-platform-50',virtualNumber='9990050'
const lengthOf=points=>points.slice(1).reduce((n,p,i)=>n+distanceMetres(points[i],p),0)

// Split one existing source edge; keep both original endpoints and every other
// source edge. The virtual node is internal and never becomes a published stop.
export function bernPlatformSplit(network,stop) {
  assert.equal(stop[4],BERN_PLATFORM);assert.equal(stop[3],'50')
  const sourceCurve=network.segments.find(s=>s.id===curveId),centre=network.nodes.get(centreId)
  assert(sourceCurve&&centre);assert.equal(centre.number,'8507000')
  assert.equal(sourceCurve.end,centreId)
  assert(!network.nodes.has(virtualId));assert(![...network.nodes.values()].some(n=>n.number===virtualNumber))
  const start=network.nodes.get(sourceCurve.start)
  assert(distanceMetres(start.coordinate,sourceCurve.points[0])<120)
  assert(distanceMetres(centre.coordinate,sourceCurve.points.at(-1))<120)
  let distance=0
  const shape=sourceCurve.points.map((p,i)=>[...p,distance+=i?distanceMetres(sourceCurve.points[i-1],p):0])
  const projection=projectRailStop(stop,[{...sourceCurve,shape}],75)
  assert(projection,'Bern platform is outside the reviewed 75 m curve projection')
  assert(projection.distance>200&&distance-projection.distance>200,'Bern projection must split the interior station curve')
  const west=sliceShape(shape,0,projection.distance),east=sliceShape(shape,projection.distance,distance)
  const halves=[{id:curveId+':west-to-platform50',start:sourceCurve.start,end:virtualId,points:west,length:lengthOf(west)},
    {id:curveId+':platform50-to-centre',start:virtualId,end:centreId,points:east,length:lengthOf(east)}]
  const nodes=new Map(network.nodes);nodes.set(virtualId,{id:virtualId,number:virtualNumber,name:'Internal projection of Bern platform 50',coordinate:projection.point})
  return {network:{...network,nodes,segments:[...network.segments.filter(s=>s.id!==curveId),...halves]},evidence:{sourceCurve,sourceCentre:centre,sourceWestNode:start,gtfsStop:stop,projection,virtualNodeId:virtualId,virtualLookupNumber:virtualNumber,virtualNumberIsNotSourceIdentity:true,sourceOperatingPoint:'8507000',originalStationDistanceMetres:distanceMetres(stop,centre.coordinate),splitSegmentIds:halves.map(s=>s.id),method:'Interior projection onto one pinned FOT station curve; both original endpoints and all other topology preserved. Platform connector and running track remain inferred.'}}
}
export function edgeEvaluator(network,collection,routes) {
  const feature=collection.features.find(f=>f.id===364)
  assert(feature);assert.equal(feature.properties.GO_NR,'11');assert.equal(feature.properties.NR,'S41')
  const parts=lineIndex({features:[feature]}).get('11:rail:S41')
  return (train,stops)=>{
    if(train.routeId==='91-36-B-j26-1'){
      assert.deepEqual(train.activeServiceDates,['2026-04-13','2026-04-14','2026-04-15','2026-04-16'],'Unreviewed Waldshut operating dates')
      assert.equal(stops.length,2)
      const {segments,...source}=matchAargauPattern(parts,stops)
      assert(segments.every(s=>s.path),'Waldshut full directed pattern does not project')
      return segments.map(s=>({...s,geometrySource:'agis',gapSource:source,sourceCorridor:{featureId:364,sourceKey:'11:rail:S41',targetRouteId:'91-36-B-j26-1',targetLine:'S36',interpretation:'Exact April templates on the archived normal-line Waldshut–Koblenz corridor; not a historical running-track certification.'}}))
    }
    const stop=stops.find(s=>s[4]===BERN_PLATFORM);assert(stop)
    const split=bernPlatformSplit(network,stop),rail=aargauRailMatcher(split.network,{routes})
    const routing=stops.map(s=>s[4]===BERN_PLATFORM?[...s.slice(0,4),virtualNumber]:s)
    const result=rail.matchPattern({...train,stops:routing.map((_,i)=>[i,0,0])},routing)
    return result.map((s,i)=>{
      if(stops[i][4]!==BERN_PLATFORM&&stops[i+1][4]!==BERN_PLATFORM)return undefined
      assert(s.path,'Split Bern platform does not connect')
      const projectedEdges=s.directedSourceSegments.filter(e=>split.evidence.splitSegmentIds.includes(e.id))
      assert.equal(projectedEdges.length,1,'Bern approach must use exactly one side of the platform projection')
      // Fribourg arrives from the west; the other four calls use the station-centre side.
      const fromWest=stops[i][4]==='ch:1:sloid:4100:2:2'
      assert.equal(projectedEdges[0].id,split.evidence.splitSegmentIds[fromWest?0:1])
      if(fromWest)assert(!s.directedSourceSegments.some(e=>e.from===centreId||e.to===centreId),'Western arrival must not double back through station centre')
      return {...s,fromOperatingPoint:s.fromOperatingPoint===virtualNumber?'8507000':s.fromOperatingPoint,toOperatingPoint:s.toOperatingPoint===virtualNumber?'8507000':s.toOperatingPoint,platformProjection:split.evidence}
    })
  }
}
export function edgeMatcher(policy,evaluate) {
  assert.equal(policy.schemaVersion,1);assert.deepEqual(policy.railLimits,AARGAU_RAIL_LIMITS);assert.deepEqual(policy.agisLimits,AARGAU_LIMITS)
  const rules=new Map(policy.patterns.map(r=>[JSON.stringify([r.agencyId,r.routeId,r.line,r.directionId,r.stops]),r]))
  const ruleFor=(t,stops)=>rules.get(JSON.stringify([t.agencyId,t.routeId,t.route,t.directionId,stops]))
  const permitted=(t,r)=>t.category==='rail'&&t.sourceServiceDate===undefined&&t.serviceOffset===undefined&&r?.templates.some(j=>j.sourceTripId===t.sourceTripId&&j.sha256===witnessTemplateDigest(t))
  return {policy,assertTemplate(t,stops){const r=ruleFor(t,stops);if(r)assert(permitted(t,r),'Unreviewed witness edge source template')},matchPattern(t,stops){
    const r=ruleFor(t,stops);if(!permitted(t,r))return undefined
    const actual=evaluate(t,stops),output=stops.slice(1).map(()=>undefined)
    for(const expected of r.segments){
      const s=actual[expected.index];assert(s?.path,'Witness edge no longer connects')
      const {path,...evidence}=s
      assert.equal(geometryDigest(path),expected.pathSha256,'Changed witness edge path')
      assert.deepEqual(evidence,expected.evidence,'Changed witness edge source evidence')
      output[expected.index]={...s,witnessEdgePatternId:r.id}
    }
    return output
  }}
}
export async function loadWitnessEdges(){
  const policy=await readJson(EDGE_POLICY)
  for(const [file,sha] of Object.entries(policy.files))assert.equal(await hashFile(file),sha,`Changed witness edge evidence: ${file}`)
  const network=parseRailNetworkXtf(gunzipSync(await readFile('data/aargau-rail-sources/network.xtf.gz')).toString(),5)
  return edgeMatcher(policy,edgeEvaluator(network,await readGzipJson('data/aargau-sources/lines.json.gz'),policy.routes))
}
