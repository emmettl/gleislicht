import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sha256 } from './download-luzern-sources.mjs'
const json=async p=>JSON.parse(await readFile(p,'utf8'))
async function movements(directory,date) {
  const manifest=await json(join(directory,date,'st-gallen-region-day-manifest.json')), trains=new Map()
  for(const descriptor of manifest.chunks) {
    const chunk=await json(join(directory,date,descriptor.path))
    for(const train of chunk.trains) {
      const {stops,pathSegments,...rest}=train
      trains.set(train.id,{...rest,stops:stops.map(([i,a,d])=>[manifest.stops[i][4],a,d]),paths:pathSegments.map(i=>manifest.paths[i])})
    }
  }
  return trains
}
export async function checkStGallenTopologyRegression(baselineFeed,baselineAudit,output='data/st-gallen-topology-review.json',{sharedOnly=false}={}) {
  const before=await json(baselineAudit),after=await json('data/st-gallen-audit/local-report.json'),days=[]
  assert.equal(before.sourceHashes.archive,after.sourceHashes.archive)
  assert.equal(before.sourceHashes.timetable,after.sourceHashes.timetable)
  assert.equal(before.sourceHashes.catalogue,after.sourceHashes.catalogue)
  for(const day of before.days) {
    const next=after.days.find(d=>d.date===day.date),oldTrips=await movements(baselineFeed,day.date),newTrips=await movements('data/st-gallen-region/local',day.date)
    assert.equal(day.trips,next.trips)
    for(const [id,t] of oldTrips)assert.deepEqual(newTrips.get(id),t,'Previously admitted journey changed: '+id)
    const added=[...newTrips.values()].filter(t=>!oldTrips.has(t.id))
    const expected={'96-250-8-j26-1':day.date==='2026-09-04'?66:35,
      ...(!sharedOnly?{'92-321-j26-1':day.date==='2026-09-04'?74:67}:{})}
    assert(added.every(t=>Object.hasOwn(expected,t.routeId)),'Unexpected added route')
    for(const [routeId,count]of Object.entries(expected))assert.equal(added.filter(t=>t.routeId===routeId).length,count)
    assert.equal(added.length,Object.values(expected).reduce((n,c)=>n+c,0))
    const pairs=new Map(next.directedStopPairs.map(p=>[p.key,p]))
    for(const pair of day.directedStopPairs.filter(p=>p.matched))assert.equal(pairs.get(pair.key).geometrySha256,pair.geometrySha256,'Previously matched geometry changed')
    const recovered=next.directedStopPairs.filter(p=>p.geometryRepairIds?.includes('balgach-321-source-gap')&&!day.directedStopPairs.find(q=>q.key===p.key)?.matched)
    assert.equal(recovered.length,sharedOnly?0:2)
    days.push({date:day.date,beforeTrips:oldTrips.size,afterTrips:newTrips.size,addedTrips:added.length,unchangedExistingTrips:oldTrips.size,
      addedTripIdsSha256:sha256(JSON.stringify(added.map(t=>t.id).sort())),addedPatterns:next.admittedPatterns-day.admittedPatterns,
      addedTripsByRoute:expected,sharedCorridorPairs:next.sharedCorridorDirectedPairs,
      recoveredPairs:recovered.map(({key,from,to,occurrences,geometryRepairIds})=>({key,from,to,occurrences,geometryRepairIds})),
      beforePatterns:day.admittedPatterns,afterPatterns:next.admittedPatterns})
  }
  const report={schemaVersion:1,baselineCommit:sharedOnly?'7926448':'2351822',baselineSourceHashes:before.sourceHashes,sourceHashes:after.sourceHashes,
    repair:after.policy.geometryRepairs.repairs[0],days,
    sharedCorridor:after.policy.sharedCorridors.map(({approvedPairs,...c})=>({...c,approvedDirectedPairs:approvedPairs.length})),
    retainedExclusions:[
      {feature:'bus:4',line:'37',location:'Ruggell',nearestComponentGapMetres:0.9452,decision:'No existing short source-edge connection. A sub-metre gap is not by itself evidence for an authorised join.'},
      {feature:'bus:6',line:'190',location:'Speicher',nearestComponentGapMetres:10.3951,decision:'No existing short source-edge connection; retain complete-pattern exclusion.'},
      {feature:'bus:130',line:'741N',location:'Flawil/Niederwil',nearestComponentGapMetres:11.1233,decision:'No existing short source-edge connection; retain complete-pattern exclusion.'}
    ],
    validation:{passed:true,allPreviouslyAdmittedCallsAndPathsUnchanged:true,allPreviouslyMatchedPairsUnchanged:true,onlyReviewedRoutesAdded:true,redistributionApproved:false,directionCertified:false}}
  await writeFile(output,JSON.stringify(report,null,2)+'\n')
  return report
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const sharedOnly=process.argv.includes('--shared'),args=process.argv.slice(2).filter(a=>a!=='--shared')
  assert(args[0]&&args[1],'Usage: node scripts/check-st-gallen-topology-regression.mjs [--shared] BASELINE_FEED_DIRECTORY BASELINE_AUDIT_JSON')
  const r=await checkStGallenTopologyRegression(args[0],args[1],sharedOnly?'data/st-gallen-shared-corridor-review.json':undefined,{sharedOnly});console.log(JSON.stringify({passed:r.validation.passed,days:r.days},null,2))
}
