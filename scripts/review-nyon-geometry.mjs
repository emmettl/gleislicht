import assert from 'node:assert/strict'
import { readFile,writeFile } from 'node:fs/promises'
import { readPostbusDay } from './prepare-postbus-road-feed.mjs'
import { nyonRailCorridor } from './nyon-geometry.mjs'
import { parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'
const [manifestPath,roadPath,railPath,output]=process.argv.slice(2);assert(output,'Usage: MANIFEST ROAD_LINES_JSON RAIL OUTPUT_SVG')
const {manifest,trains}=await readPostbusDay(manifestPath), roads=JSON.parse(await readFile(roadPath)),rail=nyonRailCorridor(parseRailNetworkXtf(await readFile(railPath,'utf8'),10)).map(s=>s.points)
const panels=[['Divonne · Arbère and old station',[6.137,46.354],.012],['Divonne · pool and border',[6.154,46.361],.009],['Gex · school services',[6.064,46.337],.014],['Nyon · Terre-Bonne platform correction',[6.214,46.384],.004],['Nyon · station and route du Stand',[6.23,46.381],.008],['NStCM · Nyon to La Cure',[6.152,46.425],.10,true]]
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;')
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1280"><rect width="1200" height="1280" fill="#0b1020"/><style>text{font-family:Arial;fill:#e8efff}</style><text x="24" y="32" font-size="22">Nyon geometry review · 8 September 2026</text><text x="24" y="59" font-size="14">Grey: retained OSM roads / FOT rail · cyan: matched journeys · white: GTFS platforms</text>'
for(const [i,[title,centre,radius,isRail]] of panels.entries()){
 const x=24+i%2*590,y=80+Math.floor(i/2)*390,w=566,h=360,b=[centre[0]-radius,centre[1]-radius*.68,centre[0]+radius,centre[1]+radius*.68]
 const inside=c=>c[0]>=b[0]&&c[0]<=b[2]&&c[1]>=b[1]&&c[1]<=b[3],xy=c=>[x+(c[0]-b[0])/(b[2]-b[0])*w,y+30+(b[3]-c[1])/(b[3]-b[1])*(h-30)]
 const line=points=>points.map((p,j)=>`${j?'L':'M'}${xy(p).map(v=>v.toFixed(1)).join(' ')}`).join('')
 svg+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#101a2d" stroke="#35445e"/><text x="${x+10}" y="${y+21}" font-size="15">${escape(title)}</text><clipPath id="p${i}"><rect x="${x}" y="${y+30}" width="${w}" height="${h-30}"/></clipPath><g clip-path="url(#p${i})">`
 for(const p of isRail?rail:roads)if(p.some(inside))svg+=`<path d="${line(p)}" fill="none" stroke="#707d92" stroke-width="2.5"/>`
 const selected=trains.filter(t=>isRail?t.category!=='bus':t.category==='bus'),ids=new Set(selected.flatMap(t=>t.pathSegments).filter(id=>id!=null)),stops=new Set(selected.flatMap(t=>t.stops.map(([i])=>i)));let visible=0,labels=0
 for(const id of ids){const p=manifest.paths[id];if(p.some(inside)){visible++;svg+=`<path d="${line(p)}" fill="none" stroke="#5ef3ee" stroke-width="1.3"/>`}}
 if (!visible) { assert(!selected.some(t => t.stops.some(([id]) => inside(manifest.stops[id]))), `Missing geometry in ${title}`); svg += `<text x="${x+20}" y="${y+60}" font-size="13">No scheduled journeys in this area on this date</text>` }
 for(const id of stops){const p=manifest.stops[id];if(inside(p)){const [sx,sy]=xy(p);svg+=`<circle cx="${sx}" cy="${sy}" r="2" fill="white"/>`;if(labels++<5)svg+=`<text x="${sx+4}" y="${sy-5}" font-size="10">${escape(p[2])}</text>`}}
 svg+='</g>'
}
svg+='<text x="24" y="1260" font-size="13">© OpenStreetMap contributors · ODbL 1.0; Federal Office of Transport. Inferred geometry; not operator verification.</text></svg>'
await writeFile(output,svg.replace('8 September 2026', manifest.metadata.serviceDate))
