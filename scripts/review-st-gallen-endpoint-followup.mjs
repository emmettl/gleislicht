import assert from 'node:assert/strict'
import { readFile, writeFile, access } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { featureIdentity } from './st-gallen-line-geometry.mjs'
const policyPath='data/st-gallen-endpoint-followup-policy.json', output='data/st-gallen-endpoint-followup.json'
const endpointPath='data/st-gallen-endpoint-review.json'
const root='data/st-gallen-sources/local', json=async p=>JSON.parse(await readFile(p,'utf8'))
const digest=async p=>sha256(await readFile(p)), run=promisify(execFile)

// Tracked-only validation binds each retained decision to the exact current
// endpoint inventory and candidate hashes; source replay also checks PDF bytes,
// donor paths, stop checkpoints and every local feed chunk.
export function validateStGallenEndpointFollowup(report,endpoints,index,policy) {
  assert.deepEqual(report.sourceHashes,endpoints.sourceHashes)
  assert.deepEqual(report.sourceHashes,index.sourceHashes)
  assert.deepEqual(report.evidence,policy.evidence)
  assert.equal(report.reviewedOn,policy.reviewedOn)
  assert.deepEqual(report.cases.map(c=>c.routeId),policy.cases.map(c=>c.routeId))
  assert.equal(new Set(report.cases.map(c=>c.routeId)).size,report.cases.length)
  for (const c of report.cases) {
    const config=policy.cases.find(p=>p.routeId===c.routeId),route=endpoints.routes.find(r=>r.routeId===c.routeId)
    assert(route,'Reviewed route no longer has endpoint failures')
    assert.deepEqual(c.route,route); assert.equal(c.decision,config.decision)
    assert.equal(c.evidenceId,config.evidenceId); assert(policy.evidence.some(e=>e.id===c.evidenceId))
    const pairs=endpoints.pairs.filter(p=>p.routeId===c.routeId)
    assert.deepEqual(c.pairs.map(p=>p.key),pairs.map(p=>p.key))
    assert.deepEqual(config.expectedPairs,c.pairs.map(p=>({key:p.key,geometrySha256:p.candidate?.geometrySha256??null})))
    for (const p of c.pairs) {
      const original=pairs.find(v=>v.key===p.key)
      assert.equal(original.decision,'Retain complete-pattern exclusion.')
      assert.equal(p.from,original.from);assert.equal(p.to,original.to)
      assert.deepEqual(p.candidate,config.donorFeature?original.sameAgencyCandidates.find(v=>v.feature===config.donorFeature):null)
      if (!config.donorFeature) assert.equal(original.sameAgencyCandidates.length,0)
      assert.deepEqual(p.days,original.days)
    }
    if (config.scanAllOperators) {
      assert.equal(c.scannedSourceFeatures,179)
      assert.deepEqual(c.allOperatorCandidates,config.expectedAllOperatorCandidates)
      assert.deepEqual(c.allOperatorCandidates.map(p=>p.key),c.pairs.map(p=>p.key))
    }
    assert.deepEqual(c.events??[],(config.events??[]).map(event=>{
      const evidence=policy.evidence.find(e=>e.id===event.evidenceId);assert(evidence?.effectiveFrom)
      const dates=index.days.map(d=>d.date).filter(d=>d>=evidence.effectiveFrom&&(!evidence.effectiveThrough||d<=evidence.effectiveThrough))
      assert.deepEqual(dates,event.expectedFixtureDates,'Changed construction/service-change date coverage')
      return {evidenceId:event.evidenceId,from:evidence.effectiveFrom,through:evidence.effectiveThrough??null,fixtureDates:dates}
    }))
    const checkpoints=config.candidateCheckpoints
    assert.deepEqual(c.checkpoints.map(p=>({id:p.id,name:p.name})),checkpoints?.stops??[])
    for (const point of c.checkpoints) {
      assert.equal(point.pairKey,checkpoints.pairKey)
      assert(Number.isFinite(point.distanceMetres) && point.distanceMetres>=0 && point.distanceMetres<=checkpoints.maximumVertexDistanceMetres)
      assert(Number.isInteger(point.pathVertex) && point.pathVertex>=0)
      assert(point.coordinate.length===2 && point.coordinate.every(Number.isFinite))
    }
  }
  assert.deepEqual(report.feedDays,index.days.map(d=>({date:d.date,trips:d.trips,patterns:d.patterns,manifestSha256:d.manifestSha256,morningSha256:d.morningSha256})))
  assert.deepEqual(report.validation,{passed:true,feedChanged:false,admissionPolicyChanged:false,candidateGeometryAdmitted:false,directionCertified:false})
}

export async function reviewStGallenEndpointFollowup({fetchEvidence=false}={}) {
  const policy=await json(policyPath),endpoints=await json(endpointPath),audit=await json('data/st-gallen-audit/local-report.json')
  assert.deepEqual(audit.sourceHashes,endpoints.sourceHashes)
  for (const day of audit.days) assert.equal(endpoints.days.find(d=>d.date===day.date)?.dayAuditSha256,sha256(JSON.stringify(day)))
  const rawBytes=await readFile(join(root,'timetable.json'))
  assert.equal(sha256(rawBytes),endpoints.sourceHashes.timetable)
  const raw=JSON.parse(rawBytes),stops=new Map(raw.stops.map(s=>[s.stop_id,s])),xy=s=>[+s.stop_lon,+s.stop_lat]
  const catalogueBytes=await readFile(join(root,'sources.json'))
  assert.equal(sha256(catalogueBytes),endpoints.sourceHashes.catalogue)
  const catalogue=JSON.parse(catalogueBytes),collections={},admission=await json('data/st-gallen-policy.json')
  for (const layer of ['bus','city']) {
    const file=layer+'.geojson.gz',bytes=await readFile(join(root,file))
    assert.equal(sha256(bytes),catalogue.sources.find(s=>s.file===file).sha256)
    collections[layer]=JSON.parse(gunzipSync(bytes))
  }
  const allFeatures=Object.entries(collections).flatMap(([layer,c])=>c.features.map(feature=>({feature,
    identity:featureIdentity(layer,feature,admission),key:layer+':'+feature.id,graph:lineGraph([feature])})))
  assert.equal(await digest('data/st-gallen-policy.json'),endpoints.sourceHashes.policy)
  for (const e of policy.evidence) {
    const file=join(root,e.file)
    if (fetchEvidence) {
      try { await access(file) } catch { await run('curl',['-fLsS','--max-time','60',e.url,'-o',file]) }
    }
    const bytes=await readFile(file)
    assert.equal(sha256(bytes),e.sha256,'Changed operator evidence: '+e.id)
    assert.equal(bytes.length,e.bytes);assert(Number.isFinite(Date.parse(e.retrievedAt)))
  }
  const cases=[]
  for (const config of policy.cases) {
    const donor=config.donorFeature?allFeatures.find(f=>f.key===config.donorFeature):null
    if(config.donorFeature) assert(donor)
    const paths=new Map()
    const pairs=endpoints.pairs.filter(p=>p.routeId===config.routeId).map(p=>{
      const candidate=donor?p.sameAgencyCandidates.find(c=>c.feature===config.donorFeature):null
      if(donor) {
        assert(candidate);assert.equal(candidate.name,donor.feature.properties.LINIENNAME)
        const result=matchBaselSegment(donor.graph,xy(stops.get(p.fromId)),xy(stops.get(p.toId)),admission.limits)
        assert(result.path);assert.equal(sha256(JSON.stringify(result.path)),candidate.geometrySha256)
        paths.set(p.key,result.path)
      }
      return {key:p.key,from:p.from,to:p.to,candidate,days:p.days}
    })
    const extra={}
    if(config.scanAllOperators) {
      extra.scannedSourceFeatures=allFeatures.length
      extra.allOperatorCandidates=pairs.map(p=>{
        const original=endpoints.pairs.find(v=>v.key===p.key)
        const from=xy(stops.get(original.fromId)),to=xy(stops.get(original.toId))
        return {key:p.key,candidates:allFeatures.flatMap(f=>{
          const result=matchBaselSegment(f.graph,from,to,admission.limits)
          return result.path?[{feature:f.key,name:f.feature.properties.LINIENNAME,operator:f.feature.properties.BETREIBER,
            agencyIds:f.identity.agencyIds??[],geometrySha256:sha256(JSON.stringify(result.path)),
            maximumSnapMetres:result.maximumSnapMetres,pathMetres:result.pathMetres}]:[]
        })}
      })
    }
    if(config.events) extra.events=config.events.map(event=>{
      const e=policy.evidence.find(e=>e.id===event.evidenceId);assert(e?.effectiveFrom)
      return {evidenceId:e.id,from:e.effectiveFrom,through:e.effectiveThrough??null,
        fixtureDates:audit.days.map(d=>d.date).filter(d=>d>=e.effectiveFrom&&(!e.effectiveThrough||d<=e.effectiveThrough))}
    })
    const checkpoints=(config.candidateCheckpoints?.stops??[]).map(p=>{
      const stop=stops.get(p.id);assert.equal(stop?.stop_name,p.name)
      const pairKey=config.candidateCheckpoints.pairKey,path=paths.get(pairKey),coordinate=xy(stop)
      const distances=path.map(p=>distanceMetres(coordinate,p)),nearest=Math.min(...distances)
      return {...p,coordinate,pairKey,distanceMetres:nearest,pathVertex:distances.indexOf(nearest)}
    })
    cases.push({routeId:config.routeId,route:endpoints.routes.find(r=>r.routeId===config.routeId),evidenceId:config.evidenceId,pairs,checkpoints,...extra,decision:config.decision})
  }
  const feedDays=[]
  for (const d of audit.days) {
    const directory=d.artifacts.directory,manifestPath=join(directory,'st-gallen-region-day-manifest.json')
    const manifest=await json(manifestPath)
    for (const chunk of manifest.chunks) assert.equal(await digest(join(directory,chunk.path)),chunk.sha256)
    feedDays.push({date:d.date,trips:d.admittedTrips,patterns:d.admittedPatterns,
      manifestSha256:await digest(manifestPath),morningSha256:await digest(join(directory,'st-gallen-region-morning.json'))})
  }
  const report={schemaVersion:1,reviewedOn:policy.reviewedOn,sourceHashes:endpoints.sourceHashes,
    policySha256:await digest(policyPath),endpointReviewSha256:await digest(endpointPath),
    evidence:policy.evidence,cases,feedDays,
    validation:{passed:true,feedChanged:false,admissionPolicyChanged:false,candidateGeometryAdmitted:false,directionCertified:false}}
  validateStGallenEndpointFollowup(report,endpoints,{sourceHashes:audit.sourceHashes,days:feedDays},policy)
  return report
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const report=await reviewStGallenEndpointFollowup({fetchEvidence:process.argv.includes('--fetch-evidence')})
  if(process.argv.includes('--check')) assert.deepEqual(report,await json(output),'Stale endpoint follow-up')
  else await writeFile(output,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({passed:true,cases:report.cases.map(c=>({routeId:c.routeId,pairs:c.pairs.length,days:c.route.days,checkpoints:c.checkpoints})),feedChanged:false},null,2))
}
