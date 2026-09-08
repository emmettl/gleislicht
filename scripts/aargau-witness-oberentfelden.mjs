import assert from 'node:assert/strict'
import { assertGeometryMeasurementsEqual } from './compare-geometry-measurements.mjs'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { witnessTemplateDigest } from './aargau-witness-rail.mjs'
import { avaRoadEvaluator,avaPeriod,avaTiming } from './aargau-witness-ava.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
export const OBERENTFELDEN_POLICY='data/aargau-witness-oberentfelden-policy.json'
export const CLOSURE_CLEARANCE_METRES=20
export function oberentfeldenClosure(source){
 const ways=new Map(source.elements.filter(e=>e.type==='way').map(w=>[w.id,w])),nodes=new Map(source.elements.filter(e=>e.type==='node').map(n=>[n.id,[n.lon,n.lat]]))
 const north=266859069,south=266859071,first=ways.get(48878570),last=ways.get(769045499)
 assert.equal(first.tags.name,'Aarauerstrasse');assert.equal(last.tags.name,'Aarauerstrasse')
 assert.equal(first.nodes.at(-1),last.nodes[0]);assert.equal(last.nodes.at(-1),south)
 const cut=first.nodes.indexOf(north);assert(cut>0&&cut<first.nodes.length-1)
 const northJunction=[...ways.values()].filter(w=>w.tags.name==='Isegüetlistrasse'&&w.nodes.includes(north)),southJunction=[...ways.values()].filter(w=>w.tags.name==='Suhrerstrasse'&&w.nodes.includes(south))
 assert(northJunction.length&&southJunction.length,'Missing named closure junction')
 const nodeIds=[...first.nodes.slice(cut),...last.nodes.slice(1)],points=nodeIds.map(id=>nodes.get(id));assert(points.every(Boolean))
 const lengthMetres=points.slice(1).reduce((n,p,i)=>n+distanceMetres(points[i],p),0)
 assert(lengthMetres>170&&lengthMetres<200,'Closure disagrees with approximately 180 m notice')
 return {sourceWays:[first,last],northJunctionWays:northJunction,southJunctionWays:southJunction,nodeIds,points,lengthMetres,noticeSpelling:'Isengüetlistrasse',osmSpelling:'Isegüetlistrasse',method:'Slice two exact historical OSM ways between the named junctions. Official map consulted for closure extent only; all coordinates are OSM.'}
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
function pointSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
export function minimumPolylineDistance(path,corridor){
 assert(path.length>=2&&corridor.length>=2)
 // One local metric projection for both chains. Segment intersections, including
 // collinear overlap, are checked before endpoint-to-segment distances.
 const origin=corridor[0],scale=Math.cos(origin[1]*Math.PI/180),project=p=>[(p[0]-origin[0])*Math.PI/180*6371000*scale,(p[1]-origin[1])*Math.PI/180*6371000]
 const p=path.map(project),q=corridor.map(project);let minimum=Infinity
 for(let i=1;i<p.length;i++)for(let j=1;j<q.length;j++){
  const a=p[i-1],b=p[i],c=q[j-1],d=q[j]
  const boxes=[0,1].every(k=>Math.max(Math.min(a[k],b[k]),Math.min(c[k],d[k]))<=Math.min(Math.max(a[k],b[k]),Math.max(c[k],d[k])))
  if(boxes&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return 0
  minimum=Math.min(minimum,pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b))
 }
 return minimum
}
export function oberentfeldenMatcher(policy,evaluate){
 assert.equal(policy.schemaVersion,1);assert.equal(policy.clearanceMetres,CLOSURE_CLEARANCE_METRES)
 const rules=new Map(policy.patterns.map(r=>[JSON.stringify([r.agencyId,r.routeId,r.line,r.directionId,r.stops]),r]))
 const ruleFor=(t,stops)=>rules.get(JSON.stringify([t.agencyId,t.routeId,t.route,t.directionId,stops]))
 const permitted=(t,r)=>t.category==='bus'&&t.sourceServiceDate===undefined&&t.serviceOffset===undefined&&r?.templates.some(j=>j.sourceTripId===t.sourceTripId&&j.sha256===witnessTemplateDigest(t))
 return {policy,assertTemplate(t,stops){const r=ruleFor(t,stops);if(r)assert(permitted(t,r),'Unreviewed Oberentfelden template')},matchPattern(t,stops){
  const r=ruleFor(t,stops);if(!permitted(t,r))return undefined
  assert.equal(avaPeriod(t.activeServiceDates),'september')
  const actual=evaluate(t,stops)
  return r.segments.map((expected,i)=>{
   const {path,...evidence}=actual[i];assert(path)
   assert.equal(geometryDigest(path),expected.pathSha256,'Changed Oberentfelden candidate path')
   assert.doesNotThrow(()=>assertGeometryMeasurementsEqual(evidence,expected.evidence),'Changed Oberentfelden road evidence')
   const clearance=minimumPolylineDistance(path,policy.closure.points)
   assert.equal(clearance,expected.minimumClosureDistanceMetres,'Changed closure clearance')
   if(clearance<=CLOSURE_CLEARANCE_METRES){assert.equal(expected.disposition,'hold-closed-road-crossing');return undefined}
   assert.equal(expected.disposition,'admit-clear-of-closure')
   assert(!avaTiming([t],i,evidence.pathMetres).held,'Oberentfelden source-time hold')
   return {...actual[i],witnessOberentfeldenPatternId:r.id,closureClearance:{minimumMetres:clearance,requiredMetres:CLOSURE_CLEARANCE_METRES,sourceNodeIds:policy.closure.nodeIds},sourceTimeScreen:expected.timing}
  })
 }}
}
export async function loadWitnessOberentfelden(){
 const policy=await readJson(OBERENTFELDEN_POLICY)
 for(const [file,sha]of Object.entries(policy.files))assert.equal(await hashFile(file),sha,`Changed Oberentfelden evidence: ${file}`)
 assert.deepEqual(oberentfeldenClosure(await readGzipJson('data/aargau-witness-oberentfelden-sources/osm.json.gz')),policy.closure)
 return oberentfeldenMatcher(policy,avaRoadEvaluator(await readGzipJson('data/aargau-witness-ava-sources/cache.json.gz')))
}
