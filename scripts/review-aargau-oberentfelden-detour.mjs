import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { witnessTemplateDigest } from './aargau-witness-rail.mjs'
import { loadWitnessOberentfelden } from './aargau-witness-oberentfelden.mjs'
import { DETOUR_REVIEW,detourTimingReview } from './aargau-oberentfelden-detour.mjs'
const matcher=await loadWitnessOberentfelden(),policy=matcher.policy,input=await readGzipJson('data/aargau-witnesses/source-patterns.json.gz')
const source=await readGzipJson('data/aargau-witness-oberentfelden-sources/osm.json.gz'),topology=detourTimingReview(source,policy.closure)
const patterns=policy.patterns.map(rule=>{
 const index=rule.segments.find(s=>s.disposition==='hold-closed-road-crossing').index,detour=topology.directions.find(d=>d.directionId===rule.directionId)
 const templates=rule.templates.map(j=>{
  const t=input.trains.find(t=>t.sourceTripId===j.sourceTripId);assert.equal(witnessTemplateDigest(t),j.sha256)
  matcher.assertTemplate(t,rule.stops);assert.equal(matcher.matchPattern(t,rule.stops)[index],undefined)
  const sourceSeconds=t.calls[index+1][1]-t.calls[index][2];assert.equal(sourceSeconds,120)
  assert(detour.taggedMinimumSeconds>sourceSeconds)
  return {...j,sourceSeconds,activeServiceDates:t.activeServiceDates,departure:t.calls[index][2],arrival:t.calls[index+1][1]}
 })
 return {patternId:rule.id,routeId:rule.routeId,agencyId:rule.agencyId,directionId:rule.directionId,segmentIndex:index,fromStop:rule.stops[index],toStop:rule.stops[index+1],fullStops:rule.stops,templates,heldOccurrences:templates.length,detour,sourceSeconds:120,minimumExcessSeconds:detour.taggedMinimumSeconds-120,disposition:'hold-detour-source-time-reconciliation'}
})
const files=['data/aargau-witness-oberentfelden-policy.json',...Object.keys(policy.files),'data/aargau-witnesses/oberentfelden-review-patterns.json.gz','data/aargau-witnesses/oberentfelden-review-summary.json','fixtures/aargau/2026-09-04/aargau-region-day-manifest.json','fixtures/aargau/2026-09-06/aargau-region-day-manifest.json']
const review={schemaVersion:1,checkedOn:'2026-09-09',scope:'Diagnostic only: both exact annual-template September closure crossings remain held. The signed detour corridor is screened against unchanged GTFS intervals. No path is admitted, no timetable changed and no feed expanded.',
 method:'Minimum tagged-speed time within the dated map corridor using historical OSM topology. Dijkstra minimizes time, not distance. Respect source one-way and roundabout directions; ignore turn restrictions, access restrictions, signals, acceleration, congestion and dwell. Untagged speeds cost zero. Exclude every closed road edge. Omit both stop approaches entirely: the core runs only from the Binzmattweg/Aarauerstrasse junction to the Suhrerstrasse/Aarauerstrasse junction, or its reverse. These optimistic choices cannot establish operating feasibility. No legal/current speed certification or rounding allowance is inferred.',
 limitation:'The source has minute-granularity calls. Exceeding the literal source interval requests reconciliation; it does not prove the actual service impossible. Another operator-specific itinerary, revised timetable or speed evidence would require a new scoped review. Restriction relations were not queried because this calculation deliberately relaxes those constraints and never admits geometry.',
 files:Object.fromEntries(await Promise.all([...new Set(files)].map(async f=>[f,await hashFile(f)]))),source:policy.source,sourceWays:topology.sourceWays,patterns,
 heldOccurrences:patterns.reduce((n,p)=>n+p.heldOccurrences,0),addedOccurrences:0,priorCompatibleOccurrences:8103,remainingBusOccurrences:2885,publicationReady:false}
assert.equal(review.heldOccurrences,153)
if(process.argv.includes('--check'))assert.deepEqual(await readJson(DETOUR_REVIEW),review)
else await writeFile(DETOUR_REVIEW,JSON.stringify(review,null,2)+'\n')
console.log(patterns.map(p=>({direction:p.directionId,held:p.heldOccurrences,coreMetres:p.detour.metres,taggedMinimumSeconds:p.detour.taggedMinimumSeconds,sourceSeconds:p.sourceSeconds,untaggedMetres:p.detour.untaggedMetres})))
