import { expect,test } from 'vitest'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { taggedSeconds,detourGraph,fastestTaggedPath,detourTimingReview,DETOUR_REVIEW } from './aargau-oberentfelden-detour.mjs'
const source=await readGzipJson('data/aargau-witness-oberentfelden-sources/osm.json.gz'),policy=await readJson('data/aargau-witness-oberentfelden-policy.json'),review=await readJson(DETOUR_REVIEW)

test('both signed directions exceed every one of the 153 unchanged two-minute source intervals',()=>{
 const result=detourTimingReview(source,policy.closure)
 expect(result.sourceWays).toEqual(review.sourceWays)
 for(const p of review.patterns){
  const d=result.directions.find(d=>d.directionId===p.directionId)
  // Compare identities, source coordinates and ordered edges exactly; only
  // derived lengths/times may differ at floating-point precision across hosts.
  const expected = p.detour
  expect(d).toEqual({ ...expected,
   metres: expect.closeTo(expected.metres, 9),
   untaggedMetres: expect.closeTo(expected.untaggedMetres, 9),
   taggedMinimumSeconds: expect.closeTo(expected.taggedMinimumSeconds, 9),
   edges: expected.edges.map(edge => ({ ...edge, metres: expect.closeTo(edge.metres, 9), seconds: expect.closeTo(edge.seconds, 9) })),
  });expect(d.taggedMinimumSeconds).toBeGreaterThan(132)
  expect(d.taggedMinimumSeconds).toBeLessThan(137)
  for(const t of p.templates){expect(t.sourceSeconds).toBe(120);expect(t.arrival-t.departure).toBe(120);expect(d.taggedMinimumSeconds).toBeGreaterThan(t.sourceSeconds)}
 }
 expect(review.patterns.reduce((n,p)=>n+p.templates.length,0)).toBe(153)
 expect(review.addedOccurrences).toBe(0)
})

test('minimum-time routing chooses a longer fast road and tolerates zero-cost edges',()=>{
 const edge=(from,to,seconds,metres)=>({from,to,seconds,metres,taggedKmh:seconds?50:null})
 const graph=new Map([[1,[edge(1,2,40,100),edge(1,3,10,200)]],[3,[edge(3,4,0,100)]],[4,[edge(4,3,0,100),edge(4,2,10,200)]]])
 const r=fastestTaggedPath(graph,1,2)
 expect(r.edges.map(e=>e.to)).toEqual([3,4,2]);expect(r.taggedMinimumSeconds).toBe(20);expect(r.metres).toBe(500);expect(r.untaggedMetres).toBe(100)
 expect(()=>fastestTaggedPath(graph,2,1)).toThrow('No connected directed detour corridor')
})

test('unknown speed tags add zero time and never become invented legal limits',()=>{
 expect(taggedSeconds(1000,'50')).toEqual({taggedKmh:50,seconds:72})
 for(const tag of [undefined,null,'','CH:urban','signals','0','-50','50 mph'])expect(taggedSeconds(1000,tag)).toEqual({taggedKmh:null,seconds:0})
})

test('closed edges are absent in both directions and all source one-way edges remain directed',()=>{
 const {graph,ways}=detourGraph(source,policy.closure)
 for(let i=1;i<policy.closure.nodeIds.length;i++){
  const a=policy.closure.nodeIds[i-1],b=policy.closure.nodeIds[i]
  expect(graph.get(a)?.some(e=>e.to===b)??false).toBe(false)
  expect(graph.get(b)?.some(e=>e.to===a)??false).toBe(false)
 }
 for(const w of ways.filter(w=>w.tags.oneway==='yes'||w.tags.junction==='roundabout'))for(let i=1;i<w.nodes.length;i++)expect(graph.get(w.nodes[i])?.some(e=>e.to===w.nodes[i-1]&&e.wayId===w.id)??false).toBe(false)
 const changed=structuredClone(source);changed.elements.find(e=>e.type==='way'&&e.id===47331048).tags.oneway='conditional'
 expect(()=>detourGraph(changed,policy.closure)).toThrow('Unreviewed direction tag')
 const speed=structuredClone(source);speed.elements.find(e=>e.type==='way'&&e.id===47331048).tags['maxspeed:forward']='50'
 expect(()=>detourGraph(speed,policy.closure)).toThrow('Unreviewed conditional or directional speed')
})

test('the tagged Binzmattweg limit materially changes the diagnostic and broken topology cannot retain it',()=>{
 const changed=structuredClone(source);delete changed.elements.find(e=>e.type==='way'&&e.id===47331048).tags.maxspeed
 for(const d of detourTimingReview(changed,policy.closure).directions)expect(d.taggedMinimumSeconds).toBeLessThan(120)
 const disconnected=structuredClone(source);disconnected.elements=disconnected.elements.filter(e=>e.type!=='way'||e.id!==47331048)
 expect(()=>detourTimingReview(disconnected,policy.closure)).toThrow()
})
