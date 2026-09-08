import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { readJson } from './aargau-seasonal.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { aargauRailMatcher,AARGAU_RAIL_LIMITS } from './aargau-rail-geometry.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
import { witnessTemplateDigest } from './aargau-witness-rail.mjs'
export const INTERLAKEN_POLICY='data/aargau-witness-interlaken-policy.json'
const parentId='ch14uvag00139699', childId='ch14uvag00165678'
const bindings=new Map([['ch:1:sloid:7492:0:460848','7'],['ch:1:sloid:7492:0:581416','5']])
export function interlakenHierarchy(xml) {
  const nodes=new Map()
  for(const m of xml.matchAll(/<Schienennetz_LV95_V1_3\.Schienennetz\.Netzknoten TID="([^"]+)">([\s\S]*?)<\/Schienennetz_LV95_V1_3\.Schienennetz\.Netzknoten>/g)) {
    if(![parentId,childId].includes(m[1]))continue
    const text=tag=>m[2].match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1]??null
    nodes.set(m[1],{id:m[1],number:text('Nummer'),name:text('Name'),parentId:m[2].match(/<rUebergeordnet REF="([^"]+)"/)?.[1]??null,validFrom:text('BeginnGueltigkeit'),editedOn:text('BearbeitungsDatum'),dataDate:text('Stand'),sourceXml:m[0]})
  }
  const parent=nodes.get(parentId),child=nodes.get(childId)
  assert.equal(parent?.number,'8507492');assert.equal(child?.number,'8519309')
  assert.equal(child.parentId,parentId,'Missing explicit FOT station hierarchy')
  assert.equal(child.name,'Interlaken Ost [Gleis 5-8]')
  return {parent,child,platformBindings:[...bindings].map(([stopId,platform])=>({stopId,platform,parentOperatingPoint:'8507492',childOperatingPoint:'8519309'}))}
}
export function interlakenEvaluator(network,hierarchy,routes) {
  assert.equal(hierarchy.child.parentId,hierarchy.parent.id)
  assert.equal(network.nodes.get(parentId)?.number,hierarchy.parent.number)
  assert.equal(network.nodes.get(childId)?.number,hierarchy.child.number)
  const rail=aargauRailMatcher(network,{routes})
  return (train,stops)=>{
    let bound=0
    const routing=stops.map(s=>{
      if(!bindings.has(s[4]))return s
      assert.equal(s[3],bindings.get(s[4]),'Changed Interlaken platform designation')
      bound++
      // Only internal operating-point lookup uses the explicit child. Source calls, IDs and coordinates stay intact.
      return [...s.slice(0,4),hierarchy.child.number]
    })
    assert.equal(bound,1,'Expected one exact Interlaken platform in the complete pattern')
    return rail.matchPattern({...train,stops:routing.map((_,i)=>[i,0,0])},routing).map((s,i)=>{
      if(!s.path || (!bindings.has(stops[i][4])&&!bindings.has(stops[i+1][4])))return undefined
      return {...s,stationHierarchyBinding:{parentNodeId:parentId,childNodeId:childId,parentOperatingPoint:hierarchy.parent.number,childOperatingPoint:hierarchy.child.number,gtfsStopId:bindings.has(stops[i][4])?stops[i][4]:stops[i+1][4],sourceRelation:'rUebergeordnet'}}
    })
  }
}
export function interlakenMatcher(policy,evaluate) {
  assert.equal(policy.schemaVersion,1);assert.deepEqual(policy.limits,AARGAU_RAIL_LIMITS)
  const rules=new Map(policy.patterns.map(r=>[JSON.stringify([r.agencyId,r.routeId,r.line,r.directionId,r.stops]),r]))
  const ruleFor=(t,stops)=>rules.get(JSON.stringify([t.agencyId,t.routeId,t.route,t.directionId,stops]))
  const permitted=(t,r)=>t.category==='rail'&&t.sourceServiceDate===undefined&&t.serviceOffset===undefined&&r?.templates.some(j=>j.sourceTripId===t.sourceTripId&&j.sha256===witnessTemplateDigest(t))
  return {policy,assertTemplate(t,stops){const r=ruleFor(t,stops);if(r)assert(permitted(t,r),'Unreviewed Interlaken source template')},matchPattern(t,stops){
    const r=ruleFor(t,stops);if(!permitted(t,r))return undefined
    const actual=evaluate(t,stops),output=stops.slice(1).map(()=>undefined)
    for(const expected of r.segments){
      const s=actual[expected.index];assert(s?.path,'Interlaken hierarchy no longer connects')
      const {path,...evidence}=s
      assert.equal(geometryDigest(path),expected.pathSha256,'Changed Interlaken path')
      assert.deepEqual(evidence,expected.evidence,'Changed Interlaken source evidence')
      output[expected.index]={...s,witnessInterlakenPatternId:r.id}
    }
    return output
  }}
}
export async function loadWitnessInterlaken(){
  const policy=await readJson(INTERLAKEN_POLICY)
  for(const [file,sha] of Object.entries(policy.files))assert.equal(await hashFile(file),sha,`Changed Interlaken evidence: ${file}`)
  const xml=gunzipSync(await readFile('data/aargau-rail-sources/network.xtf.gz')).toString(),hierarchy=interlakenHierarchy(xml)
  assert.deepEqual(hierarchy,policy.hierarchy)
  const network=parseRailNetworkXtf(xml,5)
  return interlakenMatcher(policy,interlakenEvaluator(network,hierarchy,policy.routes))
}
