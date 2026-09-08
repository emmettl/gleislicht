import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadZugRail, operatingPointNumber, zugRailMatcher } from './zug-rail-geometry.mjs'

const policy=JSON.parse(readFileSync('data/zug-policy.json'))
const route={routeId:'r',agencyId:'11',line:'S1'}
const config={limits:policy.rail.limits,routes:[route]}
const points={a:[8.50,47.17],b:[8.51,47.17],c:[8.505,47.171],d:[8.505,47.165]}
const numbers={a:'8500001',b:'8500002',c:'8500003',d:'8500004'}
const network=edges=>({nodes:new Map(Object.keys(points).map(id=>[id,{id,number:numbers[id],coordinate:points[id]}])),segments:edges.map(([start,end,gauge='mm1435'],i)=>({id:`e${i}`,start,end,gauge,points:[points[start],points[end]],validFrom:'2000-01-01',dataStand:'2021-07-06'}))})
const stops=new Map(Object.keys(points).map(id=>[id,{stop_id:numbers[id],stop_lon:points[id][0],stop_lat:points[id][1]}]))
const train=ids=>({routeId:'r',directionId:'0',calls:ids.map(id=>({id}))})
const match=(n,t=train(['a','b']))=>zugRailMatcher(n,config,policy.dates).matchPattern(t,stops,route)

describe('Zug ordered federal rail corridors',()=>{
  it('uses exact Swiss operating point IDs without name or nearest-network fallback',()=>{
    expect(operatingPointNumber('ch:1:sloid:1:0:2')).toBe('8500001')
    expect(operatingPointNumber('8500002:0:1')).toBe('8500002')
    expect(operatingPointNumber('Zug')).toBeUndefined()
    const n=network([['a','b']]);n.nodes.get('a').number='unknown'
    expect(match(n)[0].reason).toBe('rail-no-exact-operating-point')
    n.nodes.set('other',{...n.nodes.get('b'),id:'other'})
    expect(match(n,train(['b','a']))[0].reason).toBe('rail-ambiguous-operating-point')
  })
  it('reverses source geometry and refuses incompatible gauge and invented topology',()=>{
    const n=network([['a','b']]);n.segments[0].points.reverse()
    expect(match(n)[0].path[0]).toEqual(points.a)
    expect(match(n)[0].path.at(-1)).toEqual(points.b)
    expect(match(n,train(['b','a']))[0].directedSourceSegments).toEqual([{id:'e0',from:'b',to:'a'}])
    expect(match(network([['a','b','mm1000']]))[0].reason).toBe('rail-disconnected-detour-or-stop-order')
    n.segments[0].points=[[9,47],[9.1,47]]
    expect(match(n)[0].reason).toBe('rail-disconnected-detour-or-stop-order')
  })
  it('does not pass a later scheduled station early, and keys routing by the complete pattern',()=>{
    const n=network([['a','c'],['c','b'],['a','d'],['d','b']]),matcher=zugRailMatcher(n,config,policy.dates)
    const short=matcher.matchPattern(train(['a','b']),stops,route)
    const ordered=matcher.matchPattern(train(['a','b','c']),stops,route)
    expect(short[0].directedSourceSegments.map(e=>e.id)).toEqual(['e0','e1'])
    expect(ordered[0].directedSourceSegments.map(e=>e.id)).toEqual(['e2','e3'])
    expect(match(network([['a','c'],['c','b']]),train(['a','b','c']))[0].reason).toBe('rail-disconnected-detour-or-stop-order')
  })
  it('rejects changed route identity, expired source segments and distant station attachments',()=>{
    const n=network([['a','b']]);n.segments[0].validUntil='2025-01-01'
    expect(match(n)[0].reason).toBe('rail-disconnected-detour-or-stop-order')
    const matcher=zugRailMatcher(network([['a','b']]),config,policy.dates)
    expect(()=>matcher.matchPattern(train(['a','b']),stops,{...route,agencyId:'82'})).toThrow('identity')
    const far=new Map(stops);far.set('a',{...stops.get('a'),stop_lon:9})
    expect(matcher.matchPattern(train(['a','b']),far,route)[0].reason).toBe('rail-station-attachment-too-far')
  })
  it('verifies preserved checksums and retains all source dispositions',async()=>{
    const rail=await loadZugRail(policy.rail,policy.dates)
    expect(rail.sourceInventory).toHaveLength(3424)
    expect(rail.sourceInventory.filter(s=>!s.reason)).toHaveLength(1814)
    expect(new Set(rail.sourceInventory.map(s=>s.dataStand))).toEqual(new Set(['2021-07-06']))
    await expect(loadZugRail({...policy.rail,sourceSha256:'changed'},policy.dates)).rejects.toThrow()
  })
})
