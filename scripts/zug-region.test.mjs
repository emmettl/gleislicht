import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { zugGraphs, zugLineLabels, matchZugPair, reviewedZugJoins, directedPatternKey } from './zug-line-geometry.mjs'
import { checkZugRegion } from './check-zug-region.mjs'
import { civilInstances, inCanton } from './zug-timetable.mjs'
import { compactZug, validateZugSnapshot } from './build-zug-region.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const policy = JSON.parse(readFileSync('data/zug-policy.json'))
const collection = JSON.parse(readFileSync('data/zug-sources/bus.geojson'))
const A = [8.5,47.17], B = [8.51,47.17], C = [8.51,47.18]
const feature = (id, label, coordinates) => ({ type:'Feature', properties:{id,t_id:id,liniennummer:label}, geometry:{type:'LineString',coordinates} })
const call = (id, arrival, sequence) => ({ id, arrival, departure:arrival, sequence, pickupType:'0', dropOffType:'0' })

describe('Zug source adapter and complete cantonal feed', () => {
  it('tokenizes shared segments exactly and refuses unknown or duplicate source identities', () => {
    expect(zugLineLabels('601,602,604')).toEqual(['601','602','604'])
    expect(() => zugLineLabels('601,601')).toThrow()
    expect(() => zugLineLabels('Linie 601')).toThrow()
    const c = {type:'FeatureCollection',features:[feature(1,'601,602',[A,B])]}
    const p = {...policy,topologyJoins:undefined}
    const {graphs} = zugGraphs(c,p)
    expect(graphs.has(JSON.stringify(['839','bus','601']))).toBe(true)
    expect(graphs.has(JSON.stringify(['801','bus','601']))).toBe(false)
    expect(graphs.has(JSON.stringify(['839','bus','60']))).toBe(false)
    expect(() => zugGraphs({...c,features:[...c.features,...c.features]},p)).toThrow('identity')
    expect(() => zugGraphs({type:'FeatureCollection',features:[feature(1,'999',[A,B])]},p)).toThrow('Unreviewed')
    expect(zugGraphs({type:'FeatureCollection',features:[feature(1,'528',[A,B])]},p).graphs.size).toBe(0)
  })
  it('orients full source curves without inserting a crossing or bridging an unreviewed gap', () => {
    const p = {...policy,topologyJoins:undefined}
    const graph = features => zugGraphs({type:'FeatureCollection',features},p).graphs.get(JSON.stringify(['839','bus','601']))
    const candidate = graph([feature(1,'601',[A,C,B])])
    const forward = matchZugPair(candidate,A,B,p.limits), reverse = matchZugPair(candidate,B,A,p.limits)
    expect(forward.path).toContainEqual(C)
    expect(reverse.path).toEqual([...forward.path].reverse())
    const gap = graph([feature(1,'601',[A,[8.504,47.17]]),feature(2,'601',[[8.506,47.17],B])])
    expect(matchZugPair(gap,A,B,p.limits).reason).toBe('disconnected-line')
    const crossing = graph([feature(1,'601',[A,B]),feature(2,'601',[[8.505,47.169],[8.505,47.171]])])
    expect(matchZugPair(crossing,A,[8.505,47.171],p.limits).reason).toBe('disconnected-line')
    expect(matchZugPair(candidate,[8.6,47.17],B,p.limits).reason).toBe('endpoint-gap')
  })
  it('pins each sub-metre join to source vertices and identical line memberships', () => {
    const joins = reviewedZugJoins(collection,policy)
    expect(joins).toHaveLength(3)
    expect(joins.every(j => j.metres < 1)).toBe(true)
    const moved = structuredClone(collection); moved.features[0].geometry.coordinates[0][0] += .0001
    expect(() => reviewedZugJoins(moved,policy)).toThrow('Changed topology source')
    const wrong = structuredClone(policy); wrong.topologyJoins.joins[0].lines.push('601')
    expect(() => reviewedZugJoins(collection,wrong)).toThrow('line identities')
    const long = structuredClone(policy); long.topologyJoins.joins[0].vertices[1].index = 5
    expect(() => reviewedZugJoins(collection,long)).toThrow('length')
    const disconnected = structuredClone(policy); disconnected.topologyJoins.joins[0].vertices = [{featureId:133,index:1},{featureId:133,index:2}]
    expect(() => reviewedZugJoins(collection,disconnected)).toThrow('endpoint')
  })
  it('keeps direction, repeat-stop branches, call rules and previous-day identities distinct', () => {
    const t = {routeId:'r',directionId:'0',calls:[call('a',86300,1),call('b',86500,2)]}
    const key = directedPatternKey(t)
    expect(directedPatternKey({...t,calls:[...t.calls].reverse()})).not.toBe(key)
    expect(directedPatternKey({...t,calls:[...t.calls,call('a',86600,3)]})).not.toBe(key)
    expect(directedPatternKey({...t,calls:t.calls.map(c=>({...c,pickupType:'2'}))})).not.toBe(key)
    const [instance] = civilInstances('night',t,undefined,[-86400],'2026-09-06')
    expect(instance.stops.map(c=>c.arrival)).toEqual([-100,100])
    expect(instance.metadata.sourceServiceDate).toBe('2026-09-05')
    expect(civilInstances('night',t,undefined,[0],'2026-09-06')).toHaveLength(1)
  })
  it('uses every polygon part and hole and preserves all calls in feed compaction', () => {
    const ring=(x,y,d)=>[[x,y],[x+d,y],[x+d,y+d],[x,y+d],[x,y]]
    const polygon={type:'MultiPolygon',coordinates:[[ring(0,0,10),ring(2,2,1)],[ring(20,20,1)]]}
    expect(inCanton([2.5,2.5],polygon)).toBe(false)
    expect(inCanton([20.5,20.5],polygon)).toBe(true)
    const stops=new Map([['a',{stop_lon:A[0],stop_lat:A[1],stop_name:'A'}],['b',{stop_lon:B[0],stop_lat:B[1],stop_name:'B'}]])
    const train={id:'t',category:'bus',calls:[call('a',0,4),call('b',60,9)],pathSegments:[0]}
    const snapshot=compactZug([train],stops,[[A,C,B]],{})
    expect(snapshot.trains[0].sourceCallSequences).toEqual([4,9])
    expect(()=>validateZugSnapshot(snapshot)).not.toThrow()
    expect(()=>validateZugSnapshot({...snapshot,paths:[[B,C,A]]})).toThrow()
    expect(()=>validateZugSnapshot({...snapshot,paths:[]})).toThrow()
  })
  it('replays both entire civil days, every directed pair and every emitted chunk against source hashes', async () => {
    const result=await checkZugRegion()
    expect(result).toMatchObject({passed:true,annualRoutes:77,agencies:9})
    expect(result.days.map(d=>d.admittedTrips)).toEqual([2767,1680])
    expect(result.days.map(d=>d.completeDirectedPatterns)).toEqual([273,221])
    expect(sha256(JSON.stringify(collection))).toBe(policy.topologyJoins.sourceSha256)
  }, 30000)
})
