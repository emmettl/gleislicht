import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadSolothurnSimplonRail, solothurnSimplonMatcher } from './solothurn-simplon-rail.mjs'
const json = p => JSON.parse(readFileSync(p))
const policy=json('data/solothurn-simplon-policy.json'),osm=JSON.parse(gunzipSync(readFileSync(`${policy.sourceDirectory}/osm.json.gz`))),stations=json(`${policy.sourceDirectory}/sbb-domodossola-stations.json`)
const context=JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz'))),route=context.routes.find(r=>r.id===policy.route.id)
describe('Solothurn Simplon station and corridor review',()=>{
  it('replays all eight platform paths with exact official code association and the one reviewed crossover',async()=>{
    const before=JSON.stringify(osm),m=await loadSolothurnSimplonRail(context)
    expect(m.patterns).toHaveLength(56);expect(m.pairs).toHaveLength(8);expect(m.pairs.filter(p=>p.crossoverUsed)).toHaveLength(5)
    expect(m.identityEvidence).toMatchObject({recordNumber:8501607,timetableNumber:'8301003',validFrom:'2024-12-15'})
    for(const p of m.pairs){expect(p.pathMetres).toBeGreaterThan(40600);expect(p.pathMetres).toBeLessThan(41000);expect(p.trackAttachmentsMetres.every(n=>n<34)).toBe(true)
      expect(p.path[0]).toEqual(p.from.slice(0,2).map(n=>+n.toFixed(7)));expect(p.path.at(-1)).toEqual(p.to.slice(0,2).map(n=>+n.toFixed(7)))
      const used=new Set(p.directedSourceSegments.map(s=>+s.id.split(':')[1]));expect(m.inventory.filter(w=>used.has(w.id)&&w.tags.service).every(w=>w.id===643956810)).toBe(true)
    }
    expect(JSON.stringify(osm)).toBe(before)
    const changed=structuredClone(stations);changed.results.find(r=>r.number===8501607).fotcomment='Different timetable code'
    expect(()=>solothurnSimplonMatcher(osm,changed,policy,context)).toThrow()
    const changedOsm=structuredClone(osm);changedOsm.elements.find(e=>e.type==='way'&&e.id===643956810).tags.gauge='1000'
    expect(()=>solothurnSimplonMatcher(changedOsm,stations,policy,context)).toThrow('Changed reviewed Simplon crossover')
  })
  it('rejects changed full patterns, coordinate substitutions and identities while preserving earlier paths',async()=>{
    const m=await loadSolothurnSimplonRail(context),day=context.snapshots.find(d=>d.trains.some(t=>t.routeId===route.id&&t.stops.some(([i])=>d.stops[i][4]==='8301003')))
    const train=day.trains.find(t=>t.routeId===route.id&&t.stops.some(([i])=>day.stops[i][4]==='8301003')),old=train.stops.slice(1).map(()=>({reason:'rail-no-exact-operating-point'}))
    expect(m.matchPattern(train,day.stops,route,old).filter(r=>r.path)).toHaveLength(1)
    const success=old.map(()=>({path:[[1,2],[3,4]]}));expect(m.matchPattern(train,day.stops,route,success)).toEqual(success)
    for(const r of [{...route,id:'91-29-Y-j26-1'},{...route,agencyId:'33'},{...route,mode:'bus'},{...route,name:'IC'}])expect(m.matchPattern(train,day.stops,r,old)).toBe(old)
    expect(m.matchPattern({...train,stops:train.stops.slice(1,-1)},day.stops,route,old)).toBe(old)
    const changed=structuredClone(day.stops);changed[train.stops[0][0]][0]+=.001
    expect(()=>m.matchPattern(train,changed,route,old)).toThrow('Changed Simplon calls or coordinates')
    expect(()=>solothurnSimplonMatcher(osm,stations,{...policy,patternIds:policy.patternIds.slice(1)},context)).toThrow('Changed complete Simplon scope')
  })
})
