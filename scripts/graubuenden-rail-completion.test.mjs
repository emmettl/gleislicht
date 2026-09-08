import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { reviewedTerminalExtension, graubuendenRailCompletionMatcher } from './graubuenden-rail-completion.mjs'
import { parseZugRail, zugRailMatcher } from './zug-rail-geometry.mjs'
const read=p=>JSON.parse(readFileSync(p)),policy=read('data/graubuenden-policy.json'),review=read('data/graubuenden-rail-completion/policy.json')
const raw=JSON.parse(gunzipSync(readFileSync('data/graubuenden-audit/timetable.json.gz'))),stops=new Map(raw.stops.map(s=>[s.stop_id,s]))
const network=parseZugRail(gunzipSync(readFileSync('data/zug-rail-sources/network.xtf.gz')).toString(),5),config={...policy.rail,...policy.railGroups.find(g=>g.id==='standard')},dates=['2026-09-03','2026-09-06']
const primary=zugRailMatcher(network,config,dates),completion=graubuendenRailCompletionMatcher(network,config,review,stops,dates)
const bern=raw.snapshots[0].trains.find(t=>t.routeId==='91-35-A-j26-1'&&t.calls[0].id===review.bern.stop.stop_id),basel=raw.snapshots[0].trains.find(t=>t.routeId==='91-N-Y-j26-1')
const route=t=>raw.inventory.find(r=>r.routeId===t.routeId),original=t=>primary.matchPattern(t,stops,route(t))
describe('Graubünden scoped Bern and Basel completion',()=>{
 it('extends only the failed terminal pair along the original source curve without changing source calls',()=>{
  const calls=structuredClone(bern.calls),a=original(bern),b=completion.match(a,bern,route(bern))
  expect(b.every(p=>p.path)).toBe(true);expect(b[0].terminalExtension.projection.metres).toBeLessThan(50)
  expect(b[0].terminalExtension.originalStationDistanceMetres).toBeGreaterThan(350)
  expect(b[0].path[0]).toEqual([Number(review.bern.stop.stop_lon),Number(review.bern.stop.stop_lat)]);expect(b.slice(1)).toEqual(a.slice(1));expect(bern.calls).toEqual(calls)
 })
 it('preserves complete primary journeys and already successful pairs',()=>{
  const b=completion.match(original(bern),bern,route(bern));expect(completion.match(b,bern,route(bern))).toBe(b)
  const a=original(basel),c=completion.match(a,basel,route(basel));a.forEach((p,i)=>{if(p.path)expect(c[i]).toBe(p)})
 })
 it('admits exactly one existing foreign-operator segment for ICE',()=>{
  const p=completion.match(original(basel),basel,route(basel));expect(p.every(p=>p.path)).toBe(true)
  expect(p.filter(p=>p.reviewedInfrastructureSegment).map(p=>p.reviewedInfrastructureSegment)).toEqual(['ch14uvag00068131'])
  expect(completion.sourceInventory.filter(s=>s.infrastructureOperator==='DICH').map(s=>s.id)).toEqual(['ch14uvag00068131'])
 })
 it('does not admit unreviewed complete patterns or another operator',()=>{
  const a=original(bern);expect(completion.match(a,{...bern,directionId:'unreviewed'},route(bern))).toBe(a)
  expect(()=>completion.match(a,bern,{...route(bern),agencyId:'9999'})).toThrow()
 })
 it('rejects changed platform coordinates, source curves, limits and infrastructure identities',()=>{
  const changed=new Map(stops);changed.set(review.bern.stop.stop_id,{...review.bern.stop,stop_lon:7.4})
  expect(()=>graubuendenRailCompletionMatcher(network,config,review,changed,dates)).toThrow('platform')
  expect(()=>reviewedTerminalExtension(network,{...review.bern,segment:{...review.bern.segment,gauge:'mm1000'}},dates)).toThrow('curve')
  expect(()=>graubuendenRailCompletionMatcher(network,{...config,limits:{...config.limits,stationAttachmentMetres:500}},review,stops,dates)).toThrow('limits')
  expect(()=>graubuendenRailCompletionMatcher(network,config,{...review,basel:{...review.basel,segment:{...review.basel.segment,infrastructureOperator:'other'}}},stops,dates)).toThrow('segment')
 })
 it('keeps strict source validity and terminal projection bounds',()=>{
  expect(()=>reviewedTerminalExtension(network,review.bern,['1900-01-01','1900-01-02'])).toThrow('dates')
  expect(()=>reviewedTerminalExtension(network,{...review.bern,snapMetres:20},dates)).toThrow('far')
 })
})
