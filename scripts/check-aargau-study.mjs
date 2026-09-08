// Offline consistency checks of the shipped canton inventory, provenance,
// complete source journeys, per-pattern evidence, coverage and feed payloads.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { validateAargauFeed } from './build-aargau-study.mjs'
import { identityKey, lineIndex } from './aargau-line-geometry.mjs'
import { aargauRoadMatcher } from './aargau-road-geometry.mjs'

const read = async path => JSON.parse(await readFile(path, 'utf8'))
const input = 'data/aargau', sourceDirectory = 'data/aargau-sources'
const inventory = await read(join(input, 'inventory.json'))
const source = await read(join(sourceDirectory, 'sources.json'))
for (const [name, file] of Object.entries(source.files)) assert.equal(await hashFile(join(sourceDirectory,name)),file.sha256,`Changed pinned source ${name}`)
assert.equal(await hashFile(join(sourceDirectory,'sources.json')),inventory.metadata.sourceCatalogueSha256)
const verification = await read(join(input,'source-verification.json'))
assert(verification.passed)
assert.equal(verification.inventorySha256,await hashFile(join(input,'inventory.json')))
assert.equal(verification.archiveSha256,inventory.metadata.archiveSha256)
assert.equal(inventory.routes.length,inventory.metadata.sourceRows.routes)
assert.equal(inventory.routes.reduce((n,r)=>n+r.totalSourceTrips,0),inventory.metadata.sourceRows.trips)
assert.equal(new Set(inventory.routes.map(r=>r.routeId)).size,inventory.routes.length)
const collection = JSON.parse(gunzipSync(await readFile(join(sourceDirectory,'lines.json.gz'))))
const crosswalk = await read('data/aargau-line-crosswalk.json')
const index = lineIndex(collection,crosswalk.mappings)
const summaries=[]
for (const date of inventory.metadata.dates) {
  const directory=join('fixtures/aargau',date)
  const manifest=await read(join(directory,'aargau-region-day-manifest.json'))
  const audit=await read(join(directory,'audit.json'))
  const raw=JSON.parse(gunzipSync(await readFile(join(input,`${date}-timetable.json.gz`))))
  const roads=manifest.metadata.geometry.roadFallback ? aargauRoadMatcher(await read('data/aargau-road-cache.json')) : undefined
  if (roads) {
    assert.equal(manifest.metadata.geometry.roadFallback.cacheSha256,await hashFile('data/aargau-road-cache.json'))
    const regression=await read(join(input,'road-regression.json'))
    assert(regression.passed)
    assert.equal(regression.days.find(day=>day.date===date)?.manifestSha256,await hashFile(join(directory,'aargau-region-day-manifest.json')))
  }
  const fixtureHash=await hashFile(join(input,`${date}-timetable.json.gz`))
  assert.equal(audit.metadata.timetableFixtureSha256,fixtureHash)
  assert.equal(verification.fixtures[`${date}-timetable.json.gz`],fixtureHash)
  assert.equal(manifest.metadata.geometry.crosswalkSha256,await hashFile('data/aargau-line-crosswalk.json'))
  const chunks=[],trains=new Map()
  for(const descriptor of manifest.chunks) {
    const bytes=await readFile(join(directory,descriptor.path))
    assert.equal(createHash('sha256').update(bytes).digest('hex'),descriptor.sha256)
    const payload=JSON.parse(bytes)
    for(const train of payload.trains){if(trains.has(train.id))assert.deepEqual(trains.get(train.id),train);trains.set(train.id,train)}
    chunks.push({descriptor,payload})
  }
  const snapshot={...manifest,trains:[...trains.values()]}
  assert.deepEqual(manifest.stops,raw.stops)
  validateAargauFeed(snapshot,raw,manifest,chunks)
  const patterns=new Map(audit.patterns.map(p=>[p.id,p])), observed=new Map(), routeCounts=new Map(), pairCounts=new Map()
  let matched=0,total=0
  for(const train of snapshot.trains) {
    const pattern=patterns.get(train.geometryPatternId);assert(pattern)
    observed.set(pattern.id,(observed.get(pattern.id)??0)+1)
    assert.equal(pattern.routeId,train.routeId);assert.equal(pattern.gtfsDirectionId,train.directionId)
    assert.deepEqual(pattern.stopIds,train.stops.map(([i])=>snapshot.stops[i][4]))
    assert.deepEqual(pattern.segments.map(s=>s.pathIndex),train.pathSegments)
    const cached=roads?.matchPattern(train,snapshot.stops)
    for(const [i,segment] of pattern.segments.entries()) if(segment.geometrySource==='osm') {
      assert(cached?.[i]?.path,'OSM segment lacks an exact complete cached pattern')
      assert.deepEqual(snapshot.paths[segment.pathIndex],cached[i].path)
      assert(segment.agisRejection,'OSM replaced an admitted AGIS segment')
    }
    const count=routeCounts.get(train.routeId)??{trips:0,matched:0,total:0};count.trips++
    train.pathSegments.forEach((path,i)=>{
      total++;count.total++
      if(path!==null){matched++;count.matched++}
      const key=JSON.stringify([train.routeId,pattern.stopIds[i],pattern.stopIds[i+1]])
      const pair=pairCounts.get(key)??{occurrences:0,matched:0};pair.occurrences++;if(path!==null)pair.matched++;pairCounts.set(key,pair)
    })
    routeCounts.set(train.routeId,count)
  }
  for(const pattern of patterns.values()) {
    assert.equal(pattern.occurrences,observed.get(pattern.id))
    assert.equal(pattern.completeGeometry,pattern.segments.every(s=>s.pathIndex!==null))
    if(pattern.source.featureId) {
      const parts=index.get(identityKey(pattern.agencyId,pattern.mode,pattern.line))
      const part=parts?.find(p=>p.featureId===pattern.source.featureId && p.part===pattern.source.part);assert(part,'Pattern used an unrelated source')
      const progress=pattern.source.stopProgressMetres.filter(p=>p!==null)
      for(let i=1;i<progress.length;i++)assert(progress[i]>=progress[i-1]-.01)
      if(pattern.source.closedLoop && progress.length)assert(progress.at(-1)-progress[0]<=part.length+.01)
      for(const s of pattern.segments.filter(s=>s.pathIndex!==null&&s.geometrySource!=='osm'))assert(s.maximumSnapMetres<=120 && s.pathMetres>=1)
    } else assert(pattern.segments.every(s=>s.pathIndex===null||s.geometrySource==='osm'))
  }
  for(const route of audit.routes)assert.deepEqual(routeCounts.get(route.routeId),{trips:route.trips,matched:route.matched,total:route.total})
  assert.equal(audit.pairs.length,pairCounts.size)
  for(const pair of audit.pairs)assert.deepEqual(pairCounts.get(JSON.stringify([pair.routeId,pair.fromId,pair.toId])),{occurrences:pair.occurrences,matched:pair.matched})
  assert.equal(audit.totals.trips,trains.size);assert.equal(audit.totals.total,total);assert.equal(audit.totals.matched,matched)
  assert.equal(audit.totals.coverage,matched/total)
  if(roads) {
    const roadCount=audit.patterns.reduce((n,p)=>n+p.occurrences*p.segments.filter(s=>s.geometrySource==='osm').length,0)
    assert.equal(roadCount,audit.totals.roadMatched)
    assert.equal(audit.totals.officialMatched+roadCount,matched)
    for(const group of audit.groups)assert.equal(group.officialMatched+group.roadMatched,group.matched)
  }
  assert.equal(audit.sourceRecords.length,collection.features.length)
  assert.equal(new Set(audit.sourceRecords.map(s=>s.featureId)).size,collection.features.length)
  assert(audit.checks.independentSourceArchiveVerification)
  const morning=await read(join(directory,'aargau-region-morning.json'))
  assert.deepEqual(new Set(morning.trains.map(t=>t.id)),new Set(snapshot.trains.filter(t=>t.start<=31500&&t.end>=24300).map(t=>t.id)))
  for(const train of morning.trains)assert.deepEqual(train,trains.get(train.id))
  assert.equal(gzipSync(JSON.stringify(manifest)).length,audit.payload.manifestGzipBytes)
  assert(audit.payload.manifestGzipBytes<=650*1024)
  assert(audit.payload.morningGzipBytes<=1600*1024)
  assert(audit.payload.chunks.every(c=>c.gzipBytes<=450*1024))
  summaries.push({date,trips:trains.size,patterns:patterns.size,matched,total,coverage:matched/total})
}
console.log(JSON.stringify({passed:true,archivedRoutes:inventory.routes.length,cantonRoutes:inventory.routes.filter(r=>r.cantonSourceTrips).length,sourceRecords:collection.features.length,days:summaries},null,2))
