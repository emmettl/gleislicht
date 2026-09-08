import { describe, it, expect } from 'vitest'
import { seasonalStatus, seasonalCounts } from './graubuenden-seasonal.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const train={routeId:'r',directionId:'0',calls:[{id:'a',pickupType:'0',dropOffType:'0'},{id:'b',pickupType:'0',dropOffType:'0'}]}
const id=sha256(directedPatternKey(train)).slice(0,20), baseline=new Map([[id,{admitted:true}]])
describe('Graubünden seasonal audit boundaries',()=>{
 it('labels an exact reviewed pattern only as a reuse candidate',()=>{
  expect(seasonalStatus(train,baseline)).toBe('matches-reviewed-September-pattern')
  expect(seasonalStatus(train,new Map([[id,{admitted:false}]]))).toBe('known-September-geometry-exclusion')
 })
 it('requires full route, direction, stop order and call-rule identity',()=>{
  for (const changed of [{...train,routeId:'other'},{...train,directionId:'1'},{...train,calls:[...train.calls].reverse()},{...train,calls:[{...train.calls[0],pickupType:'1'},train.calls[1]]}])
   expect(seasonalStatus(changed,baseline)).toBe('unreviewed-seasonal-pattern')
 })
 it('keeps prior arrangement outside unconditional pattern reuse',()=>{
  expect(seasonalStatus({...train,calls:[{...train.calls[0],pickupType:'2'},train.calls[1]]},baseline)).toBe('prior-arrangement-call')
 })
 it('counts headway representatives and carry-ins without confusing patterns with journeys',()=>{
  const c=seasonalCounts([{status:'unreviewed-seasonal-pattern',trips:120,headwayTrips:118,carryInTrips:3}])
  expect(c.patternCount).toBe(1);expect(c.journeys).toBe(120);expect(c.headwayJourneys).toBe(118);expect(c.carryIns).toBe(3)
  expect(Object.values(c.byStatus).reduce((a,b)=>a+b,0)).toBe(c.journeys)
 })
})
