import assert from 'node:assert/strict'
import { distanceMetres } from './enrich-postbus-roads.mjs'
export const DETOUR_REVIEW='data/aargau-witnesses/oberentfelden-detour-review.json'
const names=new Set(['Aarauerstrasse','Binzmattweg','Suhrenmattstrasse','Suhrerstrasse','Dorfstrasse'])
export function taggedSeconds(metres,maxspeed){
 // Missing or non-numeric limits contribute zero, making the result optimistic.
 const speed=typeof maxspeed==='string'&&/^\d+(\.\d+)?$/.test(maxspeed)?Number(maxspeed):null
 return {taggedKmh:speed>0?speed:null,seconds:speed>0?metres/speed*3.6:0}
}
export function detourGraph(source,closure){
 const nodes=new Map(source.elements.filter(e=>e.type==='node').map(n=>[n.id,[n.lon,n.lat]]))
 const ways=source.elements.filter(e=>e.type==='way'&&(names.has(e.tags.name)||e.id===51075679))
 const blocked=new Set(closure.nodeIds.slice(1).flatMap((n,i)=>[`${closure.nodeIds[i]}:${n}`,`${n}:${closure.nodeIds[i]}`]))
 const graph=new Map(),add=(from,to,way)=>{
  if(blocked.has(`${from}:${to}`))return
  assert(nodes.has(from)&&nodes.has(to),'Missing detour source node')
  const metres=distanceMetres(nodes.get(from),nodes.get(to)),speed=taggedSeconds(metres,way.tags.maxspeed)
  const edge={from,to,wayId:way.id,name:way.tags.name??'roundabout',metres,maxspeed:way.tags.maxspeed??null,...speed}
  if(!graph.has(from))graph.set(from,[]);graph.get(from).push(edge)
 }
 for(const way of ways){
  assert(!Object.keys(way.tags).some(k=>k.startsWith('maxspeed:')),'Unreviewed conditional or directional speed')
  const one=way.tags.oneway??(way.tags.junction==='roundabout'?'yes':'no')
  assert(['yes','1','true','-1','no','0','false'].includes(one),'Unreviewed direction tag')
  for(let i=1;i<way.nodes.length;i++){
   if(one!=='-1')add(way.nodes[i-1],way.nodes[i],way)
   if(['no','0','false','-1'].includes(one))add(way.nodes[i],way.nodes[i-1],way)
  }
 }
 return {graph,ways,nodes}
}
export function fastestTaggedPath(graph,from,to){
 assert.notEqual(from,to)
 const best=new Map([[from,0]]),previous=new Map(),pending=new Set([from]),done=new Set()
 while(pending.size){
  const node=[...pending].sort((a,b)=>best.get(a)-best.get(b)||String(a).localeCompare(String(b)))[0]
  pending.delete(node);done.add(node)
  if(node===to){
   const edges=[];let cursor=to
   while(cursor!==from){const edge=previous.get(cursor);assert(edge);edges.unshift(edge);cursor=edge.from}
   return {edges,taggedMinimumSeconds:edges.reduce((n,e)=>n+e.seconds,0),metres:edges.reduce((n,e)=>n+e.metres,0),untaggedMetres:edges.filter(e=>e.taggedKmh===null).reduce((n,e)=>n+e.metres,0)}
  }
  for(const edge of graph.get(node)??[]){
   assert(Number.isFinite(edge.seconds)&&edge.seconds>=0)
   const cost=best.get(node)+edge.seconds
   if(!done.has(edge.to)&&cost<(best.get(edge.to)??Infinity)){best.set(edge.to,cost);previous.set(edge.to,edge);pending.add(edge.to)}
  }
 }
 throw new Error('No connected directed detour corridor')
}
export function detourTimingReview(source,closure){
 const {graph,ways,nodes}=detourGraph(source,closure),north=602802312,south=266859071
 assert(ways.some(w=>w.id===47331048&&w.tags.name==='Binzmattweg'&&w.nodes.includes(north)))
 assert(ways.some(w=>w.tags.name==='Suhrerstrasse'&&w.nodes.includes(south)))
 const directions=['0','1'].map(directionId=>{
  const from=directionId==='0'?north:south,to=directionId==='0'?south:north,result=fastestTaggedPath(graph,from,to)
  assert(result.edges.some(e=>e.wayId===47331048),'Detour omitted signed Binzmattweg branch')
  assert(result.edges.some(e=>e.wayId===51075679),'Detour omitted signed Suhrenmatt roundabout')
  return {directionId,from,to,fromPoint:nodes.get(from),toPoint:nodes.get(to),...result,nodePath:[from,...result.edges.map(e=>e.to)],path:[nodes.get(from),...result.edges.map(e=>nodes.get(e.to))]}
 })
 return {sourceWays:ways,directions}
}
