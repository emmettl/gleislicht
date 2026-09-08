import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { readJson, saveJson } from './build-graubuenden-region.mjs'
import { loadGraubuendenGeometry } from './graubuenden-geometry.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const policy = await readJson('data/graubuenden-policy.json'), raw = await readJson('data/graubuenden-audit/timetable.json.gz')
const primary = await loadGraubuendenGeometry({ ...policy, roadAccessReview: undefined }, raw), current = await loadGraubuendenGeometry(policy, raw)
const routeIndex = new Map(raw.inventory.map(r => [r.routeId, r])), before = new Map(), after = new Map(), days = [], trial = new Map(), scopedRoutes = new Set()
const conditional = t => t.calls.some(c => ['2', '3'].includes(c.pickupType) || ['2', '3'].includes(c.dropOffType))
for (const day of raw.snapshots) {
 const patterns = new Map(); let candidates = 0, originalAdmitted = 0, admitted = 0, unchangedCompleteJourneys = 0
 for (const t of day.trains) {
  const r = routeIndex.get(t.routeId); if (r.mode !== 'bus') continue
  candidates++
  const key = directedPatternKey(t), id = sha256(key).slice(0,20)
  if (!before.has(key)) { before.set(key, primary.matchPattern(t,r)); after.set(key,current.matchPattern(t,r)) }
  const a = before.get(key), b = after.get(key), oldOk = a.every(p=>p.path) && !conditional(t), ok = b.every(p=>p.path) && !conditional(t)
  originalAdmitted += Number(oldOk); admitted += Number(ok)
  if (oldOk) { assert.deepEqual(b,a,'Previously complete bus geometry or evidence changed'); unchangedCompleteJourneys++ } else scopedRoutes.add(r.routeId)
  const roadId = a[0].roadPatternId, access = current.accessRoads.cache.patterns[roadId]
  if (access && !trial.has(roadId)) trial.set(roadId,{id:roadId,routeId:r.routeId,agencyId:r.agencyId,line:r.line,stopIds:t.calls.map(c=>c.id),
   completeTrial:access.every(i=>i!==null), admittedForRecovery:current.accessRoads.review.admittedPatternIds.includes(roadId),
   disposition:oldOk ? 'retain-primary-complete-pattern' : ok ? 'admit-complete-access-pattern' : access.every(i=>i!==null) ? 'not-approved-for-recovery' : 'exclude-incomplete-access-pattern',
   trialFailures:current.accessRoads.cache.report.issues.filter(i=>i.pattern===roadId)})
  if (!patterns.has(id)) patterns.set(id,{id,roadPatternId:roadId,routeId:r.routeId,agencyId:r.agencyId,line:r.line,stopIds:t.calls.map(c=>c.id),
   originallyAdmitted:oldOk,admitted:ok,trips:0,originalReasons:[...new Set(a.filter(p=>!p.path).map(p=>p.reason))],
   remainingReasons:[...new Set(b.filter(p=>!p.path).map(p=>p.reason))],
   completeGeometrySha256:ok?sha256(JSON.stringify(b.map(p=>p.path))):null})
  patterns.get(id).trips++
 }
 const report = await readJson(`data/graubuenden-audit/${day.date}.json`), bus = report.byMode.find(m=>m.id==='bus')
 assert.equal(bus.trips,candidates);assert.equal(bus.admittedTrips,admitted)
 for (const p of patterns.values()) {const actual=report.patterns.find(x=>x.id===p.id);assert.equal(actual.admitted,p.admitted);assert.equal(actual.trips,p.trips)}
 days.push({date:day.date,candidates,originalAdmitted,admitted,gained:admitted-originalAdmitted,unchangedCompleteJourneys,
  gainedPatterns:[...patterns.values()].filter(p=>p.admitted&&!p.originallyAdmitted),remainingExcludedPatterns:[...patterns.values()].filter(p=>!p.admitted)})
}
assert.deepEqual([...scopedRoutes].sort(),current.accessRoads.review.routes.map(r=>r.routeId).sort(),'Not every previously excluded bus route was investigated')
assert.deepEqual([...trial.keys()].sort(),Object.keys(current.accessRoads.cache.patterns).sort(),'Unaccounted trial pattern')
const gainedIds=[...new Set(days.flatMap(d=>d.gainedPatterns.map(p=>p.roadPatternId)))].sort()
assert.deepEqual(gainedIds,[...current.accessRoads.review.admittedPatternIds].sort(),'Review must admit exactly the newly recovered complete patterns')
const expectedGains=days.flatMap(d=>d.gainedPatterns.map(p=>({date:d.date,id:p.id,roadPatternId:p.roadPatternId,routeId:p.routeId,trips:p.trips,originalReasons:p.originalReasons})))
assert.deepEqual(expectedGains,current.accessRoads.review.baselineGains)
const xml=gunzipSync(await readFile('data/graubuenden-access-roads/network.osm.gz')).toString(), bounds=[Infinity,Infinity,-Infinity,-Infinity];let nodes=0,grNodes=0
for (const m of xml.matchAll(/<node\b[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"/g)) {
 const lat=Number(m[1]),lon=Number(m[2]); nodes++;bounds[0]=Math.min(bounds[0],lon);bounds[1]=Math.min(bounds[1],lat);bounds[2]=Math.max(bounds[2],lon);bounds[3]=Math.max(bounds[3],lat)
 if(lon>=9&&lon<=10.5&&lat>=46.2&&lat<=47.1)grNodes++
}
assert(nodes>0&&grNodes>0,'Graph has no demonstrated Graubünden overlap')
const rejectedSource=await readJson('data/graubuenden-access-roads/rejected-reuse/sources.json'), rejected=await readJson('data/graubuenden-access-roads/rejected-reuse/cache.json.gz')
assert.equal(sha256(await readFile('data/graubuenden-access-roads/rejected-reuse/cache.json.gz')),rejectedSource.cacheSha256)
for(const [file,hash] of Object.entries(rejectedSource.files))assert.equal(sha256(gunzipSync(await readFile(`data/graubuenden-access-roads/rejected-reuse/${file}.gz`))),hash)
assert.equal(Object.values(rejected.patterns).filter(p=>p.every(i=>i!==null)).length,0)
const review={sourceHashes:{policy:sha256(await readFile('data/graubuenden-policy.json')),timetable:policy.timetableSha256,accessPolicy:policy.roadAccessReview.policySha256,accessSource:policy.roadAccessReview.sourceSha256},
 model:'Every previously excluded bus route and every complete fixture pattern on those routes was evaluated. Original complete primary paths and evidence stay identical. Only allowlisted, entirely matched replacement patterns are admitted; never splice successful pairs between runs.',
 currentGraph:{nodeCount:nodes,bounds,graubuendenBoxNodeCount:grNodes},rejectedReuse:{...current.accessRoads.source.rejectedReuse,patterns:Object.keys(rejected.patterns).length,admitted:0},
 trialPatterns:[...trial.values()],routes:current.accessRoads.review.routes.map(r=>({...r,trialPatterns:[...trial.values()].filter(p=>p.routeId===r.routeId).length,
  days:days.map(d=>({date:d.date,gained:d.gainedPatterns.filter(p=>p.routeId===r.routeId).reduce((n,p)=>n+p.trips,0),remainingExcluded:d.remainingExcludedPatterns.filter(p=>p.routeId===r.routeId).reduce((n,p)=>n+p.trips,0)}))})),days}
await saveJson('data/graubuenden-audit/access-road-review.json',review)
console.log(JSON.stringify({trials:trial.size,completeTrials:[...trial.values()].filter(p=>p.completeTrial).length,newPatterns:gainedIds.length,graph:review.currentGraph,days:days.map(({gainedPatterns:_gained,remainingExcludedPatterns:_excluded,...d})=>d)}))
