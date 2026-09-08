import assert from 'node:assert/strict'
import { mkdir,mkdtemp,readFile,writeFile,rm } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { importAargauRoads } from './aargau-road-geometry.mjs'
import { hashFile } from './inventory-aargau.mjs'
export const LENZBURG_ROAD_SOURCE='Geofabrik Switzerland 2026-09-02 plus OSM border extract 2026-09-08; pfaedle 99f2cd4; eight Lenzburg witness patterns, diagnostic only'
const root='data/aargau-witness-lenzburg-sources',names=['patterns.json','matching.log','shapes.txt','trips.txt','stop_times.txt','routing-run.json']
if(process.argv.includes('--check')){
 const source=await readJson(`${root}/routing.json`)
 for(const [file,sha]of Object.entries(source.files))assert.equal(await hashFile(`${root}/${file}`),sha)
 const evidence=await readGzipJson(`${root}/matcher-evidence.json.gz`),dir=await mkdtemp('/private/tmp/aargau-lenzburg-replay-')
 try{
  await writeFile(`${dir}/preparation.json`,evidence.preparation);await mkdir(`${dir}/7231`)
  assert.deepEqual(Object.keys(evidence.outputs),names)
  for(const [name,bytes]of Object.entries(evidence.outputs))await writeFile(`${dir}/7231/${name}`,bytes)
  const replay=await importAargauRoads(dir,dir,LENZBURG_ROAD_SOURCE)
  assert.deepEqual(replay,await readGzipJson(`${root}/cache.json.gz`));assert.deepEqual(replay.agencyCaches['7231'].report,source.report)
 }finally{await rm(dir,{recursive:true,force:true})}
 console.log('Replayed all eight Lenzburg matcher outputs, preserving both stop-distance rejections')
}else{
 const [preparation,matched,config]=process.argv.slice(2);assert(preparation&&matched&&config,'Supply preparation, matched and configuration paths')
 const bundle=await importAargauRoads(preparation,matched,LENZBURG_ROAD_SOURCE),cache=bundle.agencyCaches['7231']
 assert.equal(Object.keys(bundle.agencyCaches).length,1);assert.equal(Object.keys(cache.patterns).length,8);assert.equal(cache.report.issues.length,2);assert(cache.report.issues.every(i=>i.reason==='stop-too-far'&&i.snap>120));assert.equal(cache.report.matchedSegments,582)
 const evidence={preparation:await readFile(`${preparation}/preparation.json`,'utf8'),outputs:Object.fromEntries(await Promise.all(names.map(async n=>[n,await readFile(`${matched}/7231/${n}`,'utf8')])))}
 await mkdir(root,{recursive:true});await writeFile(`${root}/cache.json.gz`,gzipSync(JSON.stringify(bundle),{level:9}));await writeFile(`${root}/matcher-evidence.json.gz`,gzipSync(JSON.stringify(evidence),{level:9}));await writeFile(`${root}/pfaedle.cfg`,await readFile(config))
 assert.equal(await hashFile(`${root}/pfaedle.cfg`),cache.metadata.matcher.configSha256)
 const source={schemaVersion:1,scope:'All eight full May Lenzburg witness patterns tested; numerical road compatibility alone does not authorize replacement-bus admission without timetable and source-time review.',attribution:'© OpenStreetMap contributors; ODbL-1.0',sourceUrl:'https://www.openstreetmap.org/copyright',sourceDates:{switzerland:'2026-09-02',borderRetrieved:'2026-09-08'},osmSha256:cache.metadata.sourceSha256,binarySha256:cache.metadata.matcher.binarySha256,configSha256:cache.metadata.matcher.configSha256,sourceTimetableSha256:await hashFile('data/aargau-witnesses/source-patterns.json.gz'),files:Object.fromEntries(await Promise.all(['cache.json.gz','matcher-evidence.json.gz','pfaedle.cfg'].map(async f=>[f,await hashFile(`${root}/${f}`)]))),report:cache.report}
 await writeFile(`${root}/routing.json`,JSON.stringify(source,null,2)+'\n');console.log(source.report)
}
