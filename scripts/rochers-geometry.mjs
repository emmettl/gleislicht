import { createHash } from 'node:crypto'
import { applyRailGeometry } from './enrich-swiss-rail-geometry.mjs'
import { distanceMetres } from './water-paths.mjs'

// R37 uses the MVR terminal, not the SBB node sharing Montreux's GTFS root.
// Glion's source stop coordinates lie along the railway beyond the older FOT
// station nodes. Slice the continuous MVR railway at the actual dated calls.
export function applyRochersGeometry(snapshot, network) {
 const from=network.nodes.get('ch14uvag00066932'),to=network.nodes.get('ch14uvag00066490')
 if(from?.number!=='8501353' || to?.number!=='8501369')throw new Error('Rochers railway terminal identities changed')
 const template={stops:[from,to].map(n=>[...n.coordinate,n.name,'',`ch:1:sloid:${Number(n.number.slice(2))}`]),trains:[{stops:[[0,0,0],[1,3600,3600]]}],edges:[[0,1,1]]}
 let line=applyRailGeometry(template,network).paths[0]
 if(!line || line.length<2)throw new Error('Continuous MVR railway is unavailable')
 if(distanceMetres(line[0],from.coordinate)>distanceMetres(line.at(-1),from.coordinate))line=[...line].reverse()
 const sourceLineSha256=createHash('sha256').update(JSON.stringify(line)).digest('hex')
 if(sourceLineSha256!=='586dc16562cc3ae1fa0b5754f4d3d768fd77868cb52a83078e3f466697ee577d')throw new Error('Rochers source railway changed; review required')
 const anchors=snapshot.stops.map(stop=>{
  let best
  for(let i=1;i<line.length;i++){
   const a=line[i-1],b=line[i],k=Math.cos(stop[1]*Math.PI/180),dx=(b[0]-a[0])*k,dy=b[1]-a[1]
   const t=Math.max(0,Math.min(1,((stop[0]-a[0])*k*dx+(stop[1]-a[1])*dy)/(dx*dx+dy*dy || 1)))
   const point=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],offset=distanceMetres(stop,point)
   if(!best || offset<best.offset)best={point,position:i-1+t,offset}
  }
  const terminal=stop[4]==='ch:1:sloid:1300:3:8'
  if(!best || best.offset>(terminal?75:25))throw new Error(`Unreviewed Rochers stop alignment: ${stop[2]}`)
  if(terminal && best.position!==0)throw new Error('Montreux platform must bind to the MVR terminal')
  return best
 })
 const paths=[],indexes=new Map()
 const pathFor=(a,b)=>{
  const [start,end]=anchors[a].position<anchors[b].position?[anchors[a],anchors[b]]:[anchors[b],anchors[a]]
  if(end.position-start.position<1e-8)throw new Error('Rochers calls collapse to one railway position')
  const key=`${start.position}:${end.position}`
  if(indexes.has(key))return indexes.get(key)
  const path=[start.point,...line.filter((_,i)=>i>start.position && i<end.position),end.point]
  const index=paths.length;paths.push(path);indexes.set(key,index);return index
 }
 const trains=snapshot.trains.map(train=>{
  if(train.routeId!=='91-37-F-j26-1' || train.agencyId!=='131' || train.routeType!==106)throw new Error('Unreviewed Rochers route identity')
  const positions=train.stops.map(([i])=>anchors[i].position),up=positions.at(-1)>positions[0]
  if(positions.some((p,i)=>i && (up?p<=positions[i-1]:p>=positions[i-1])))throw new Error('Rochers source calls reverse along the railway')
  return {...train,pathSegments:train.stops.slice(1).map(([b],i)=>pathFor(train.stops[i][0],b))}
 })
 return {paths,trains,edgePaths:snapshot.edges.map(([a,b])=>pathFor(a,b)),alignmentReview:{sourceTerminalIds:[from.id,to.id],sourceLineSha256,sourceLinePoints:line.length,stopAnchors:snapshot.stops.map((s,i)=>({id:s[4],name:s[2],sourceCoordinate:s.slice(0,2),railCoordinate:anchors[i].point,offsetMetres:anchors[i].offset,position:anchors[i].position,maximumOffsetMetres:s[4]==='ch:1:sloid:1300:3:8'?75:25}))}}
}

export function rochersRailSource(network, sourceSha256) {
 const ids=new Set(['ch14uvag00066932']);let changed=true
 while(changed){changed=false;for(const s of network.segments)if(ids.has(s.start)!==ids.has(s.end)){ids.add(s.start);ids.add(s.end);changed=true}}
 return {source:'Federal Office of Transport railway network',sourceSha256,sourceUrl:'https://data.geo.admin.ch/ch.bav.schienennetz/',simplificationToleranceMetres:10,nodes:[...network.nodes.values()].filter(n=>ids.has(n.id)),segments:network.segments.filter(s=>ids.has(s.start)&&ids.has(s.end))}
}
