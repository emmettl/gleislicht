import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { validateAargauFeed } from './build-aargau-study.mjs'
import { hashFile } from './inventory-aargau.mjs'
import { TICINO_DATES } from './build-ticino-region.mjs'

const json=async p=>JSON.parse(await readFile(p,'utf8'))
const zipped=async p=>JSON.parse(gunzipSync(await readFile(p)))
export async function checkTicinoRegion(directory='public/data/ticino-region') {
  const inventory=await json('data/ticino/inventory.json'),summary=await json('data/ticino-audit/summary.json')
  const roadCache=await zipped('data/ticino-road-cache.json.gz')
  const run=await zipped('data/ticino-road-evidence/routing-run.json.gz')
  assert.deepEqual(roadCache.metadata.matcher,run)
  for(const [file,key] of [['patterns.json','patternsSha256'],['matching.log','logSha256'],['shapes.txt','shapesSha256'],['trips.txt','tripsSha256'],['stop_times.txt','stopTimesSha256']]) {
    const bytes=gunzipSync(await readFile(`data/ticino-road-evidence/${file}.gz`))
    assert.equal(createHash('sha256').update(bytes).digest('hex'),run[key],`Changed matcher evidence ${file}`)
  }
  assert.equal(await hashFile(join(directory,'road-paths.json.gz')),await hashFile('data/ticino-road-cache.json.gz'))
  assert.equal(inventory.routes.length,5142)
  assert.equal(inventory.metadata.sourceRows.stopTimes,34499152)
  const candidateRoutes=inventory.routes.filter(r=>r.cantonSourceTrips)
  assert.equal(candidateRoutes.length,209)
  for(const date of TICINO_DATES) {
    const report=await zipped(`data/ticino-audit/${date}.json.gz`), raw=await zipped(`data/ticino/${date}-timetable.json.gz`)
    assert.equal(report.sourceHashes.timetable,await hashFile(`data/ticino/${date}-timetable.json.gz`))
    assert.deepEqual(new Set(report.routes.map(r=>r.routeId)),new Set(candidateRoutes.map(r=>r.routeId)))
    assert.equal(report.routes.reduce((n,r)=>n+r.candidateJourneys,0),raw.trains.length)
    assert.equal(report.patterns.reduce((n,p)=>n+p.occurrences,0),raw.trains.length)
    assert.equal(report.pairs.reduce((n,p)=>n+p.occurrences,0),report.coverage.candidateOccurrences)
    assert.equal(report.pairs.reduce((n,p)=>n+p.matched,0),report.coverage.matchedCandidateOccurrences)
    assert.equal(report.pairs.reduce((n,p)=>n+p.admittedOccurrences,0),report.coverage.admittedOccurrences)
    assert.equal(report.districts.length,8)
    assert(report.districts.every(d=>d.candidateJourneys>0&&d.admittedJourneys>0))
    const patterns=new Map(report.patterns.map(p=>[JSON.stringify([p.routeId,p.gtfsDirectionId,p.stopIds]),p]))
    const excluded=new Map(report.excludedJourneys.map(t=>[t.id,t]))
    assert.equal(excluded.size,report.excludedJourneys.length)
    const expected=raw.trains.filter(t=>{
      const p=patterns.get(JSON.stringify([t.routeId,t.directionId,t.calls.map(c=>c[0])]))
      assert(p,`Missing candidate pattern ${t.id}`)
      assert.equal(p.completeGeometry,p.segments.every(s=>s.pathIndex!==null))
      const reason=!['rail','bus'].includes(t.category)?'excluded-mode-without-reviewed-geometry':t.calls.some(c=>c.slice(3).some(v=>v==='2'||v==='3'))?'excluded-reservation-or-coordination-required':!p.completeGeometry?'excluded-incomplete-geometry':t.category==='bus'&&t.calls.slice(1).some((c,i)=>{const seconds=c[1]-t.calls[i][2];return seconds>0&&p.segments[i].pathMetres/seconds*3.6>110})?'excluded-road-timing-review':'admitted'
      if(reason==='admitted'){assert(!excluded.has(t.id));return true}
      assert.equal(excluded.get(t.id)?.reason,reason)
      return false
    })
    const base=join(directory,date), manifest=await json(join(base,'ticino-region-day-manifest.json'))
    const chunks=await Promise.all(manifest.chunks.map(async descriptor=>({descriptor,payload:await json(join(base,descriptor.path))})))
    chunks.forEach(({descriptor,payload},i)=>{
      assert.equal(descriptor.windowStart,i*7200);assert.equal(descriptor.windowEnd,(i+1)*7200)
      assert.equal(payload.windowStart,descriptor.windowStart);assert.equal(payload.windowEnd,descriptor.windowEnd)
      assert.equal(payload.trains.length,descriptor.tripCount)
    })
    const trains=[...new Map(chunks.flatMap(c=>c.payload.trains).map(t=>[t.id,t])).values()]
    assert.equal(trains.length,expected.length)
    assert.deepEqual(manifest.metadata.sourceHashes,report.sourceHashes)
    assert.equal(manifest.metadata.serviceDate,date)
    assert.equal(report.coverage.candidateJourneys,raw.trains.length)
    assert.equal(report.coverage.admittedJourneys,expected.length)
    assert.equal(report.coverage.admittedJourneys+report.coverage.excludedJourneys,raw.trains.length)
    validateAargauFeed({...manifest,trains},{...raw,trains:expected},manifest,chunks)
    for(const t of trains) {
      assert(t.pathSegments.every(Number.isInteger))
      const original=expected.find(s=>s.id===t.id)
      assert.deepEqual(t.frequency,original.frequency)
      for(let i=0;i<t.stops.length;i++){
        const [index,a,d]=t.stops[i];assert(Number.isFinite(a+d)&&a<=d)
        if(i)assert(a>=t.stops[i-1][2])
        assert.deepEqual(manifest.stops[index],raw.stops.find(s=>s[4]===original.calls[i][0]))
      }
    }
    const morning=await json(join(base,'ticino-region-morning.json'))
    assert.deepEqual(morning.metadata.sourceHashes,manifest.metadata.sourceHashes)
    assert.deepEqual(new Set(morning.trains.map(t=>t.id)),new Set(trains.filter(t=>t.end>=24300&&t.start<=31500).map(t=>t.id)))
    const day=summary.days.find(d=>d.date===date)
    assert.deepEqual(day.coverage,report.coverage)
    console.log(`${date}: ${expected.length}/${raw.trains.length} complete journeys; all candidates accounted for`)
  }
  return true
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await checkTicinoRegion(process.argv[2])
