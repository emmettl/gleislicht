import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { importRoadShapes, distanceMetres } from './enrich-postbus-roads.mjs'

export async function importAargauRoads(preparation, matched, source) {
  const plan=JSON.parse(await readFile(join(preparation,'preparation.json'),'utf8'))
  const agencyCaches={}
  for(const {agencyId} of plan.agencies) {
    const directory=join(matched,agencyId)
    const input=JSON.parse(await readFile(join(directory,'patterns.json'),'utf8'))
    assert.equal(input.metadata.aargauRoadAgencyId,agencyId)
    const cache=await importRoadShapes(directory,source)
    assert.equal(cache.metadata.sourceSha256,'d5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b','Review the source dates before importing a different OSM extract')
    cache.metadata.agencyId=agencyId
    cache.metadata.serviceDates=input.metadata.serviceDates
    cache.metadata.inputTimetableHashes=input.metadata.inputTimetableHashes
    cache.metadata.sourceDates={switzerland:'2026-09-02',borderRetrieved:'2026-09-08'}
    // Source patterns remain auditable independently of the short hash key.
    cache.identities=Object.fromEntries(input.patterns.map(p=>[p.id,{routeId:p.routeId,stopIds:p.stops.map(([i])=>input.stops[i][4])}]))
    agencyCaches[agencyId]=cache
  }
  return {schemaVersion:1,agencyCaches}
}

export function aargauRoadMatcher(bundle) {
  assert.equal(bundle.schemaVersion,1)
  if (bundle.supplement) {
    const base = aargauRoadMatcher({ ...bundle, supplement: undefined })
    const extra = aargauRoadMatcher(bundle.supplement)
    return { sources: [...base.sources, ...extra.sources.map(s => ({ ...s, supplemental: true }))], matchPattern(train, stops) {
      const prior = base.matchPattern(train, stops), next = extra.matchPattern(train, stops)
      if (!next) return prior
      return next.map((segment, i) => prior?.[i]?.path ? prior[i] : segment.path ? { ...segment, roadSupplement: true, ...(prior?.[i]?.roadFailure ? { priorRoadRejection: prior[i].roadFailure } : {}) } : prior?.[i] ?? segment)
    } }
  }
  const rejected=new Map(), sources=[]
  for(const [agencyId,cache] of Object.entries(bundle.agencyCaches)) {
    assert.equal(cache.schemaVersion,1);assert.equal(cache.metadata.agencyId,agencyId)
    assert.equal(cache.metadata.license,'ODbL-1.0')
    assert(cache.metadata.matcher.completed && cache.metadata.matcher.noTrie && cache.metadata.matcher.warnings)
    assert(cache.report.maxSnapMetres<=120)
    for(const issue of cache.report.issues)rejected.set(`${agencyId}:${issue.pattern}:${issue.segment}`,issue)
    sources.push({...cache.metadata,patterns:Object.keys(cache.patterns).length,paths:cache.paths.length,maximumAcceptedSnapMetres:cache.report.maxSnapMetres})
  }
  return {sources,matchPattern(train,stops){
    if(train.category!=='bus')return undefined
    const cache=bundle.agencyCaches[train.agencyId]
    if(!cache)return undefined
    const id=roadPatternId(train,stops),indices=cache.patterns[id]
    if(!indices)return undefined
    assert.equal(indices.length,train.stops.length-1)
    assert.equal(cache.identities[id].routeId,train.routeId)
    assert.deepEqual(cache.identities[id].stopIds,train.stops.map(([i])=>stops[i][4]))
    return indices.map((index,i)=>{
      const failure=rejected.get(`${train.agencyId}:${id}:${i}`)
      assert(!failure || index===null,'Rejected matcher hop must remain unshaped')
      if(index===null)return {roadFailure:failure?.reason??'unmatched-road',roadPatternId:id}
      assert(Number.isInteger(index)&&index>=0&&cache.paths[index]?.length>=2)
      const path=cache.paths[index],from=stops[train.stops[i][0]],to=stops[train.stops[i+1][0]]
      assert(path.every(p=>p.length===2&&p.every(Number.isFinite)))
      const adjustment=Math.max(distanceMetres(path[0],from),distanceMetres(path.at(-1),to))
      assert(adjustment<1,'Cached endpoints disagree with full platform identity')
      const exact=[from.slice(0,2),...path.slice(1,-1),to.slice(0,2)]
      const length=exact.slice(1).reduce((sum,p,j)=>sum+distanceMetres(exact[j],p),0)
      assert(length>=1 && distanceMetres(from,to)>0)
      return {path:exact,accepted:true,geometrySource:'osm',roadPatternId:id,pathMetres:length,endpointAdjustmentMetres:adjustment}
    })
  }}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const arg=n=>process.argv[process.argv.indexOf(`--${n}`)+1]
 for(const n of ['preparation','matched','source','output'])assert(process.argv.includes(`--${n}`),`Missing --${n}`)
 const bundle=await importAargauRoads(arg('preparation'),arg('matched'),arg('source'))
 await writeFile(arg('output'),JSON.stringify(bundle))
 console.log(Object.entries(bundle.agencyCaches).map(([id,c])=>({id,patterns:Object.keys(c.patterns).length,coverage:c.report.coverage,issues:c.report.issues.length})))
}
