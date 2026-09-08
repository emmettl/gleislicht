import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { fromUrl } from 'geotiff'
import { mappedJungfrauRoutes } from './jungfrau-terrain-geometry.mjs'
import { sampleElevation } from './ingest-rigi-terrain.mjs'
const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1]}
const hash=b=>createHash('sha256').update(b).digest('hex')
const readJson=async p=>JSON.parse(await readFile(p,'utf8'))
async function main() {
 const networkBytes=await readFile('public/data/jungfrau-day.json'), network=JSON.parse(networkBytes)
 const sourceBytes=await readFile('data/jungfrau-terrain-source.json'), source=JSON.parse(sourceBytes)
 const routes=mappedJungfrauRoutes(network,source,await readJson('data/jungfrau-ascent-source.json'))
 const all=routes.flatMap(r=>r.matches.map(m=>m.point)), xs=all.map(p=>p[0]),ys=all.map(p=>p[1]), margin=2600
 const bounds={minEasting:Math.floor((Math.min(...xs)-margin)/100)*100,maxEasting:Math.ceil((Math.max(...xs)+margin)/100)*100,minNorthing:Math.floor((Math.min(...ys)-margin)/100)*100,maxNorthing:Math.ceil((Math.max(...ys)+margin)/100)*100}
 const stac=arg('stac','/private/tmp/jungfrau-alti-stac.json'), cache=arg('cache','/private/tmp/jungfrau-alti-raster.json')
 let item
 try { item=await readJson(stac) } catch(e) { if(e.code!=='ENOENT')throw e;const response=await fetch('https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissaltiregio/items/swissaltiregio');if(!response.ok)throw new Error(`STAC ${response.status}`);item=await response.json();await writeFile(stac,JSON.stringify(item)) }
 const asset=Object.values(item.assets).find(a=>a['geoadmin:variant']==='fullcoverage' && a.type?.includes('geotiff'))
 if (!asset || asset['proj:epsg']!==2056)throw new Error('No compatible federal elevation asset')
 let raster
 try {raster=await readJson(cache)}catch(e){if(e.code!=='ENOENT')throw e}
 if(raster && (raster.assetChecksum!==asset['file:checksum'] || JSON.stringify(raster.bounds)!==JSON.stringify(bounds)))throw new Error('Mismatched raster cache')
 if(!raster){
  console.log('Reading bounded native 10 m terrain…',bounds)
  const tiff=await fromUrl(asset.href,{allowFullFile:false}), image=await tiff.getImage(0),origin=image.getOrigin(),resolution=image.getResolution()
  if(resolution[0]!==10 || resolution[1]!==-10)throw new Error('Unexpected native terrain grid')
  const window=[Math.floor((bounds.minEasting-origin[0])/10)-2,Math.floor((origin[1]-bounds.maxNorthing)/10)-2,Math.ceil((bounds.maxEasting-origin[0])/10)+2,Math.ceil((origin[1]-bounds.minNorthing)/10)+2]
  const values=await image.readRasters({window,samples:[0],interleave:true})
  raster={bounds,origin,resolution,window,width:values.width,height:values.height,assetChecksum:asset['file:checksum'],values:[...values]}
  await writeFile(cache,JSON.stringify(raster))
 }
 const width=bounds.maxEasting-bounds.minEasting,depth=bounds.maxNorthing-bounds.minNorthing,columns=193,rows=Math.round((columns-1)*depth/width)+1
 const origin={easting:(bounds.minEasting+bounds.maxEasting)/2,northing:(bounds.minNorthing+bounds.maxNorthing)/2}
 const elevations=Array.from({length:columns*rows},(_,i)=>Math.round(sampleElevation(raster,bounds.minEasting+i%columns*width/(columns-1),bounds.maxNorthing-Math.floor(i/columns)*depth/(rows-1))))
 const artifact={id:'jungfrau-ascent-terrain',version:1,metadata:{serviceDate:network.metadata.serviceDate,feedVersion:network.metadata.feedVersion,timetableSha256:network.metadata.sources.timetable.sha256,networkSha256:hash(networkBytes),source:'swissALTIRegio + swissTLM3D',sourceCrs:'EPSG:2056 / LN02',terrainRelease:item.properties.datetime.slice(0,10),terrainUrl:asset.href,terrainChecksum:asset['file:checksum'],terrainProductUrl:'https://www.swisstopo.admin.ch/en/height-model-swissaltiregio',railSourceUrl:source.sourceUrl,railSourceSha256:hash(sourceBytes),railProductUrl:source.productUrl,model:'Mapped FOT plan alignment with heights interpolated from nearby swissTLM3D rail axes; equal horizontal/vertical scale. Only unmasked outdoor sections use 3D; tunnels, covered structures and offsets above 25 m remain in 2D. Timetable motion, not live or surveyed train positions.',attribution:'Federal Office of Transport; swisstopo. Terrain: swissALTIRegio (swisstopo and contributing national elevation datasets).',bounds,gridSpacingMetres:[width/(columns-1),depth/(rows-1)],nativeResolutionMetres:10},origin,terrain:{columns,rows,widthMetres:width,depthMetres:depth,minElevation:Math.min(...elevations),maxElevation:Math.max(...elevations),elevations},routes:routes.map(r=>({routeId:r.routeId,legIndex:r.legIndex,vehicle:r.legIndex===0?'train':'cogwheel',points:r.matches.map(m=>[Number((m.point[0]-origin.easting).toFixed(2)),Number((origin.northing-m.point[1]).toFixed(2)),Number(m.point[2].toFixed(2))]),stops:r.stops,maskedRanges:r.maskedRanges.map(m=>({...m,reason:m.kinds.includes('Tunnel')?'tunnel':m.kinds.some(k=>!['Keine','Bruecke'].includes(k))?'covered':'alignment'}))}))}
 const bytes=JSON.stringify(artifact)
 const audit={metadata:artifact.metadata,rasterSha256:hash(JSON.stringify(raster)),gzipBytes:gzipSync(bytes).length,routes:routes.map(r=>({routeId:r.routeId,tripId:r.train.id,points:r.matches.length,length3dMetres:r.length,maxOffsetMetres:r.maxOffset,maskedFraction:r.maskedRanges.reduce((s,m)=>s+m.end-m.start,0),sourceFeatureIds:[...new Set(r.matches.map(m=>m.id))],sourceYears:[...new Set(r.matches.map(m=>m.year))],stops:r.stops.map((s,i)=>({...s,railHeight:r.matches[r.stopIndices[i]].point[2],groundHeight:sampleElevation(raster,...r.matches[r.stopIndices[i]].point)})),maskedRanges:r.maskedRanges}))}
 await writeFile('data/jungfrau-terrain-audit.json',JSON.stringify(audit,null,2)+'\n')
 if(audit.gzipBytes>220*1024)throw new Error('Optional terrain exceeds 220 KiB gzip budget')
 await writeFile(arg('output','public/data/jungfrau-ascent-terrain.json'),bytes+'\n')
 console.log(`Wrote ${columns}×${rows} terrain; ${(audit.gzipBytes/1024).toFixed(1)} KiB gzip`)
}
if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error(e);process.exitCode=1})
