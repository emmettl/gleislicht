import assert from 'node:assert/strict'
import { mkdir,mkdtemp,readFile,writeFile,rm } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { readJson,readGzipJson } from './aargau-seasonal.mjs'
import { importAargauRoads } from './aargau-road-geometry.mjs'
import { hashFile } from './inventory-aargau.mjs'
export const SCHUPFART_ROAD_SOURCE='Geofabrik Switzerland 2026-09-02 plus OSM border extract 2026-09-08; pfaedle 99f2cd4; twelve Schupfart witness patterns, diagnostic only'
const root='data/aargau-witness-schupfart-sources',names=['patterns.json','matching.log','shapes.txt','trips.txt','stop_times.txt','routing-run.json']
if(process.argv.includes('--check')){
 const source=await readJson(`${root}/routing.json`)
 for(const [file,sha]of Object.entries(source.files))assert.equal(await hashFile(`${root}/${file}`),sha)
 const evidence=await readGzipJson(`${root}/matcher-evidence.json.gz`),dir=await mkdtemp('/private/tmp/aargau-schupfart-replay-')
 try{
  await writeFile(`${dir}/preparation.json`,evidence.preparation);await mkdir(`${dir}/801`)
  assert.deepEqual(Object.keys(evidence.outputs),names)
  for(const [name,bytes]of Object.entries(evidence.outputs))await writeFile(`${dir}/801/${name}`,bytes)
  assert.deepEqual(await importAargauRoads(dir,dir,SCHUPFART_ROAD_SOURCE),await readGzipJson(`${root}/cache.json.gz`))
 }finally{await rm(dir,{recursive:true,force:true})}
 console.log('Replayed all twelve Schupfart matcher outputs and zero fallback warnings')
}else{
 const [preparation,matched,config]=process.argv.slice(2);assert(preparation&&matched&&config,'Supply preparation, matched and configuration paths')
 const bundle=await importAargauRoads(preparation,matched,SCHUPFART_ROAD_SOURCE),cache=bundle.agencyCaches['801']
 assert.equal(Object.keys(bundle.agencyCaches).length,1);assert.equal(Object.keys(cache.patterns).length,12);assert.equal(cache.report.issues.length,0)
 const evidence={preparation:await readFile(`${preparation}/preparation.json`,'utf8'),outputs:Object.fromEntries(await Promise.all(names.map(async n=>[n,await readFile(`${matched}/801/${n}`,'utf8')])))}
 await mkdir(root,{recursive:true});await writeFile(`${root}/cache.json.gz`,gzipSync(JSON.stringify(bundle),{level:9}));await writeFile(`${root}/matcher-evidence.json.gz`,gzipSync(JSON.stringify(evidence),{level:9}));await writeFile(`${root}/pfaedle.cfg`,await readFile(config))
 assert.equal(await hashFile(`${root}/pfaedle.cfg`),cache.metadata.matcher.configSha256)
 const source={schemaVersion:1,scope:'All six full AVA witness patterns tested; numerical road compatibility alone does not authorize event-path admission without timetable and source-time review.',attribution:'© OpenStreetMap contributors; ODbL-1.0',sourceUrl:'https://www.openstreetmap.org/copyright',sourceDates:{switzerland:'2026-09-02',borderRetrieved:'2026-09-08'},osmSha256:cache.metadata.sourceSha256,binarySha256:cache.metadata.matcher.binarySha256,configSha256:cache.metadata.matcher.configSha256,sourceTimetableSha256:await hashFile('data/aargau-witnesses/source-patterns.json.gz'),files:Object.fromEntries(await Promise.all(['cache.json.gz','matcher-evidence.json.gz','pfaedle.cfg'].map(async f=>[f,await hashFile(`${root}/${f}`)]))),report:cache.report}
 await writeFile(`${root}/routing.json`,JSON.stringify(source,null,2)+'\n');console.log(source.report)
}
