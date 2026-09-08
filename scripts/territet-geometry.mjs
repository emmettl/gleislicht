import {createHash} from 'node:crypto'
import {distanceMetres} from './water-paths.mjs'

export function applyTerritetGeometry(snapshot, source) {
 const feature=source.results.find(f=>f.id===670),line=feature?.geometry?.coordinates
 if(feature?.properties.anlagenr!=='61.046' || feature.properties.bahntyp!=='Standseilbahn' || feature.properties.betreiber_tuabkuerzung!=='MVR' || feature.geometry.type!=='LineString' || !line)throw new Error('Unreviewed Territet funicular identity')
 const sha256=createHash('sha256').update(JSON.stringify(source)).digest('hex')
 if(sha256!==SOURCE_SHA256)throw new Error('Territet official geometry changed; review required')
 const stopIds=['ch:1:sloid:30673','ch:1:sloid:92618','ch:1:sloid:30031']
 const anchors=snapshot.stops.map(stop=>{
  if(!stopIds.includes(stop[4]))throw new Error('Unreviewed funicular stop')
  let best
  for(let i=1;i<line.length;i++){
   const a=line[i-1],b=line[i],k=Math.cos(stop[1]*Math.PI/180),dx=(b[0]-a[0])*k,dy=b[1]-a[1]
   const t=Math.max(0,Math.min(1,((stop[0]-a[0])*k*dx+(stop[1]-a[1])*dy)/(dx*dx+dy*dy)))
   const point=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],offset=distanceMetres(stop,point)
   if(!best || offset<best.offset)best={point,position:i-1+t,offset}
  }
  if(!best || best.offset>15)throw new Error('Funicular stop exceeds 15 m attachment limit')
  return best
 })
 if(anchors.length!==3 || new Set(snapshot.stops.map(s=>s[4])).size!==3)throw new Error('Expected three source stops')
 const paths=[],indexes=new Map()
 const pathFor=(a,b)=>{
  const [start,end]=anchors[a].position<anchors[b].position?[anchors[a],anchors[b]]:[anchors[b],anchors[a]]
  if(end.position<=start.position)throw new Error('Collapsed funicular segment')
  const key=`${start.position}:${end.position}`
  if(indexes.has(key))return indexes.get(key)
  const path=[start.point,...line.filter((_,i)=>i>start.position&&i<end.position),end.point],index=paths.length
  paths.push(path);indexes.set(key,index);return index
 }
 const trains=snapshot.trains.map(t=>{
  if(t.routeId!=='93-TG-j26-1'||t.agencyId!=='131'||t.routeType!==1400||t.category!=='funicular')throw new Error('Unreviewed funicular route')
  const ids=t.stops.map(([i])=>snapshot.stops[i][4])
  if(JSON.stringify(ids)!==JSON.stringify(stopIds)&&JSON.stringify(ids)!==JSON.stringify([...stopIds].reverse()))throw new Error('Changed funicular call pattern')
  return {...t,pathSegments:t.stops.slice(1).map(([b],i)=>pathFor(t.stops[i][0],b))}
 })
 return {trains,paths,edgePaths:snapshot.edges.map(([a,b])=>pathFor(a,b)),alignmentReview:{installation:'61.046',featureId:670,sourceSha256:sha256,sourcePoints:line.length,stopAnchors:snapshot.stops.map((s,i)=>({id:s[4],name:s[2],sourceCoordinate:s.slice(0,2),railCoordinate:anchors[i].point,offsetMetres:anchors[i].offset,maximumOffsetMetres:15})),model:'Official 2D installation centreline; intermediate call projected onto it. No passing-loop track assignment, cable simulation or railway XYZ.'}}
}

const SOURCE_SHA256='ff1bc767718eb91c59645473e429f8f345042344cba42e45feb09d8a9cd78e1a'
