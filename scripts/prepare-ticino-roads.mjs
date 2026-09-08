import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { prepareRoadFeed, roadPatternId } from './prepare-postbus-road-feed.mjs'
import { importRoadShapes } from './enrich-postbus-roads.mjs'
import { hashFile } from './inventory-aargau.mjs'

const arg = (n, fallback) => process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`)+1] : fallback
const input = arg('input', 'data/ticino'), output = arg('output', '/tmp/ticino-road-feed')
if (process.argv.includes('--import')) {
  const directory = arg('import'), source = JSON.parse(await readFile('data/ticino-sources/road-source.json','utf8'))
  const cache = await importRoadShapes(directory, source)
  assert.equal(cache.metadata.sourceSha256, source.sha256)
  const plan = JSON.parse(await readFile(join(directory,'patterns.json'),'utf8'))
  cache.identities = plan.metadata.identities
  cache.metadata.inputTimetableHashes = plan.metadata.inputTimetableHashes
  await writeFile('data/ticino-road-cache.json.gz', gzipSync(JSON.stringify(cache)))
  const evidence = 'data/ticino-road-evidence'
  await mkdir(evidence, {recursive:true})
  for (const name of ['patterns.json','matching.log','routing-run.json','shapes.txt','trips.txt','stop_times.txt']) {
    await writeFile(join(evidence,name+'.gz'), gzipSync(await readFile(join(directory,name))))
  }
  console.log({patterns:Object.keys(cache.patterns).length,coverage:cache.report.coverage,issues:cache.report.issues.length})
} else {
  const inventory = JSON.parse(await readFile(join(input,'inventory.json'),'utf8'))
  const stops=[], indexes=new Map(), trains=[], identities={}, inputTimetableHashes={}
  for (const date of inventory.metadata.dates) {
    const path=join(input,`${date}-timetable.json.gz`)
    inputTimetableHashes[date]=await hashFile(path)
    const raw=JSON.parse(gunzipSync(await readFile(path)))
    const sourceStops=new Map(raw.stops.map(s=>[s[4],s]))
    for (const train of raw.trains.filter(t=>t.category==='bus')) {
      const shift=-Math.floor(Math.min(0,...train.calls.flatMap(c=>c.slice(1,3)))/86400)*86400
      const indexed=train.calls.map(([id,a,d])=>{
        const stop=sourceStops.get(id), key=JSON.stringify(stop)
        if(!indexes.has(key)){indexes.set(key,stops.length);stops.push(stop)}
        return [indexes.get(key),a+shift,d+shift]
      })
      const t={...train,stops:indexed};trains.push(t)
      const key=roadPatternId(t,stops), identity={agencyId:train.agencyId,routeId:train.routeId,stopIds:train.calls.map(c=>c[0])}
      if(identities[key])assert.deepEqual(identities[key],identity)
      identities[key]=identity
    }
  }
  const metadata={sourceUrl:'https://opentransportdata.swiss',serviceDate:inventory.metadata.dates[0],serviceDates:inventory.metadata.dates,feedVersion:inventory.metadata.feed.feed_version,inputTimetableHashes,identities,
    note:'Routing-only union of complete Ticino-calling bus patterns. Exact national route IDs preserve agency separation; original agency identity is retained per pattern. Nonnegative routing times are not a passenger timetable.'}
  console.log(await prepareRoadFeed({manifest:{metadata,stops},trains,output,agency:{id:'ticino-routing',name:'Gleislicht routing union',url:'https://opentransportdata.swiss'}}))
  await copyFile('/tmp/gleislicht-pfaedle/pfaedle.cfg','data/ticino-sources/pfaedle.cfg')
}
