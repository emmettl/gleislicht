import { assertGeometryMeasurementsEqual } from './compare-geometry-measurements.mjs'
import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {applyRochersGeometry,rochersRailSource} from './rochers-geometry.mjs'
import {selectRochersRoute,auditRochersGeometry} from './build-rochers-study.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8')),snapshot=read('public/data/rochers-day.json'),source=read('data/rochers-rail-source.json'),audit=read('data/rochers-study-audit.json'),network={nodes:new Map(source.nodes.map(n=>[n.id,n])),segments:source.segments}
describe('Rochers reviewed MVR railway',()=>{
 it('selects the exact regional-type R37 source identity',()=>{
  const route={route_id:'91-37-F-j26-1',agency_id:'131',route_type:'106'}
  expect(selectRochersRoute(route)).toBe(true)
  for(const bad of [{...route,agency_id:'136'},{...route,route_type:'116'},{...route,route_id:'R37'}])expect(selectRochersRoute(bad)).toBe(false)
 })
 it('reproduces all 452 source-path slices without changing the 16 GTFS stop coordinates',()=>{
  const original=structuredClone(snapshot.stops),result=applyRochersGeometry(snapshot,network)
  expect(snapshot.stops).toEqual(original);expect(result.paths).toEqual(snapshot.paths)
  expect(auditRochersGeometry({...snapshot,...result})).toEqual(audit.geometry)
  assertGeometryMeasurementsEqual(result.alignmentReview, audit.alignmentReview)
  expect(rochersRailSource(network,source.sourceSha256)).toEqual(source)
  expect(source.sourceSha256).toBe(snapshot.metadata.sources.rail.sha256)
  expect(audit.initialGeometry.matched).toBe(304)
  for(const anchor of result.alignmentReview.stopAnchors)expect(anchor.offsetMetres).toBeLessThan(anchor.id==='ch:1:sloid:1300:3:8'?60:12)
  expect(audit.alignmentReview.stopAnchors.find(s=>s.name==='Glion-Collège').offsetMetres).toBeLessThan(4)
 })
 it('rejects missing railway, wrong terminals, moved stops and reversed call order',()=>{
  expect(()=>applyRochersGeometry(snapshot,{...network,segments:[]})).toThrow()
  const nodes=new Map(network.nodes);nodes.delete('ch14uvag00066932');expect(()=>applyRochersGeometry(snapshot,{...network,nodes})).toThrow('terminal identities')
  const moved=structuredClone(snapshot);moved.stops.find(s=>s[2]==='Glion-Collège')[0]+=.01;expect(()=>applyRochersGeometry(moved,network)).toThrow('Unreviewed Rochers stop alignment')
  const reordered=structuredClone(snapshot);[reordered.trains[0].stops[1],reordered.trains[0].stops[2]]=[reordered.trains[0].stops[2],reordered.trains[0].stops[1]];expect(()=>applyRochersGeometry(reordered,network)).toThrow('reverse along')
  const altered=structuredClone(source);altered.segments[0].points[1][0]+=.0001;expect(()=>applyRochersGeometry(snapshot,{nodes:network.nodes,segments:altered.segments})).toThrow('source railway changed')
 })
})
