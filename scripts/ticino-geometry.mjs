import assert from 'node:assert/strict'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export function ticinoRoadMatcher(cache) {
  assert.equal(cache.schemaVersion,1)
  assert.equal(cache.metadata.license,'ODbL-1.0')
  assert(cache.metadata.matcher.completed && cache.metadata.matcher.noTrie && cache.metadata.matcher.warnings)
  const failures=new Map(cache.report.issues.map(i=>[`${i.pattern}:${i.segment}`,i.reason]))
  return {matchPattern(train,stops) {
    if(train.category!=='bus')return undefined
    const id=roadPatternId(train,stops), identity=cache.identities[id], segments=cache.patterns[id]
    if(!segments)return undefined
    assert.equal(identity.agencyId,train.agencyId)
    assert.equal(identity.routeId,train.routeId)
    assert.deepEqual(identity.stopIds,train.stops.map(([i])=>stops[i][4]))
    assert.equal(segments.length,train.stops.length-1)
    return segments.map((index,i)=>{
      const failure=failures.get(`${id}:${i}`)
      if(failure)assert.equal(index,null,'Rejected matcher fallback cannot be admitted')
      if(index===null)return {roadFailure:failure??'unmatched-road',roadPatternId:id}
      const path=cache.paths[index], from=stops[train.stops[i][0]], to=stops[train.stops[i+1][0]]
      assert(path?.length>=2 && path.every(p=>p.length===2 && p.every(Number.isFinite)))
      assert(Math.max(distanceMetres(path[0],from),distanceMetres(path.at(-1),to))<1)
      const exact=[from.slice(0,2),...path.slice(1,-1),to.slice(0,2)]
      return {path:exact,geometrySource:'osm',roadPatternId:id,pathMetres:exact.slice(1).reduce((n,p,j)=>n+distanceMetres(exact[j],p),0)}
    })
  }}
}

export function ticinoAdmission(train, segments) {
  if(!['rail','bus'].includes(train.mode))return 'excluded-mode-without-reviewed-geometry'
  if(train.boardingRules?.some(c=>c.some(v=>v==='2'||v==='3')))return 'excluded-reservation-or-coordination-required'
  if(train.pathSegments.some(i=>i===null))return 'excluded-incomplete-geometry'
  if(train.mode==='bus' && segments && train.stops.slice(1).some((stop,i)=>{const seconds=stop[1]-train.stops[i][2];return seconds>0&&segments[i].pathMetres/seconds*3.6>110}))return 'excluded-road-timing-review'
  return 'admitted'
}
