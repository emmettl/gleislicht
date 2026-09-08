import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadSolothurnS26Review, solothurnS26Network } from './solothurn-s26-review.mjs'
import { parseZugRail } from './zug-rail-geometry.mjs'
const json = p => JSON.parse(readFileSync(p))
const config = json('data/solothurn-supplement-policy.json').rail, policy = json('data/solothurn-s26-policy.json')
const context = JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz')))
const network = parseZugRail(gunzipSync(readFileSync(`${config.sourceDirectory}/network.xtf.gz`)).toString(), config.limits.simplificationMetres)
const page = json(`${policy.sourceDirectory}/line540.json`)
const affected = context.snapshots.flatMap(day => day.trains.filter(t => t.routeId === policy.route.routeId && t.stops.some(([j],i)=>day.stops[j][4]===policy.from[4] && day.stops[t.stops[i+1]?.[0]]?.[4]===policy.to[4])).map(train=>({day,train})))
const route = context.routes.find(r=>r.id===policy.route.routeId)
describe('S26 Däniken source review', () => {
  it('adds independent SBB geometry while retaining the rejected FOT gauge record and source coordinates', () => {
    const before=JSON.stringify(network), variant=solothurnS26Network(network,page,policy)
    expect(JSON.stringify(network)).toBe(before)
    expect(variant.network.segments).toHaveLength(network.segments.length+1)
    expect(variant.network.segments.find(s=>s.id===policy.originalSegment.id).gauge).toBe('mm1000')
    expect(variant.evidence.addedSegment.points).toHaveLength(44)
    expect(variant.evidence.attachments.every(m=>m<12)).toBe(true)
    const changed=structuredClone(page);changed.results.find(r=>r.bp_anfang==='DK'&&r.bp_ende==='DKO').spurweite='M'
    expect(()=>solothurnS26Network(network,changed,policy)).toThrow('Changed SBB source curve')
    expect(()=>solothurnS26Network(network,{...page,total_count:99},policy)).toThrow('Incomplete SBB')
  })
  it('resolves both full seasonal contexts identically and keeps original identities, paths and stop-order restrictions', async () => {
    const matcher=await loadSolothurnS26Review(config,context.snapshots.map(d=>d.metadata.serviceDate)), paths=new Set()
    expect(affected.map(({day})=>day.metadata.serviceDate)).toEqual(['2026-01-16','2026-09-04'])
    for(const {day,train} of affected){const original=train.stops.slice(1).map(()=>({reason:'old-failure'})),result=matcher.matchPattern(train,day.stops,route,original),chosen=result.at(-1)
      expect(chosen.pathMetres).toBeGreaterThan(13000);expect(chosen.pathMetres).toBeLessThan(14000)
      expect(chosen.path[0]).toEqual(policy.from.slice(0,2));expect(chosen.path.at(-1)).toEqual(policy.to.slice(0,2));paths.add(JSON.stringify(chosen.path))
      expect(result.slice(0,-1)).toEqual(original.slice(0,-1))
      for(const r of [{...route,agencyId:'33'},{...route,id:'other'},{...route,name:'S29'},{...route,mode:'bus'}])expect(matcher.matchPattern(train,day.stops,r,original)).toBe(original)
      const success=original.map(()=>({path:[[1,2],[3,4]]}));expect(matcher.matchPattern(train,day.stops,route,success)).toBe(success)
      expect(matcher.matchPattern({...train,stops:[...train.stops].reverse()},day.stops,route,original)).toBe(original)
      const stops=[...day.stops,[7.978776,47.356387,'Däniken SO','1','ch:1:sloid:2111:1:1']], blocked={...train,stops:[[stops.length-1,0,0],...train.stops]}
      const failures=blocked.stops.slice(1).map(()=>({reason:'old-failure'}));expect(matcher.matchPattern(blocked,stops,route,failures)).toBe(failures)
      const changed=structuredClone(day.stops);changed[train.stops.at(-2)[0]][0]+=.001;expect(()=>matcher.matchPattern(train,changed,route,original)).toThrow()
    }
    expect(paths.size).toBe(1)
  })
})
