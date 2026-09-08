import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadSolothurnDelleRail, solothurnDelleMatcher } from './solothurn-delle-rail.mjs'
const json = p => JSON.parse(readFileSync(p))
const policy = json('data/solothurn-delle-policy.json'), osm = JSON.parse(gunzipSync(readFileSync(`${policy.sourceDirectory}/osm.json.gz`)))
const context = JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz')))
const route = context.routes.find(r=>r.id===policy.route.id)
describe('Solothurn Delle border rail review', () => {
  it('replays original passenger branch ways and the exact directed border platform path', async () => {
    const before=JSON.stringify(osm), matcher=await loadSolothurnDelleRail(context)
    expect(matcher.patterns).toHaveLength(8);expect(matcher.pairs.map(p=>p.contextPatternIds.length)).toEqual([4])
    expect(matcher.pairs.map(p=>Math.round(p.pathMetres))).toEqual([1604])
    expect(matcher.pairs.flatMap(p=>p.trackAttachmentsMetres).every(m=>m<14)).toBe(true)
    for(const p of matcher.pairs){expect(p.sourceWayIds).toContain(181618272);expect(p.sourceWayIds.every(id=>matcher.inventory.find(w=>w.id===id).tags.service===undefined)).toBe(true)}
    expect(JSON.stringify(osm)).toBe(before)
    const changed=structuredClone(osm);changed.elements.find(e=>e.type==='way'&&e.id===181618272).tags.gauge='1000'
    expect(()=>solothurnDelleMatcher(changed,policy,context)).toThrow()
    expect(()=>solothurnDelleMatcher({...osm,remark:'incomplete'},policy,context)).toThrow('Incomplete')
    const wrongStation=structuredClone(osm);wrongStation.elements.find(e=>e.type==='node'&&e.id===3080770163).tags.uic_ref='8500129'
    expect(()=>solothurnDelleMatcher(wrongStation,policy,context)).toThrow()
  })
  it('requires exact route and full-pattern scope, retaining prior successes and rejecting changed calls or coordinates', async () => {
    const matcher=await loadSolothurnDelleRail(context), day=context.snapshots.find(d=>d.trains.some(t=>t.routeId===route.id&&t.stops.some(([i])=>d.stops[i][4]==='8718444')))
    const train=day.trains.find(t=>t.routeId===route.id&&t.stops.some(([i])=>day.stops[i][4]==='8718444')), old=train.stops.slice(1).map(()=>({reason:'rail-no-exact-operating-point'}))
    expect(matcher.matchPattern(train,day.stops,route,old).filter(r=>r.path)).toHaveLength(1)
    const success=old.map(()=>({path:[[1,2],[3,4]]}));expect(matcher.matchPattern(train,day.stops,route,success)).toEqual(success)
    for(const r of [{...route,id:'91-2A-Y-j26-1'},{...route,agencyId:'33'},{...route,mode:'bus'},{...route,name:'IC'}])expect(matcher.matchPattern(train,day.stops,r,old)).toBe(old)
    expect(matcher.matchPattern({...train,stops:train.stops.slice(1,-1)},day.stops,route,old)).toBe(old)
    const changed=structuredClone(day.stops);changed[train.stops[0][0]][0]+=.001
    expect(()=>matcher.matchPattern(train,changed,route,old)).toThrow('Changed Delle pattern coordinates')
    expect(()=>solothurnDelleMatcher(osm,{...policy,patternIds:policy.patternIds.slice(1)},context)).toThrow('Changed complete Delle pattern scope')
  })
})
