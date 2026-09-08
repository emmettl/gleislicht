// Compare the delivered extension with the initial committed AGIS-only study.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hashFile } from './inventory-aargau.mjs'
const baseline='9b26f15'
const before=path=>JSON.parse(execFileSync('git',['show',`${baseline}:${path}`],{encoding:'utf8',maxBuffer:64*1024*1024}))
const after=async path=>JSON.parse(await readFile(path,'utf8'))
const days=[]
for(const date of ['2026-09-04','2026-09-06']) {
 const dir=`fixtures/aargau/${date}`,name=join(dir,'aargau-region-day-manifest.json')
 const a=before(name),b=await after(name),oldTrips=new Map(),newTrips=new Map()
 assert.deepEqual(a.stops,b.stops)
 for(const c of a.chunks)for(const t of before(join(dir,c.path)).trains)oldTrips.set(t.id,t)
 for(const c of b.chunks)for(const t of (await after(join(dir,c.path))).trains)newTrips.set(t.id,t)
 assert.deepEqual(new Set(oldTrips.keys()),new Set(newTrips.keys()))
 let preserved=0,added=0
 for(const [id,t] of oldTrips) {
  const n=newTrips.get(id)
  for(const key of ['routeId','agencyId','route','category','directionId','sourceTripId','sourceServiceDate','start','end','stops','boardingRules'])assert.deepEqual(n[key],t[key],`${id}: changed ${key}`)
  for(let i=0;i<t.pathSegments.length;i++){
   const old=t.pathSegments[i],next=n.pathSegments[i]
   if(old!==null){assert(next!==null);assert.deepEqual(b.paths[next],a.paths[old],`${id}: changed admitted AGIS geometry`);preserved++}
   else if(next!==null)added++
  }
 }
 days.push({date,journeys:oldTrips.size,preservedOfficialOccurrences:preserved,addedGeometryOccurrences:added,manifestSha256:await hashFile(name)})
}
const report={schemaVersion:1,baselineCommit:execFileSync('git',['rev-parse',baseline],{encoding:'utf8'}).trim(),passed:true,method:'Every baseline journey identity, full calls, boarding rules and previously admitted AGIS path compared with current feed. Newly admitted geometry can only fill prior gaps.',days}
await writeFile('data/aargau/road-regression.json',JSON.stringify(report,null,2)+'\n')
console.log(report)
