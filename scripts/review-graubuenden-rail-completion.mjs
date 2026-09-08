import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { readJson, saveJson } from './build-graubuenden-region.mjs'
import { loadGraubuendenGeometry } from './graubuenden-geometry.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const raw=await readJson('data/graubuenden-audit/timetable.json.gz'),policy=await readJson('data/graubuenden-policy.json')
const before=await loadGraubuendenGeometry({...policy,railCompletionReview:undefined},raw),after=await loadGraubuendenGeometry(policy,raw)
const routes=new Map(raw.inventory.map(r=>[r.routeId,r])),memo=new Map(),days=[],used=new Set();let baselPath
for(const day of raw.snapshots){
 const patterns=new Map();let originalAdmitted=0,admitted=0,unchangedCompleteJourneys=0,unchangedMatchedPairs=0
 for(const t of day.trains){
  const key=directedPatternKey(t),id=sha256(key).slice(0,20),route=routes.get(t.routeId)
  if(!memo.has(key))memo.set(key,[before.matchPattern(t,route),after.matchPattern(t,route)])
  const [a,b]=memo.get(key),conditional=t.calls.some(c=>['2','3'].includes(c.pickupType)||['2','3'].includes(c.dropOffType))
  const oldOk=a.every(p=>p.path)&&!conditional,ok=b.every(p=>p.path)&&!conditional
  originalAdmitted+=Number(oldOk);admitted+=Number(ok)
  if(oldOk){assert.deepEqual(a,b,'Previously complete journey changed');unchangedCompleteJourneys++}
  for(let i=0;i<a.length;i++)if(a[i].path){assert.deepEqual(a[i],b[i],'Previously successful pair changed');unchangedMatchedPairs++}
  if(!oldOk&&ok)used.add(id)
  if(route.mode!=='rail')assert.deepEqual(a,b,'Rail review changed another mode')
  if(!patterns.has(id))patterns.set(id,{id,routeId:route.routeId,agencyId:route.agencyId,line:route.line,mode:route.mode,stopIds:t.calls.map(c=>c.id),trips:0,originallyAdmitted:oldOk,admitted:ok,
   originalFailures:a.flatMap((p,i)=>p.path?[]:[{fromId:t.calls[i].id,toId:t.calls[i+1].id,...p}]),
   remainingReasons:[...new Set(b.filter(p=>!p.path).map(p=>p.reason))],newPairs:b.flatMap((p,i)=>!a[i].path&&p.path?[{fromId:t.calls[i].id,toId:t.calls[i+1].id,geometrySha256:sha256(JSON.stringify(p.path)),...Object.fromEntries(Object.entries(p).filter(([k])=>k!=='path'))}]:[])})
  patterns.get(id).trips++
  baselPath??=b.find(p=>p.geometrySource==='fot-reviewed-basel-operator')?.path
 }
 const actual=await readJson(`data/graubuenden-audit/${day.date}.json`)
 assert.equal(actual.trips,day.trains.length);assert.equal(actual.admittedTrips,admitted);assert.equal(actual.patterns.length,patterns.size)
 for(const p of actual.patterns){const x=patterns.get(p.id);assert(x);assert.equal(x.admitted,p.admitted);assert.equal(x.trips,p.trips)}
 days.push({date:day.date,candidates:day.trains.length,originalAdmitted,admitted,gained:admitted-originalAdmitted,unchangedCompleteJourneys,unchangedMatchedPairs,
  railCandidates:actual.byMode.find(m=>m.id==='rail').trips,railAdmitted:actual.byMode.find(m=>m.id==='rail').admittedTrips,
  gainedPatterns:[...patterns.values()].filter(p=>!p.originallyAdmitted&&p.admitted),remainingRailExclusions:[...patterns.values()].filter(p=>p.mode==='rail'&&!p.admitted)})
}
assert.deepEqual([...used].sort(),after.railCompletion.review.patterns.map(p=>p.id).sort(),'Policy does not account for exactly the gained patterns')
const result={sourceHashes:{policy:sha256(await readFile('data/graubuenden-policy.json')),completionPolicy:policy.railCompletionReview.policySha256,timetable:policy.timetableSha256,fot:policy.rail.sourceSha256},
 model:'Compare all modes and all candidate journeys with and without the Bern/Basel review. Every previously complete journey and every already successful pair must remain byte-identical; all new rail journeys retain the full source calls.',
 terminalExtension:after.railCompletion.extension,baselSegment:after.railCompletion.review.basel.segment,days}
await saveJson('data/graubuenden-audit/rail-completion-review.json',result)
const ext=after.railCompletion.review.bern,points=ext.segment.points,projection=result.terminalExtension.projection
const bernPath=[ext.anchor.coordinate,...points.slice(projection.edgeIndex+1).reverse(),projection.coordinate,[Number(ext.stop.stop_lon),Number(ext.stop.stop_lat)]]
const panels=[{title:'Bern · platform 50',line:bernPath,context:points,labels:[[ext.anchor.coordinate,'FOT Bern'],[[Number(ext.stop.stop_lon),Number(ext.stop.stop_lat)],'GTFS platform 50']],caption:`Source curve attachment ${projection.metres.toFixed(1)} m · original node distance 427.8 m`},
 {title:'Basel · complete ICE connection',line:baselPath,context:baselPath,labels:[[baselPath[0],'Basel Bad Bf'],[baselPath.at(-1),'Basel SBB']],caption:'Existing FOT curves · one explicitly reviewed DICH segment'}]
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;'),svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="560" viewBox="0 0 1200 560"><rect width="1200" height="560" fill="#12202d"/><style>text{font-family:Arial,sans-serif;fill:#eef4f8}.small{font-size:13px}.title{font-size:21px;font-weight:bold}</style><text x="26" y="34" class="title">Graubünden · reviewed complete-journey rail gaps</text>']
for(const [i,p]of panels.entries()){
 const all=p.context.concat(p.line),ref=all[0],sx=Math.cos(ref[1]*Math.PI/180)*111320,metre=c=>[(c[0]-ref[0])*sx,(c[1]-ref[1])*111320],xy=all.map(metre),xmin=Math.min(...xy.map(p=>p[0])),xmax=Math.max(...xy.map(p=>p[0])),ymin=Math.min(...xy.map(p=>p[1])),ymax=Math.max(...xy.map(p=>p[1])),scale=Math.min(475/(xmax-xmin),315/(ymax-ymin)),ox=52+600*i,oy=115
 const project=c=>{const[x,y]=metre(c);return[ox+(x-xmin)*scale,oy+315-(y-ymin)*scale]}
 svg.push(`<text x="${ox}" y="82" class="title">${escape(p.title)}</text><polyline points="${p.context.map(c=>project(c).join(',')).join(' ')}" fill="none" stroke="#758b9c" stroke-width="3"/><polyline points="${p.line.map(c=>project(c).join(',')).join(' ')}" fill="none" stroke="#62d6c5" stroke-width="4"/>`)
 for(const [c,label]of p.labels){const[x,y]=project(c);const right=x>ox+300;svg.push(`<circle cx="${x}" cy="${y}" r="5" fill="#ffc873"/><text x="${x+(right?-9:9)}" y="${y-12}" text-anchor="${right?'end':'start'}" class="small">${escape(label)}</text>`)}
 svg.push(`<text x="${ox}" y="478" class="small">${escape(p.caption)}</text>`)
}
svg.push('<text x="26" y="526" class="small">© FOT · timetable: SBB / opentransportdata.swiss · teal: inferred path · amber: exact stop/node · no running-track certification</text></svg>')
await writeFile('docs/assets/graubuenden-rail-completion.svg',svg.join('\n'))
console.log(JSON.stringify(days.map(({gainedPatterns:_gained,remainingRailExclusions:_remaining,...d})=>d)))
