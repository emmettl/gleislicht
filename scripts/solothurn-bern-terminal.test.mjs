import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadSolothurnBernTerminal, solothurnBernTerminalNetwork } from './solothurn-bern-terminal.mjs'
import { parseZugRail, operatingPointNumber } from './zug-rail-geometry.mjs'
const json = p => JSON.parse(readFileSync(p))
const policy = json('data/solothurn-bern-terminal-policy.json'), config = json('data/solothurn-supplement-policy.json').rail
const context = JSON.parse(gunzipSync(readFileSync('data/solothurn-pattern-contexts.json.gz')))
const network = parseZugRail(gunzipSync(readFileSync(`${config.sourceDirectory}/network.xtf.gz`)).toString(), config.limits.simplificationMetres)
const load = () => loadSolothurnBernTerminal(config, context.snapshots.map(s => s.metadata.serviceDate))

describe('Solothurn Bern eastern terminal review', () => {
  it('retains the original station node and source bytes while restricting the terminal graph to the eastern approach', () => {
    const before = JSON.stringify([...network.nodes, network.segments])
    for (const stop of policy.stops) {
      const variant = solothurnBernTerminalNetwork(network, policy, stop)
      expect(variant.network.nodes.get(policy.node.id)).toEqual(policy.node)
      expect(variant.evidence.projection.attachmentMetres).toBeGreaterThan(30)
      expect(variant.evidence.projection.attachmentMetres).toBeLessThan(40)
      expect(variant.evidence.retainedMetres).toBeGreaterThan(400)
      expect(variant.evidence.retainedMetres).toBeLessThan(430)
      expect(variant.network.segments.filter(s => [s.start,s.end].includes(policy.node.id)).map(s=>s.id).sort()).toEqual([policy.easternApproach.id,variant.evidence.spurId].sort())
    }
    expect(JSON.stringify([...network.nodes, network.segments])).toBe(before)
    const changed = structuredClone(network); changed.segments.find(s=>s.id===policy.stationCurve.id).points[0][0] += .001
    expect(()=>solothurnBernTerminalNetwork(changed,policy,policy.stops[0])).toThrow('Changed reviewed Bern source curve')
    expect(()=>solothurnBernTerminalNetwork(network,policy,[...policy.stops[0].slice(0,4),'other'])).toThrow('Unreviewed Bern platform')
  })
  it('preserves successful paths and rejects through calls, changed identities and unknown platforms', async () => {
    const matcher = await load(), day=context.snapshots.find(d=>d.metadata.serviceDate==='2026-09-04')
    const train=day.trains.find(t=>t.routeId==='91-35-A-j26-1' && t.stops.some(([i])=>day.stops[i][4]===policy.stops[1][4]))
    const route=context.routes.find(r=>r.id===train.routeId), calls=train.stops.map(([i])=>day.stops[i]);const original=calls.slice(1).map(()=>({reason:'old-failure'}))
    const result=matcher.matchPattern(train,day.stops,route,original), terminal=result.find(r=>r.path)
    expect(terminal).toBeDefined();expect(terminal.geometrySource).toBe('fot-reviewed-bern-eastern-terminal')
    const success=original.map(()=>({path:[[1,2],[3,4]]}));expect(matcher.matchPattern(train,day.stops,route,success)).toEqual(success)
    for(const r of [{...route,id:'unknown'},{...route,agencyId:'11'},{...route,name:'IC1'},{...route,mode:'bus'}])expect(matcher.matchPattern(train,day.stops,r,original)).toBe(original)
    const bernIndex=calls.findIndex(s=>operatingPointNumber(s[4])==='8507000'), changed=structuredClone(day.stops);changed[train.stops[bernIndex][0]][0]+=.001
    expect(()=>matcher.matchPattern(train,changed,route,original)).toThrow('Changed reviewed Bern platform')
    changed[train.stops[bernIndex][0]][4]='ch:1:sloid:7000:55:999';expect(matcher.matchPattern(train,changed,route,original)).toBe(original)
    const through={...train,stops:bernIndex===0?[train.stops.at(-1),...train.stops]:[...train.stops,train.stops[0]]};expect(matcher.matchPattern(through,day.stops,route,original)).toBe(original)
  })
})
